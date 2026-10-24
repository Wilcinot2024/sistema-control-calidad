import io
from email.message import EmailMessage
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject
from .models import SDI, PerfilUsuario, ItemSDI, InspeccionSDI, NotificacionSDI
from .workflow import assign_sdi, review_results, receive_pdf
from .mail import receive_message, send_notifications
from .services import cerrar_sdi, aprobar_inspeccion, registrar_inspeccion_visual, crear_reinspeccion


def sample_pdf(text=None):
    text = text or f"SDI-12-001\nProyecto: Torre\nDepartamento: Bodega\nSolicitante: Ana\nFecha: {timezone.localdate().isoformat()}\nProducto: Pieza A\nDescripcion: Acero\nCantidad: 10"
    writer = PdfWriter()
    page = writer.add_blank_page(width=500, height=700)
    font = DictionaryObject({NameObject('/Type'): NameObject('/Font'), NameObject('/Subtype'): NameObject('/Type1'), NameObject('/BaseFont'): NameObject('/Helvetica')})
    page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'): DictionaryObject({NameObject('/F1'): writer._add_object(font)})})
    stream = DecodedStreamObject()
    lines = ['BT /F1 12 Tf 30 650 Td']
    for line in text.splitlines():
        line = line.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')
        lines.append(f'({line}) Tj 0 -18 Td')
    lines.append('ET')
    stream.set_data('\n'.join(lines).encode())
    page[NameObject('/Contents')] = writer._add_object(stream)
    out = io.BytesIO(); writer.write(out)
    return out.getvalue()


class WorkflowTests(TestCase):
    def setUp(self):
        self.override = override_settings(STORAGES={
            'default': {'BACKEND': 'django.core.files.storage.InMemoryStorage'},
            'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
        })
        self.override.enable(); self.addCleanup(self.override.disable)
        users = get_user_model()
        self.boss = users.objects.create_user('boss', password='test-password')
        self.inspector = users.objects.create_user('inspector', password='test-password')
        self.other = users.objects.create_user('other', password='test-password')
        for user, role in [(self.boss, 'jefe_calidad'), (self.inspector, 'inspector'), (self.other, 'inspector')]:
            PerfilUsuario.objects.create(usuario=user, rol=role)
        self.client = APIClient(); self.client.force_authenticate(self.boss)

    def draft(self):
        return SDI.objects.create(activacion_proyecto='12', numero_sdi='001', fecha_emision=timezone.localdate(), proyecto='Torre', departamento_solicitante='Bodega', solicitante='Ana', correo_origen='ana@example.com')

    def assigned(self):
        sdi = self.draft()
        item = ItemSDI.objects.create(sdi=sdi, orden=1, articulo='Pieza A', cantidad_indicada=10, cantidad_a_inspeccionar=5)
        assign_sdi(sdi.pk, self.boss, self.inspector, 'Revisar plano')
        sdi.refresh_from_db()
        return sdi, item, item.inspecciones.get()

    def complete(self, inspection):
        registrar_inspeccion_visual(self.inspector, inspection.pk, **dict.fromkeys(['rebarbas','rayaduras','golpes','deformidad','pintura','burbujas','planitud'], 'conforme'))
        aprobar_inspeccion(inspection.pk, self.inspector)

    def test_pdf_receipt_preserves_proposal_and_deduplicates(self):
        sdi, created = receive_pdf(sample_pdf(), 'original.pdf', 'ana@example.com', user=self.boss)
        self.assertTrue(created)
        self.assertEqual(sdi.estado, 'pendiente'); self.assertIsNone(sdi.inspector)
        self.assertIsNone(sdi.numero_sdi)
        self.assertEqual(sdi.datos_pdf['campos']['numero_sdi'], '001')
        self.assertEqual(sdi.documentos.get().nombre, 'original.pdf')
        self.assertFalse(receive_pdf(sample_pdf(), 'original.pdf', 'ana@example.com', user=self.boss)[1])
        self.client.force_authenticate(self.inspector)
        self.assertEqual(self.client.get('/api/sdi/').data, [])
        self.assertEqual(self.client.get(f'/api/documentos/{sdi.documentos.get().id}/archivo/').status_code, 404)

    def test_annulment_requires_reason_and_preserves_original(self):
        sdi, _ = receive_pdf(sample_pdf(), 'original.pdf', user=self.boss)
        item = ItemSDI.objects.create(sdi=sdi, orden=1, articulo='Pieza', cantidad_a_inspeccionar=1)
        url = f'/api/sdi/{sdi.pk}/anular/'
        for reason in ['', '   ', 'x' * 1001]:
            self.assertEqual(self.client.post(url, {'motivo': reason}, format='json').status_code, 400)
        response = self.client.post(url, {'motivo': '  Solicitud duplicada  '}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        sdi.refresh_from_db()
        self.assertEqual(sdi.estado, 'anulada')
        self.assertEqual(sdi.motivo_anulacion, 'Solicitud duplicada')
        self.assertEqual(sdi.anulada_por, self.boss)
        self.assertTrue(ItemSDI.objects.filter(pk=item.pk).exists())
        self.assertEqual(sdi.documentos.count(), 1)
        self.assertEqual(sdi.historial.get(accion='SDI anulada').estado_anterior, 'pendiente')
        self.assertEqual(self.client.get('/api/sdi/').data, [])
        self.assertEqual(len(self.client.get('/api/sdi/?vista=anuladas').data), 1)
        self.assertEqual(self.client.get('/api/dashboard/').data['pendientes'], 0)
        self.assertEqual(self.client.post(url, {'motivo': 'Otra'}).status_code, 400)
        self.assertEqual(self.client.patch(f'/api/sdi/{sdi.pk}/', {'proyecto':'Cambio'}).status_code, 400)
        self.assertEqual(self.client.post(f'/api/sdi/{sdi.pk}/asignar/', {'inspector':self.inspector.pk}).status_code, 400)
        self.assertEqual(self.client.delete(f'/api/items/{item.pk}/').status_code, 400)
        file_response = self.client.get(f'/api/documentos/{sdi.documentos.get().pk}/archivo/')
        self.assertEqual(file_response.status_code, 200)
        file_response.close()

    def test_assigned_or_inspected_sdi_cannot_be_annulled(self):
        sdi, item, inspection = self.assigned()
        self.assertEqual(self.client.post(f'/api/sdi/{sdi.pk}/anular/', {'motivo':'Duplicada'}).status_code, 400)
        # Datos antiguos con inspecciones, aunque no tengan asignación formal.
        SDI.objects.filter(pk=sdi.pk).update(estado='pendiente', asignada=None)
        self.assertEqual(self.client.post(f'/api/sdi/{sdi.pk}/anular/', {'motivo':'Error'}).status_code, 400)
        self.assertEqual(self.client.delete(f'/api/items/{item.pk}/').status_code, 400)
        self.assertTrue(InspeccionSDI.objects.filter(pk=inspection.pk).exists())

    def test_archive_restore_preserves_state_and_inspector_access(self):
        sdi, item, inspection = self.assigned()
        response = self.client.post(f'/api/sdi/{sdi.pk}/archivo/', {'archivar':True}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['estado'], 'en_proceso')
        self.assertEqual(response.data['archivada_por'], self.boss.pk)
        self.assertEqual(self.client.get('/api/sdi/').data, [])
        self.assertEqual(len(self.client.get('/api/sdi/?vista=archivadas').data), 1)
        self.assertEqual(self.client.get('/api/dashboard/').data['en_proceso'], {'SDI':0, 'Producto':0, 'Inspección':0})
        self.client.force_authenticate(self.inspector)
        self.assertEqual(len(self.client.get('/api/sdi/?vista=archivadas').data), 1)
        self.assertEqual(self.client.get(f'/api/sdi/{sdi.pk}/').status_code, 200)
        self.assertEqual(self.client.post(f'/api/sdi/{sdi.pk}/archivo/', {'archivar':False}).status_code, 403)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get('/api/sdi/?vista=archivadas').data, [])
        self.client.force_authenticate(self.boss)
        response = self.client.post(f'/api/sdi/{sdi.pk}/archivo/', {'archivar':False}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(response.data['archivada'])
        self.assertEqual(len(self.client.get('/api/sdi/').data), 1)
        inspection.refresh_from_db()
        self.assertEqual(inspection.resultado, 'en_proceso')
        self.assertEqual(sdi.historial.filter(accion__in=['SDI archivada','SDI restaurada']).count(), 2)

    def test_only_management_can_annul_or_withdraw(self):
        sdi = self.draft()
        item = ItemSDI.objects.create(sdi=sdi, orden=1, articulo='Pieza', cantidad_a_inspeccionar=2)
        self.client.force_authenticate(self.inspector)
        self.assertIn(self.client.post(f'/api/sdi/{sdi.pk}/anular/', {'motivo':'Error'}).status_code, [403,404])
        self.assertEqual(self.client.delete(f'/api/items/{item.pk}/').status_code, 404)
        self.client.force_authenticate(self.boss)
        self.assertEqual(self.client.delete(f'/api/items/{item.pk}/').status_code, 204)
        self.assertIn('a inspeccionar: 2', sdi.historial.get(accion='Producto retirado de revisión').comentario)

    def test_pending_archive_and_state_bypass_are_rejected(self):
        sdi = self.draft()
        self.assertEqual(self.client.post(f'/api/sdi/{sdi.pk}/archivo/', {'archivar':True}).status_code, 400)
        self.client.patch(f'/api/sdi/{sdi.pk}/', {'estado':'anulada', 'archivada':timezone.now().isoformat(), 'motivo_anulacion':'Cambio'}, format='json')
        sdi.refresh_from_db()
        self.assertEqual(sdi.estado, 'pendiente')
        self.assertIsNone(sdi.archivada)
        self.assertEqual(sdi.motivo_anulacion, '')
        self.assertEqual(self.client.get('/api/sdi/?vista=incorrecta').status_code, 400)

    def test_annulled_archive_restore_does_not_reopen(self):
        sdi = self.draft()
        self.client.post(f'/api/sdi/{sdi.pk}/anular/', {'motivo':'Error'})
        for archived in [True, False]:
            response = self.client.post(f'/api/sdi/{sdi.pk}/archivo/', {'archivar':archived}, format='json')
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data['estado'], 'anulada')
        self.assertEqual(self.client.get('/api/sdi/').data, [])
        self.assertEqual(len(self.client.get('/api/sdi/?vista=anuladas').data), 1)

    def test_sdi_and_inspection_have_no_destructive_delete(self):
        sdi, item, inspection = self.assigned()
        self.assertEqual(self.client.delete(f'/api/sdi/{sdi.pk}/').status_code, 405)
        self.assertEqual(self.client.delete(f'/api/inspecciones/{inspection.pk}/').status_code, 405)
        self.assertEqual(self.client.delete(f'/api/items/{item.pk}/').status_code, 400)

    def test_product_with_recorded_result_is_preserved(self):
        sdi = self.draft()
        item = ItemSDI.objects.create(sdi=sdi, orden=1, articulo='Pieza', cantidad_a_inspeccionar=1, resultado_actual='aprobada')
        self.assertEqual(self.client.delete(f'/api/items/{item.pk}/').status_code, 400)
        self.assertTrue(ItemSDI.objects.filter(pk=item.pk).exists())

    def test_api_draft_products_assignment_and_visibility(self):
        response = self.client.post('/api/sdi/', {}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        pk = response.data['id']
        response = self.client.patch(f'/api/sdi/{pk}/', { 'activacion_proyecto':'12', 'numero_sdi':'001', 'fecha_emision':timezone.localdate().isoformat(), 'proyecto':'Torre','departamento_solicitante':'Bodega','solicitante':'Ana','correo_origen':'ana@example.com'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        response = self.client.post(f'/api/sdi/{pk}/items/', {'articulo':'Pieza A','cantidad_indicada':10,'cantidad_a_inspeccionar':5,'orden':99}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['orden'], 1)
        response = self.client.post(f'/api/sdi/{pk}/asignar/', {'inspector':self.inspector.id,'instrucciones':'Revisar'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['estado'], 'en_proceso')
        self.assertEqual(response.data['productos'][0]['inspecciones'][0]['cantidad_inspeccionada'], 5)
        self.assertEqual(NotificacionSDI.objects.count(), 1)
        self.assertEqual(self.client.post(f'/api/sdi/{pk}/asignar/', {'inspector':self.inspector.id}).status_code, 400)
        self.assertEqual(self.client.post(f'/api/sdi/{pk}/items/', {'articulo':'Otro','cantidad_a_inspeccionar':1}).status_code, 400)
        self.client.force_authenticate(self.inspector)
        self.assertEqual(len(self.client.get('/api/sdi/').data), 1)
        item = ItemSDI.objects.get(sdi_id=pk)
        self.assertEqual(self.client.get(f'/api/items/{item.id}/inspecciones/').status_code, 200)
        self.assertEqual(self.client.patch(f'/api/sdi/{pk}/', {'proyecto':'Cambio'}).status_code, 403)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(f'/api/sdi/{pk}/').status_code, 404)

    def test_assignment_requires_reviewed_fields_date_and_quantities(self):
        sdi = self.draft()
        sdi.fecha_emision = timezone.localdate().replace(year=timezone.localdate().year + 1); sdi.save()
        ItemSDI.objects.create(sdi=sdi, orden=1, articulo='Pieza', cantidad_indicada=1, cantidad_a_inspeccionar=2)
        with self.assertRaises(ValidationError): assign_sdi(sdi.pk, self.boss, self.inspector)
        self.assertFalse(NotificacionSDI.objects.exists())
        self.assertFalse(InspeccionSDI.objects.exists())

    def test_full_inspection_review_close_and_outbox(self):
        sdi, item, inspection = self.assigned()
        self.client.force_authenticate(self.inspector)
        data = dict.fromkeys(['rebarbas','rayaduras','golpes','deformidad','pintura','burbujas','planitud'], 'conforme')
        self.assertEqual(self.client.post(f'/api/inspecciones/{inspection.id}/visual/', data).status_code, 201)
        self.assertEqual(self.client.post(f'/api/inspecciones/{inspection.id}/aprobar/', {'cantidad_aprobada':5}).status_code, 200)
        self.client.force_authenticate(self.boss)
        self.assertEqual(self.client.get('/api/dashboard/').data['por_revisar'], 1)
        with self.assertRaises(ValidationError): cerrar_sdi(sdi.pk, self.boss)
        review_results(sdi.pk, self.boss, 'Validado')
        self.assertEqual(self.client.get('/api/dashboard/').data['por_revisar'], 0)
        closed = cerrar_sdi(sdi.pk, self.boss)
        self.assertEqual(closed.estado, 'cerrada'); self.assertEqual(closed.resultado_cierre, 'aprobada')
        self.assertEqual(NotificacionSDI.objects.count(), 2)
        with self.assertRaises(ValidationError): cerrar_sdi(sdi.pk, self.boss)

    def test_reinspection_invalidates_manager_review(self):
        sdi, item, inspection = self.assigned()
        registrar_inspeccion_visual(self.inspector, inspection.pk, **dict.fromkeys(['rebarbas','rayaduras','golpes','deformidad','pintura','burbujas','planitud'], 'conforme'))
        aprobar_inspeccion(inspection.pk, self.inspector, cantidad_aprobada=2)
        review_results(sdi.pk, self.boss)
        crear_reinspeccion(item.pk, self.inspector, self.boss, 3)
        sdi.refresh_from_db(); self.assertIsNone(sdi.revisada)
        with self.assertRaises(ValidationError): cerrar_sdi(sdi.pk, self.boss)

    def test_authenticated_evidence_and_file_access(self):
        sdi, item, inspection = self.assigned()
        self.client.force_authenticate(self.inspector)
        response = self.client.post(f'/api/inspecciones/{inspection.id}/evidencias/', {'archivo': SimpleUploadedFile('prueba.txt', b'prueba'), 'tipo':'documento'})
        self.assertEqual(response.status_code, 201, response.data)
        path = response.data['archivo']
        response = self.client.get(path); self.assertEqual(response.status_code, 200); response.close()
        self.client.force_authenticate(self.other); self.assertEqual(self.client.get(path).status_code, 404)
        self.client.force_authenticate(None); self.assertEqual(self.client.get(path).status_code, 401)
        self.assertEqual(self.client.get('/media/evidencias_sdi/prueba.txt').status_code, 404)

    def test_email_ingestion_retries_do_not_duplicate(self):
        msg = EmailMessage(); msg['From']='ana@example.com'; msg['To']='calidad@example.com'; msg['Message-ID']='<test@example.com>'; msg['Subject']='Solicitud'
        msg.set_content('Adjunto SDI'); msg.add_attachment(sample_pdf(), maintype='application', subtype='pdf', filename='sdi.pdf')
        self.assertTrue(receive_message(msg.as_bytes())[0][1])
        self.assertFalse(receive_message(msg.as_bytes())[0][1])
        self.assertEqual(SDI.objects.get().origen, 'correo')
        with override_settings(SDI_ALLOWED_SENDERS=['otro@example.com']):
            with self.assertRaises(ValueError): receive_message(msg.as_bytes())

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    def test_outbox_delivers_once_and_keeps_failures_for_retry(self):
        self.assigned()
        with patch('quality.mail.EmailMessage.send', side_effect=ConnectionError): self.assertEqual(send_notifications(), 0)
        notice = NotificacionSDI.objects.get(); self.assertIsNone(notice.enviada); self.assertEqual(notice.intentos, 1)
        notice.proximo_intento=timezone.now(); notice.save()
        self.assertEqual(send_notifications(), 1); self.assertEqual(send_notifications(), 0)

    def test_bad_pdf_rejected_without_sdi(self):
        with self.assertRaises(ValidationError): receive_pdf(b'bad', 'sdi.pdf', user=self.boss)
        self.assertEqual(SDI.objects.count(), 0)

    def test_draft_cannot_leak_through_legacy_inspection_or_history_routes(self):
        sdi = self.draft(); sdi.inspector = self.inspector; sdi.save()
        item = ItemSDI.objects.create(sdi=sdi, orden=1, articulo='Pieza', cantidad_a_inspeccionar=1)
        inspection = InspeccionSDI.objects.create(item=item, numero_inspeccion=1, inspector=self.inspector, cantidad_inspeccionada=1)
        self.client.force_authenticate(self.inspector)
        for path in [f'/api/sdi/{sdi.pk}/historial/', f'/api/items/{item.pk}/inspecciones/', f'/api/inspecciones/{inspection.pk}/', f'/api/inspecciones/{inspection.pk}/visual/']:
            self.assertEqual(self.client.get(path).status_code, 404, path)
        self.assertEqual(self.client.post(f'/api/inspecciones/{inspection.pk}/aprobar/', {}).status_code, 403)

    def test_dashboard_counts_entities_separately_and_limits_visibility(self):
        self.assigned()
        response = self.client.get('/api/dashboard/')
        self.assertEqual(response.data['en_proceso'], {'SDI':1,'Producto':1,'Inspección':1})
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get('/api/dashboard/').data['en_proceso'], {'SDI':0,'Producto':0,'Inspección':0})

    def test_inactive_profile_cannot_receive_or_assign(self):
        self.boss.perfil.activo = False; self.boss.perfil.save()
        self.assertEqual(self.client.post('/api/sdi/', {}, format='json').status_code, 403)
        self.assertEqual(self.client.get('/api/dashboard/').status_code, 403)

    def test_product_limits_and_dates_validated_on_api(self):
        sdi = self.draft()
        for payload in [{'articulo':'Pieza@','cantidad_a_inspeccionar':1}, {'articulo':'Pieza','cantidad_a_inspeccionar':0}, {'articulo':'Pieza','cantidad_indicada':1,'cantidad_a_inspeccionar':2}]:
            self.assertEqual(self.client.post(f'/api/sdi/{sdi.pk}/items/', payload, format='json').status_code, 400)
        future = timezone.localdate().replace(year=timezone.localdate().year+1).isoformat()
        self.assertEqual(self.client.patch(f'/api/sdi/{sdi.pk}/', {'fecha_emision':future}, format='json').status_code, 400)
        self.assertEqual(self.client.post(f'/api/sdi/{sdi.pk}/asignar/', {'inspector':'letters'}, format='json').status_code, 400)

    def test_review_before_inspections_end_and_inspector_review_denied(self):
        sdi, _, _ = self.assigned()
        self.assertEqual(self.client.post(f'/api/sdi/{sdi.pk}/revisar/', {}).status_code, 400)
        self.client.force_authenticate(self.inspector)
        self.assertEqual(self.client.post(f'/api/sdi/{sdi.pk}/revisar/', {}).status_code, 403)
        self.assertEqual(self.client.post(f'/api/sdi/{sdi.pk}/cerrar/', {}).status_code, 403)

    def test_console_does_not_claim_notification_delivered(self):
        self.assigned()
        with override_settings(EMAIL_BACKEND='django.core.mail.backends.console.EmailBackend'):
            self.assertEqual(send_notifications(), 0)
        self.assertIsNone(NotificacionSDI.objects.get().enviada)
