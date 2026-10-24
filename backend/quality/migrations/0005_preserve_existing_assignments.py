from django.db import migrations


def preserve_assignments(apps, schema_editor):
    SDI = apps.get_model('quality', 'SDI')
    Inspection = apps.get_model('quality', 'InspeccionSDI')
    for sdi in SDI.objects.filter(inspector__isnull=False).iterator():
        # Conserva el acceso a trabajos existentes. Una SDI sin inspecciones
        # permanece en recepción hasta que se confirme la asignación.
        first = Inspection.objects.filter(item__sdi_id=sdi.pk).order_by('creada').first()
        if first or sdi.estado == 'cerrada':
            SDI.objects.filter(pk=sdi.pk).update(asignada=first.creada if first else sdi.creada,
                resultado_cierre=sdi.resultado_cierre or '')


class Migration(migrations.Migration):
    dependencies = [('quality', '0004_itemsdi_cantidad_indicada_itemsdi_descripcion_and_more')]
    operations = [migrations.RunPython(preserve_assignments, migrations.RunPython.noop)]
