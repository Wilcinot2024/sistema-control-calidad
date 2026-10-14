import React, { useEffect, useState } from 'react';
import { api, login, hasSession, clearSession, downloadFile } from '../api/workflow';
import { DigitsField, EmissionDateField, QuantityField } from '../components/QualityForms';
import { articleText } from '../components/productFields';
import { dashboardDate } from './dashboardData';
import RecordActionDialog from '../components/RecordActionDialog';
import Icon from '../components/Icon';
import { canManage, canWorkInspection, resultAvailability } from './workflowAvailability';

const criteria = ['rebarbas', 'rayaduras', 'golpes', 'deformidad', 'pintura', 'burbujas', 'planitud'];
const label = value => (value || '').replaceAll('_', ' ');
const formData = event => Object.fromEntries(new FormData(event.currentTarget));

function ProductEditor({ initial = {}, onSave, onCancel }) {
  const [article, setArticle] = useState(initial.articulo || '');
  const [indicated, setIndicated] = useState(initial.cantidad_indicada ?? '');
  const [quantity, setQuantity] = useState(initial.cantidad_a_inspeccionar || 1);
  return <form className="workflow-form" onSubmit={event => { event.preventDefault(); onSave({ ...formData(event), articulo: article, cantidad_indicada: indicated === '' ? null : Number(indicated), cantidad_a_inspeccionar: quantity }); }}>
    <label title="El backend asigna el siguiente orden dentro de esta SDI; se conserva al editar.">Orden<input value={initial.orden} readOnly aria-readonly="true"/></label>
    <label title="Nombre del producto; letras, números, espacios, puntos y guiones.">Artículo<input required maxLength={250} value={article} onChange={e => setArticle(articleText(e.target.value))}/></label>
    <label title="Texto descriptivo del producto recibido.">Descripción<textarea name="descripcion" defaultValue={initial.descripcion}/></label>
    <label title="Cantidad indicada por Producción/Bodega en la documentación; no es la cantidad a inspeccionar.">Cantidad indicada<input type="number" min="1" step="1" value={indicated} onChange={e => { const next = e.target.value; setIndicated(next); if (Number(next) > 0) setQuantity(q => Math.min(q, Number(next))); }}/></label>
    <QuantityField id={`quantity-${initial.id || 'new'}`} label="Cantidad a inspeccionar" hint="Mínimo 1, hasta la cantidad indicada. + cambia 1; ++ cambia 5." value={quantity} onChange={setQuantity} max={Number(indicated) || Number.MAX_SAFE_INTEGER}/>
    <label title="Referencia del plano técnico, si corresponde.">Código de plano<input name="codigo_plano" maxLength={150} defaultValue={initial.codigo_plano}/></label>
    <label title="Indicaciones específicas para este producto.">Observaciones<textarea name="observaciones" defaultValue={initial.observaciones}/></label>
    <div className="workflow-actions"><button className="button button-primary">Guardar producto</button><button type="button" className="button button-outline" onClick={onCancel}>Cancelar</button></div>
  </form>;
}

function InspectionEditor({ inspection, run }) {
  const [approved, setApproved] = useState(inspection.cantidad_inspeccionada);
  return <div className="inspection-editor">
    <form className="workflow-form" onSubmit={event => { event.preventDefault(); const data = formData(event); run(async () => {
      await api(`/api/inspecciones/${inspection.id}/visual/`, { method: 'POST', data });
      await api(`/api/inspecciones/${inspection.id}/aprobar/`, { method: 'POST', data: { cantidad_aprobada: approved } });
    }); }}>
      <p>Inspeccionadas: <strong>{inspection.cantidad_inspeccionada}</strong>. Indicaciones: {inspection.observaciones || 'Sin observaciones adicionales.'}</p>
      <div className="workflow-grid">{criteria.map(field => <label key={field} title={`Resultado de la revisión de ${field}.`}>{label(field)}<select required name={field} defaultValue={inspection.visual?.[field] || ''}><option value="" disabled>Selecciona</option><option value="conforme">Conforme</option><option value="no_conforme">No conforme</option><option value="no_aplica">No aplica</option></select></label>)}</div>
      <label title="Resultados y observaciones de la inspección visual.">Observaciones<textarea name="observaciones" defaultValue={inspection.visual?.observaciones}/></label>
      <QuantityField id={`approved-${inspection.id}`} label="Cantidad aprobada" hint="Unidades conformes; 0 rechaza toda la inspección. + cambia 1; ++ cambia 5. Máximo las unidades inspeccionadas." min={0} max={inspection.cantidad_inspeccionada} value={approved} onChange={setApproved}/>
      <button className="button button-primary">Finalizar inspección</button>
    </form>
    <form className="workflow-form" onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); run(() => api(`/api/inspecciones/${inspection.id}/evidencias/`, { method: 'POST', data })); }}>
      <label>Evidencia (hasta 20 MB)<input type="file" name="archivo" required/></label><label>Tipo<select name="tipo"><option value="foto">Foto</option><option value="documento">Documento</option><option value="otro">Otro</option></select></label><label>Descripción<input name="descripcion"/></label><button className="button button-outline">Adjuntar evidencia</button>
    </form>
  </div>;
}

function Detail({ sdi, user, manager, inspectors, run, busy }) {
  const [product, setProduct] = useState(null);
  const [action, setAction] = useState(null);
  const [preview, setPreview] = useState(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  const pending = !sdi.asignada && sdi.estado === 'pendiente';
  const open = !['cerrada', 'anulada'].includes(sdi.estado);
  const availability = resultAvailability(sdi);
  const proposal = sdi.datos_pdf || {};
  const base = { ...proposal.campos, ...Object.fromEntries(Object.entries(sdi).filter(([, value]) => value !== null && value !== '')) };
  const mutate = (path, data, method = 'POST') => run(() => api(path, { method, data }));
  return <section className="workflow-detail">
    <div className="workflow-heading"><div><h2 title="SDI: solicitud que agrupa sus productos, inspecciones y documentación"><Icon name="sdi"/> {sdi.codigo_sdi}</h2><p>{sdi.proyecto || 'Datos pendientes de revisión'} · {sdi.inspector_nombre}</p></div><span className="workflow-status">{sdi.estado_nombre}</span></div>
    <ol className="workflow-steps"><li className="done">Recibida</li><li className={sdi.asignada ? 'done' : ''}>Asignada</li><li className={sdi.revisada ? 'done' : ''}>Resultados revisados</li><li className={!open ? 'done' : ''}>{sdi.estado === 'anulada' ? 'Anulada' : 'Cerrada'}</li></ol>
    {sdi.anulada && <p className="workflow-note"><strong>SDI anulada:</strong> {sdi.motivo_anulacion} · {new Date(sdi.anulada).toLocaleString('es-CL')}</p>}
    {sdi.archivada && <p className="workflow-note">Archivada desde {new Date(sdi.archivada).toLocaleString('es-CL')}. Se conserva su estado y documentación.</p>}
    {manager && <div className="workflow-actions">
      {pending && !sdi.archivada && <button className="button button-outline" onClick={() => setAction({ title: 'Anular SDI', description: 'La solicitud quedará anulada por error o duplicidad. Se conservarán el PDF, los productos y el historial. Esta acción no se revierte.', needsReason: true, path: `/api/sdi/${sdi.id}/anular/` })}>Anular SDI</button>}
      {(!pending || sdi.archivada) && <button className="button button-outline" onClick={() => setAction({ title: sdi.archivada ? 'Restaurar SDI' : 'Archivar SDI', description: sdi.archivada ? 'La SDI volverá a la vista correspondiente a su estado; una SDI anulada seguirá anulada.' : 'La SDI y sus productos e inspecciones saldrán de la vista habitual. Su estado no cambia y podrás restaurarla desde Archivadas.', path: `/api/sdi/${sdi.id}/archivo/`, data: { archivar: !sdi.archivada } })}>{sdi.archivada ? 'Restaurar SDI' : 'Archivar SDI'}</button>}
    </div>}
    {action && <RecordActionDialog {...action} busy={busy} onClose={() => setAction(null)} onConfirm={motivo => mutate(action.path, action.needsReason ? { motivo } : action.data, action.method || 'POST')}/>}
    <p>Origen: {label(sdi.origen)} {sdi.correo_origen && `· ${sdi.correo_origen}`} {sdi.asunto_correo && `· ${sdi.asunto_correo}`}</p>
    <div className="workflow-actions">{sdi.documentos.map(doc => <React.Fragment key={doc.id}><button className="button button-outline" onClick={() => run(async () => setPreview({ nombre: doc.nombre, url: URL.createObjectURL(await api(doc.archivo, { file: true })) }), false)}>Ver PDF: {doc.nombre}</button><button className="button button-outline" onClick={() => run(() => downloadFile(doc.archivo, doc.nombre), false)}>Descargar PDF</button></React.Fragment>)}</div>
    {preview && <div className="document-preview"><div className="workflow-heading"><strong>{preview.nombre}</strong><button className="button button-outline" onClick={() => setPreview(null)}>Cerrar documento</button></div><iframe title={`Documento PDF ${preview.nombre}`} src={preview.url}/></div>}
    {!!proposal.advertencias?.length && <div className="workflow-note">{proposal.advertencias.map((text, i) => <p key={i}>{text}</p>)}</div>}
    {pending && manager && <>
      <h3>Revisar datos de recepción</h3><p>La lectura del PDF propone datos. Revisa y confirma antes de asignar.</p>
      <form className="workflow-form" onSubmit={e => { e.preventDefault(); const data = formData(e); data.prefijo_bod = data.prefijo_bod === 'on'; mutate(`/api/sdi/${sdi.id}/`, data, 'PATCH'); }}>
        <div className="workflow-grid"><DigitsField label="Activación proyecto" name="activacion_proyecto" initial={base.activacion_proyecto} maxLength={6} hint="Entre 1 y 6 dígitos; conserva ceros iniciales."/><DigitsField label="Número SDI" name="numero_sdi" initial={base.numero_sdi} hint="Solo dígitos."/><EmissionDateField initial={base.fecha_emision}/><label title="Nombre del proyecto relacionado.">Proyecto<input name="proyecto" maxLength={200} required defaultValue={base.proyecto}/></label><label title="Departamento de quien solicita, independiente del área del inspector.">Departamento solicitante<input name="departamento_solicitante" maxLength={150} required defaultValue={base.departamento_solicitante}/></label><label title="Persona que solicita la inspección.">Solicitante<input name="solicitante" maxLength={150} required defaultValue={base.solicitante}/></label><label title="Destinatario de los avisos de asignación y cierre.">Correo Producción/Bodega<input name="correo_origen" type="email" required defaultValue={sdi.correo_origen}/></label><label>Prioridad<select name="prioridad" defaultValue={sdi.prioridad}><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option></select></label></div>
        <label className="workflow-check"><input type="checkbox" name="prefijo_bod" defaultChecked={base.prefijo_bod}/>Prefijo BOD</label><label>Observaciones<textarea name="observaciones" defaultValue={sdi.observaciones}/></label><button className="button button-primary">Confirmar datos</button>
      </form>
      {!!proposal.productos?.length && <details><summary>Productos propuestos por el PDF ({proposal.productos.length})</summary>{proposal.productos.map((item, i) => <div className="proposal-row" key={i}><span>{item.articulo} · indicada: {item.cantidad_indicada ?? 'sin identificar'}</span><button className="button button-outline" onClick={() => setProduct({ ...item, cantidad_a_inspeccionar: 1 })}>Revisar y agregar</button></div>)}</details>}
    </>}
    <h3>Productos ({sdi.productos.length})</h3>
    {pending && manager && <button className="button button-outline" onClick={() => setProduct({})}>Agregar producto</button>}
    {product && <ProductEditor key={product.id || product.articulo || 'new'} initial={{ orden: Math.max(0, ...sdi.productos.map(item => item.orden)) + 1, ...product }} onCancel={() => setProduct(null)} onSave={data => run(async () => { await api(product.id ? `/api/items/${product.id}/` : `/api/sdi/${sdi.id}/items/`, { method: product.id ? 'PATCH' : 'POST', data }); setProduct(null); })}/>}
    {sdi.productos.map(item => <article className="workflow-product" key={item.id}>
      <div className="workflow-heading"><h4 title="Producto perteneciente a esta SDI"><Icon name="product" size={16}/> {item.orden}. {item.articulo}</h4><span>{item.resultado_nombre}</span></div><p>{item.descripcion}</p><p>Indicada: {item.cantidad_indicada ?? 'sin indicar'} · A inspeccionar: {item.cantidad_a_inspeccionar} · Liberadas: {item.unidades_liberadas} · Restantes: {item.unidades_restantes}</p>
      {pending && manager && <div className="workflow-actions"><button className="button button-outline" onClick={() => setProduct(item)}>Editar</button>{!item.inspecciones.length && <button className="button button-outline" onClick={() => setAction({ title: 'Retirar producto', description: `Se retirará «${item.articulo}» de esta SDI pendiente. El PDF original se conserva y la retirada quedará en el historial.`, path: `/api/items/${item.id}/`, method: 'DELETE' })}>Retirar producto</button>}</div>}
      {item.inspecciones.map(inspection => <details key={inspection.id} open={inspection.resultado === 'en_proceso'}><summary title="Inspección de este producto: responsable y resultado registrados en el backend"><Icon name="check" size={16}/> Inspección {inspection.numero_inspeccion} · {inspection.resultado_nombre} · {inspection.inspector_nombre}</summary>
        {canWorkInspection(sdi, inspection, user) ? <InspectionEditor inspection={inspection} run={run}/> : <div>{inspection.resultado === 'en_proceso' ? <p>Inspección en proceso. Solo el inspector responsable o Jefe/Supervisor pueden registrar sus resultados.</p> : <p>Aprobadas: {inspection.cantidad_aprobada} / {inspection.cantidad_inspeccionada}</p>}{inspection.visual && <><p>Visual: {label(inspection.visual.resultado_visual)} · {inspection.visual.observaciones}</p><dl className="visual-results">{criteria.map(field => <div key={field}><dt>{label(field)}</dt><dd>{label(inspection.visual[field])}</dd></div>)}</dl></>}</div>}
        <div className="workflow-actions">{inspection.evidencias.map(file => <button className="button button-outline" key={file.id} onClick={() => run(() => downloadFile(file.archivo, file.nombre), false)}>{file.nombre}</button>)}</div>
        {manager && open && ['rechazada','parcial'].includes(inspection.resultado) && inspection.id === item.inspecciones.at(-1)?.id && !inspection.concesiones.some(c => c.decision === 'solicitada') && <form className="workflow-form" onSubmit={e => { e.preventDefault(); mutate(`/api/inspecciones/${inspection.id}/concesiones/`, formData(e)); }}><h4>Solicitar concesión</h4><label>Responsable de ingeniería<input required name="responsable_ingenieria" maxLength={150}/></label><label>Justificación<textarea required name="justificacion"/></label><button className="button button-outline">Registrar solicitud</button></form>}
        {inspection.concesiones.map(c => <div key={c.id}><p>Concesión: {label(c.decision)} · {c.justificacion}</p>{manager && open && c.decision === 'solicitada' && <div className="workflow-actions"><button className="button button-outline" onClick={() => mutate(`/api/concesiones/${c.id}/resolver/`, { decision: 'aprobada' }, 'PATCH')}>Aprobar concesión</button><button className="button button-outline" onClick={() => mutate(`/api/concesiones/${c.id}/resolver/`, { decision: 'rechazada' }, 'PATCH')}>Rechazar concesión</button></div>}</div>)}
      </details>)}
      {manager && open && sdi.asignada && item.unidades_restantes > 0 && item.inspecciones.every(i => i.resultado !== 'en_proceso') && <Reinspection item={item} sdi={sdi} mutate={mutate}/>}
    </article>)}
    {pending && manager && <form className="workflow-form workflow-assignment" onSubmit={e => { e.preventDefault(); const data = formData(e); mutate(`/api/sdi/${sdi.id}/asignar/`, { ...data, inspector: Number(data.inspector) }); }}><h3>Asignar SDI</h3><label title="Inspector activo que podrá acceder a esta SDI después de asignar.">Inspector<select required name="inspector" defaultValue=""><option value="" disabled>Selecciona</option>{inspectors.filter(i => i.is_active && i.perfil_activo).map(i => <option key={i.id} value={i.id}>{i.first_name || i.username} {i.last_name} {i.area ? `· ${i.area.nombre}` : ''}</option>)}</select></label><label title="Instrucciones que acompañan a todas las inspecciones de esta SDI.">Instrucciones<textarea name="instrucciones" defaultValue={sdi.instrucciones}/></label><button className="button button-primary">Asignar e iniciar inspecciones</button></form>}
    {sdi.instrucciones && <p><strong>Instrucciones:</strong> {sdi.instrucciones}</p>}
    {manager && open && sdi.asignada && <form className="workflow-form" onSubmit={e => { e.preventDefault(); if (availability.canReview) mutate(`/api/sdi/${sdi.id}/revisar/`, formData(e)); }}><h3>Revisión de Jefe / Supervisor</h3><label>Comentario de revisión<textarea name="comentario" defaultValue={sdi.comentario_revision}/></label><button className="button button-primary" disabled={!availability.canReview} title={availability.reviewReason || "Registrar la revisión de Jefe/Supervisor"}>Confirmar revisión de resultados</button>{availability.reviewReason && <p role="status" className="workflow-rule-hint">{availability.reviewReason}</p>}</form>}
    {sdi.revisada && <p>Resultados revisados: {new Date(sdi.revisada).toLocaleString('es-CL')} · {sdi.comentario_revision}</p>}
    {manager && open && sdi.revisada && <div className="workflow-close"><button className="button button-primary" disabled={!availability.canClose} title={availability.closeReason || "Cerrar la SDI después de revisar y resolver sus productos"} onClick={() => mutate(`/api/sdi/${sdi.id}/cerrar/`, { comentario: sdi.comentario_revision })}>Cerrar SDI</button>{availability.closeReason && <p role="status" className="workflow-rule-hint">{availability.closeReason}</p>}</div>}
    {sdi.estado === 'cerrada' && <p><strong>Resultado de cierre: {label(sdi.resultado_cierre)}</strong> · {new Date(sdi.fecha_cierre).toLocaleString('es-CL')}</p>}
    <details><summary>Historial y trazabilidad ({sdi.historial.length})</summary><ol className="workflow-history">{sdi.historial.map(event => <li key={event.id}><strong>{event.accion}</strong> · {event.usuario_username || 'Sistema'} · {new Date(event.fecha).toLocaleString('es-CL')}<p>{event.comentario}</p></li>)}</ol></details>
    {manager && <details><summary>Avisos por correo ({sdi.notificaciones.length})</summary>{sdi.notificaciones.map((notice, i) => <p key={i}>{label(notice.evento)} → {notice.destinatario || 'sin destinatario'} · {notice.enviada ? 'Entregado al servidor de correo' : 'En cola'} · Intentos: {notice.intentos} {notice.error}</p>)}<p>El envío requiere configurar el proveedor y ejecutar el proceso de correo.</p></details>}
  </section>;
}

function Reinspection({ item, sdi, mutate }) {
  const [quantity, setQuantity] = useState(item.unidades_restantes);
  return <form className="workflow-form" onSubmit={e => { e.preventDefault(); mutate(`/api/items/${item.id}/reinspecciones/`, { inspector: sdi.inspector, cantidad_inspeccionada: quantity, observaciones: formData(e).observaciones }); }}><QuantityField id={`reinspection-${item.id}`} label="Cantidad a reinspeccionar" hint="Unidades pendientes de liberar; mínimo 1 y máximo las restantes." value={quantity} max={item.unidades_restantes} onChange={setQuantity}/><label>Instrucciones de reinspección<textarea name="observaciones"/></label><button className="button button-outline">Crear reinspección</button></form>;
}

export default function OperationalApp() {
  const [user, setUser] = useState(null), [records, setRecords] = useState([]), [detail, setDetail] = useState(null);
  const [inspectors, setInspectors] = useState([]), [areas, setAreas] = useState([]), [area, setArea] = useState('');
  const [view, setView] = useState('activas');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [date, setDate] = useState(() => dashboardDate()), [summary, setSummary] = useState(null);
  const manager = canManage(user);
  const refresh = async id => { setRecords(await api(`/api/sdi/?vista=${view}`)); setSummary(await api('/api/dashboard/')); if (id) setDetail(await api(`/api/sdi/${id}/`)); };
  const run = async (action, reload = true) => { setBusy(true); setError(''); try { await action(); if (reload) await refresh(detail?.id); } catch (e) { setError(e.message); if (!hasSession()) setUser(null); } finally { setBusy(false); } };
  useEffect(() => { const timer = setInterval(() => setDate(dashboardDate()), 60000); if (hasSession()) run(async () => setUser(await api('/api/me/')), false); return () => clearInterval(timer); }, []);
  useEffect(() => { if (user?.activo) run(async () => { await refresh(); setAreas(await api('/api/areas/')); if (user.rol !== 'inspector') setInspectors(await api('/api/inspectores/')); }, false); }, [user]);
  useEffect(() => { if (user?.activo) run(() => refresh(), false); }, [view]);
  if (!user) return <main className="login-page operational-login"><section className="login-card"><div className="login-brand"><strong>ANCOR<span>.</span></strong></div><h1>Sistema de calidad</h1><p>Inicia sesión con el nombre de usuario y la contraseña creados en el backend. Tu perfil determina qué solicitudes puedes ver y qué acciones puedes realizar.</p>{error && <p role="alert" className="workflow-error">{error}</p>}<form onSubmit={e => { e.preventDefault(); const data = formData(e); run(async () => { const profile = await login(data.username, data.password); if (!profile.activo || !profile.rol) { clearSession(); throw new Error('Tu usuario necesita un perfil activo.'); } setUser(profile); }, false); }}><label>Usuario<input required name="username" autoComplete="username"/></label><label>Contraseña<input required name="password" type="password" autoComplete="current-password"/></label><button className="button button-primary login-submit" disabled={busy}>Ingresar</button></form><p className="login-note">Los usuarios se crean en el backend. La demostración sigue disponible arriba.</p></section></main>;
  const shown = records.filter(sdi => !area || String(sdi.area_inspector?.id) === area);
  return <main className={`operational-app ${busy ? 'workflow-busy' : ''}`}><header className="operational-header"><div><strong>ANCOR · Control de calidad</strong><p>{date} · {user.first_name || user.username} · {user.rol_nombre}</p></div><button className="button button-outline" onClick={() => { clearSession(); setUser(null); setDetail(null); setRecords([]); }}>Cerrar sesión</button></header>
    {error && <div role="alert" className="workflow-error">{error}</div>}{busy && <p role="status">Procesando…</p>}
    <p className="operational-intro">{manager ? 'Gestiona las solicitudes SDI desde su recepción hasta el cierre: revisa el PDF y los productos, confirma las cantidades a inspeccionar y asigna un inspector. Después podrás revisar los resultados y consultar la trazabilidad, las solicitudes anuladas y los registros archivados.' : 'Consulta las SDI que te han asignado, revisa el PDF y las instrucciones de cada producto y registra los resultados, observaciones y evidencias de tu inspección. Las vistas permiten consultar también tus solicitudes archivadas, conservando su información.'}</p>
    <div className="workflow-summary">{[['SDI pendientes', summary?.pendientes ?? 0], ['SDI en proceso', summary?.en_proceso?.SDI ?? 0], ['SDI cerradas', summary?.cerradas ?? 0]].map(([name, count]) => <div key={name}><span>{name}</span><strong>{count}</strong></div>)}</div>
    {summary && <p className="workflow-counts">En proceso por entidad: <strong>{summary.en_proceso.SDI} SDI</strong> · <strong>{summary.en_proceso.Producto} productos</strong> · <strong>{summary.en_proceso.Inspección} inspecciones</strong>{manager && <> · <strong>{summary.por_revisar ?? 0} SDI con resultados por revisar</strong></>}</p>}
    <div className="workflow-layout"><aside className="workflow-sidebar"><div className="workflow-heading"><h2>Solicitudes SDI</h2><button className="button button-outline" onClick={() => run(() => refresh(detail?.id), false)}>Actualizar</button></div><label>Área del inspector<select value={area} onChange={e => setArea(e.target.value)}><option value="">Todas las áreas</option>{areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></label>
      {manager && <details><summary>Recibir una SDI</summary><form className="workflow-form" onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); run(async () => { setDetail(await api('/api/sdi/recepcion/', { method: 'POST', data })); await refresh(); }, false); }}><label>PDF (hasta 20 MB)<input type="file" name="archivo" accept="application/pdf,.pdf" required/></label><label>Correo de origen<input type="email" name="correo_origen"/></label><button className="button button-primary">Recibir PDF</button></form><button className="button button-outline" onClick={() => run(async () => { setDetail(await api('/api/sdi/', { method: 'POST', data: {} })); await refresh(); }, false)}>Crear SDI manual</button></details>}
      <label>Vista de solicitudes<select value={view} onChange={event => { setDetail(null); setView(event.target.value); }}><option value="activas">Activas</option><option value="anuladas">Anuladas</option><option value="archivadas">Archivadas</option><option value="todas">Todas (incluye historial)</option></select></label>
      <div className="workflow-list">{shown.map(sdi => <button className={detail?.id === sdi.id ? 'selected' : ''} key={sdi.id} onClick={() => run(async () => setDetail(await api(`/api/sdi/${sdi.id}/`)), false)}><strong><Icon name="sdi" size={16}/> {sdi.codigo_sdi}</strong><span>{sdi.proyecto || 'Pendiente de revisión'}</span><small>{sdi.estado_nombre}{sdi.archivada ? ' · Archivada' : ''} · {sdi.inspector_nombre}</small></button>)}{!shown.length && <p>No hay SDI visibles con este filtro.</p>}</div></aside>
      {detail ? <Detail key={`${detail.id}-${detail.actualizada}`} sdi={detail} user={user} manager={manager} inspectors={inspectors} run={run} busy={busy}/> : <section className="workflow-detail workflow-empty"><h2>{manager ? 'Revisa, asigna y cierra tus SDI' : 'Tus inspecciones asignadas'}</h2><p>{manager ? 'Selecciona una solicitud o recibe su PDF para comenzar.' : 'Las solicitudes aparecen aquí cuando Jefe/Supervisor te las asigna.'}</p></section>}
    </div></main>;
}
