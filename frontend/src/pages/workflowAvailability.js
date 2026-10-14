// La API vuelve a validar estas condiciones al ejecutar cada acción.
export function canManage(user) {
  return Boolean(user?.activo && ['administrador', 'jefe_calidad', 'supervisor'].includes(user.rol));
}

export function canWorkInspection(sdi, inspection, user) {
  return Boolean(sdi.asignada && !['cerrada', 'anulada'].includes(sdi.estado)
    && inspection.resultado === 'en_proceso' && user?.activo
    && (canManage(user) || (user.rol === 'inspector' && inspection.inspector === user.id)));
}

export function resultAvailability(sdi) {
  const products = sdi.productos || [];
  const inspections = products.flatMap(product => product.inspecciones || []);
  let reviewReason = '';
  if (!sdi.asignada || ['cerrada', 'anulada'].includes(sdi.estado)) {
    reviewReason = 'Solo se revisan SDI asignadas y abiertas.';
  } else if (!inspections.length || inspections.some(inspection => inspection.resultado === 'en_proceso')) {
    reviewReason = 'Finaliza todas las inspecciones antes de revisar los resultados.';
  }
  let closeReason = reviewReason;
  if (!closeReason && (!sdi.revisada || !sdi.revisada_por)) {
    closeReason = 'Jefe/Supervisor debe confirmar la revisión de resultados antes del cierre.';
  }
  if (!closeReason && inspections.some(inspection => Date.parse(inspection.actualizada) > Date.parse(sdi.revisada))) {
    closeReason = 'Los resultados cambiaron después de la revisión. Vuelve a revisarlos.';
  }
  if (!closeReason && (!products.length || products.some(product => !['aprobada', 'rechazada', 'concesion'].includes(product.resultado_actual)))) {
    closeReason = 'Resuelve los productos pendientes, en proceso o con resultado parcial antes de cerrar.';
  }
  if (!closeReason && inspections.some(inspection => inspection.concesiones?.some(concession => concession.decision === 'solicitada'))) {
    closeReason = 'Resuelve las concesiones pendientes antes de cerrar.';
  }
  return { canReview: !reviewReason, reviewReason, canClose: !closeReason, closeReason };
}
