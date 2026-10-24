import React, { useEffect, useRef, useState } from 'react';

export default function RecordActionDialog({ title, description, needsReason = false, busy = false, onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const reasonRef = useRef(null);
  useEffect(() => {
    const close = event => { if (event.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [busy, onClose]);
  const submit = event => {
    event.preventDefault();
    if (busy) return;
    if (needsReason && !reason.trim()) {
      setError('Escribe un motivo de anulación. Este campo no puede estar vacío ni contener solo espacios.');
      reasonRef.current?.focus();
      return;
    }
    setError('');
    onConfirm(reason.trim());
  };
  return <div className="modal-backdrop"><form noValidate className="modal record-action-modal" role="dialog" aria-modal="true" aria-labelledby="record-action-title" aria-describedby="record-action-description" onSubmit={submit}>
    <div className="modal-head"><h2 id="record-action-title">{title}</h2></div>
    <p id="record-action-description">{description}</p>
    {needsReason && <label>Motivo de anulación<textarea ref={reasonRef} autoFocus required maxLength={1000} rows={4} value={reason} disabled={busy} aria-invalid={!!error} aria-describedby={error ? 'record-reason-error' : undefined} onChange={event => { setReason(event.target.value); if (event.target.value.trim()) setError(''); }} placeholder="Explica si es una solicitud duplicada o recibida por error."/>{error && <span id="record-reason-error" className="record-field-error" role="alert">{error}</span>}</label>}
    <div className="modal-actions"><button type="button" autoFocus={!needsReason} className="button button-outline" disabled={busy} onClick={onClose}>Cancelar</button><button className="button button-primary" disabled={busy}>{busy ? 'Procesando…' : title}</button></div>
  </form></div>;
}
