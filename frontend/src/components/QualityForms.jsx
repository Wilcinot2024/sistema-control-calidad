import React, { useState } from 'react';
import { digitsOnly, earliestEmissionDate, isValidEmissionDate, todayInSantiago } from './sdiFields';
import { articleText, boundedQuantity, nextProductOrder, productQuantity, stepQuantity } from './productFields';

// Opciones locales hasta conectar el catálogo de inspectores de la API.
export const demoInspectors = [{ id: 1, nombre: 'Felipe Soto' }];

function FormModal({ title, description, onClose, onSubmit, children, disabled = false, editing = false }) {
  const submit = event => {
    event.preventDefault();
    if (disabled) return;
    const form = event.currentTarget;
    for (const input of form.querySelectorAll('input[type="text"], textarea')) {
      input.value = input.value.trim();
    }
    if (form.reportValidity()) onSubmit(new FormData(form));
  };

  return <div className="modal-backdrop" onClick={onClose}>
    <form className="modal quality-form" role="dialog" aria-modal="true" aria-label={title} onSubmit={submit} onClick={event => event.stopPropagation()}>
      <div className="modal-head">
        <div><h2>{title}</h2><p>{description}</p></div>
        <button type="button" className="icon-button" aria-label="Cerrar" title="Cerrar el formulario" onClick={onClose}>×</button>
      </div>
      {children}
      <div className="demo-notice">Datos de demostración: este formulario se guarda en este navegador.</div>
      <div className="modal-actions">
        <button type="button" className="button button-outline" onClick={onClose}>Cancelar</button>
        <button type="submit" className="button button-primary" disabled={disabled}>{editing ? 'Guardar cambios' : title}</button>
      </div>
    </form>
  </div>;
}

function InspectorField({ inspectors, value, hint }) {
  return <label title={hint}>Inspector<select name="inspector" title={hint} required defaultValue={value ?? ''}>
    <option value="" disabled>Selecciona un inspector</option>
    {inspectors.map(inspector => <option key={inspector.id} value={inspector.id}>{inspector.nombre}</option>)}
  </select></label>;
}

function ObservacionesField({ value, hint }) {
  return <label title={hint}>Observaciones (opcional)<textarea name="observaciones" title={hint} rows="3" defaultValue={value ?? ''}/></label>;
}

export function DigitsField({ label, name, initial, maxLength, hint, autoFocus }) {
  const [value, setValue] = useState(() => digitsOnly(initial ?? '', maxLength));
  const paste = event => {
    event.preventDefault();
    const input = event.currentTarget;
    const digits = digitsOnly(event.clipboardData.getData('text'));
    if (!digits) return;
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? start;
    const available = maxLength === undefined ? digits.length : Math.max(0, maxLength - (value.length - (end - start)));
    setValue(value.slice(0, start) + digits.slice(0, available) + value.slice(end));
  };
  const keyDown = event => {
    if (!event.ctrlKey && !event.metaKey && event.key.length === 1 && !/^[0-9]$/.test(event.key)) event.preventDefault();
  };
  return <label title={hint}>{label}<input type="text" name={name} inputMode="numeric" pattern={maxLength ? `[0-9]{1,${maxLength}}` : '[0-9]+'} maxLength={maxLength} title={hint} required autoFocus={autoFocus} value={value} onKeyDown={keyDown} onChange={event => setValue(digitsOnly(event.currentTarget.value, maxLength))} onPaste={paste}/></label>;
}

export function EmissionDateField({ initial }) {
  const today = todayInSantiago();
  const earliest = earliestEmissionDate(today);
  const currentYear = today.slice(0, 4);
  const previousYear = earliest.slice(0, 4);
  const [value, setValue] = useState(() => isValidEmissionDate(initial ?? '', today) ? initial : '');
  const [error, setError] = useState('');
  const hint = `Fecha en que se emitió la solicitud. Solo admite los años ${previousYear} y ${currentYear}, hasta hoy, según la hora de Chile.`;
  const change = event => {
    const input = event.currentTarget;
    const next = input.value;
    if (next && !isValidEmissionDate(next)) {
      input.value = value;
      setError(`Ingresa una fecha válida del año ${previousYear} o ${currentYear}, que no sea posterior a hoy.`);
      return;
    }
    setValue(next);
    setError('');
  };
  return <>
    <label title={hint}>Fecha de emisión<input type="date" name="fecha_emision" title={hint} min={earliest} max={today} required value={value} onInput={change} onChange={change} aria-describedby={error ? 'fecha-emision-error' : undefined}/></label>
    {error && <p className="field-error" id="fecha-emision-error" role="alert">{error}</p>}
  </>;
}

export function SDIModal({ initial, inspectors, onClose, onSubmit }) {
  const data = initial ?? {};
  return <FormModal title={initial ? 'Editar SDI' : 'Crear SDI'} description="Registra la solicitud y asigna un inspector." onClose={onClose} editing={Boolean(initial)} onSubmit={form => onSubmit({
    prefijo_bod: form.get('prefijo_bod') === 'on',
    activacion_proyecto: form.get('activacion_proyecto'),
    numero_sdi: form.get('numero_sdi'),
    fecha_emision: form.get('fecha_emision'),
    proyecto: form.get('proyecto'),
    departamento_solicitante: form.get('departamento_solicitante'),
    solicitante: form.get('solicitante'),
    inspector: Number(form.get('inspector')),
    prioridad: form.get('prioridad'),
    observaciones: form.get('observaciones'),
  })}>
    <label className="checkbox-field" title="Marca esta opción si el código de la solicitud debe incluir el prefijo BOD."><input type="checkbox" name="prefijo_bod" title="Incluye BOD en el código de la SDI." defaultChecked={data.prefijo_bod ?? false}/> Usar prefijo BOD</label>
    <div className="form-row">
      <DigitsField label="Código de proyecto" name="activacion_proyecto" initial={data.activacion_proyecto} maxLength={6} hint="Código de activación del proyecto: entre 1 y 6 dígitos, sin letras ni signos. Conserva los ceros iniciales." autoFocus/>
      <DigitsField label="Número de SDI" name="numero_sdi" initial={data.numero_sdi} hint="Número de la solicitud de inspección: solo dígitos, sin letras ni signos. Conserva los ceros iniciales."/>
    </div>
    <EmissionDateField initial={data.fecha_emision}/>
    <label title="Nombre del proyecto al que pertenece la solicitud. Máximo 200 caracteres.">Proyecto<input type="text" name="proyecto" title="Nombre del proyecto al que pertenece la solicitud. Máximo 200 caracteres." maxLength={200} required defaultValue={data.proyecto ?? ''}/></label>
    <div className="form-row">
      <label title="Departamento que solicita la inspección. Máximo 150 caracteres.">Departamento solicitante<input type="text" name="departamento_solicitante" title="Departamento que solicita la inspección. Máximo 150 caracteres." maxLength={150} required defaultValue={data.departamento_solicitante ?? ''}/></label>
      <label title="Nombre de la persona que solicita la inspección. Máximo 150 caracteres.">Solicitante<input type="text" name="solicitante" title="Nombre de la persona que solicita la inspección. Máximo 150 caracteres." maxLength={150} required defaultValue={data.solicitante ?? ''}/></label>
    </div>
    <div className="form-row">
      <InspectorField inspectors={inspectors} value={data.inspector} hint="Inspector responsable de la SDI. Selecciona una persona del catálogo de demostración."/>
      <label title="Urgencia de la solicitud: baja, media o alta.">Prioridad<select name="prioridad" title="Urgencia de la solicitud: baja, media o alta." defaultValue={data.prioridad ?? 'media'}><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option></select></label>
    </div>
    <ObservacionesField value={data.observaciones} hint="Comentarios o antecedentes adicionales sobre la solicitud. Este campo es opcional."/>
  </FormModal>;
}

function ArticleField({ initial }) {
  const [value, setValue] = useState(() => articleText(initial ?? ''));
  const hint = 'Nombre o descripción del producto. Máximo 250 caracteres. Admite letras, números y espacios; solo puntos y guiones como signos.';
  const keyDown = event => {
    if (!event.ctrlKey && !event.metaKey && event.key.length === 1 && !/^[\p{L}\p{N} .-]$/u.test(event.key)) event.preventDefault();
  };
  const paste = event => {
    event.preventDefault();
    const input = event.currentTarget;
    const text = articleText(event.clipboardData.getData('text'));
    if (!text) return;
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? start;
    const available = Math.max(0, 250 - (value.length - (end - start)));
    setValue(value.slice(0, start) + text.slice(0, available) + value.slice(end));
  };
  return <label title={hint}>Artículo<input type="text" name="articulo" title={hint} maxLength={250} required value={value} onKeyDown={keyDown} onChange={event => setValue(articleText(event.currentTarget.value))} onPaste={paste}/></label>;
}

export function QuantityField({ id, name, label, hint, value, onChange, max = Number.MAX_SAFE_INTEGER, min = 1, disabled = false }) {
  const change = delta => {
    if (!disabled) onChange(current => stepQuantity(current, delta, max, min));
  };
  const keyDown = event => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      change(event.key === 'ArrowUp' ? 1 : -1);
    }
  };
  return <div className="quantity-field" title={hint}>
    <label htmlFor={id} title={hint}>{label}</label>
    <div className="quantity-stepper">
      {[-5, -1].map(delta => <button key={delta} type="button" aria-label={`Disminuir ${label.toLowerCase()} en ${-delta}`} title={`Disminuye ${-delta} ${delta === -1 ? 'unidad' : 'unidades'}, hasta el mínimo de ${min}.`} disabled={disabled || value <= min} onClick={() => change(delta)}><span className={delta === -5 ? 'quantity-double-sign' : undefined}>{delta === -5 ? '−−' : '−'}</span></button>)}
      <input id={id} type="number" name={name} title={hint} min={min} max={max} step={1} readOnly disabled={disabled} value={value} onKeyDown={keyDown}/>
      {[1, 5].map(delta => <button key={delta} type="button" aria-label={`Aumentar ${label.toLowerCase()} en ${delta}`} title={`Aumenta ${delta} ${delta === 1 ? 'unidad' : 'unidades'}${max === Number.MAX_SAFE_INTEGER ? '.' : `, hasta las ${max} disponibles.`}`} disabled={disabled || value >= max} onClick={() => change(delta)}><span className={delta === 5 ? 'quantity-double-sign' : undefined}>{delta === 5 ? '++' : '+'}</span></button>)}
    </div>
  </div>;
}

export function ProductoModal({ initial, sdis, productos, onClose, onSubmit }) {
  const data = initial ?? {};
  const [sdiId, setSdiId] = useState(data.sdi ?? '');
  const [cantidad, setCantidad] = useState(() => productQuantity(data.cantidad_a_inspeccionar ?? 1));
  const orden = initial ? data.orden : (sdiId ? nextProductOrder(productos, sdiId) : '');
  const sdiHint = 'Solicitud de inspección a la que pertenece el producto. Selecciona una SDI para calcular su orden.';
  const ordenHint = 'Posición del producto dentro de esta SDI. Se asigna automáticamente después del último orden y no se puede editar.';
  const planoHint = 'Código del plano asociado al producto, si corresponde. Campo opcional, máximo 150 caracteres.';
  return <FormModal title={initial ? 'Editar producto' : 'Agregar producto'} description="Agrega un artículo a una SDI." onClose={onClose} editing={Boolean(initial)} disabled={!sdis.length} onSubmit={form => onSubmit({
    sdi: Number(sdiId),
    orden,
    articulo: form.get('articulo'),
    cantidad_a_inspeccionar: cantidad,
    codigo_plano: form.get('codigo_plano'),
    observaciones: form.get('observaciones'),
  })}>
    <label title={sdiHint}>SDI<select name="sdi" title={sdiHint} required disabled={Boolean(initial)} value={sdiId} onChange={event => setSdiId(event.target.value)} autoFocus>
      <option value="" disabled>Selecciona una SDI</option>
      {sdis.map(sdi => <option key={sdi.localId} value={sdi.localId}>{sdi.id} · {sdi.data.proyecto}</option>)}
    </select></label>
    {!sdis.length && <p className="form-hint" role="status">Primero crea una SDI para poder agregar sus productos.</p>}
    <ArticleField initial={data.articulo}/>
    <div className="form-row">
      <label title={ordenHint}>Orden dentro de la SDI<input type="text" name="orden" title={ordenHint} placeholder="Selecciona una SDI" readOnly value={orden}/></label>
      <QuantityField id="cantidad-producto" name="cantidad_a_inspeccionar" label="Cantidad a inspeccionar" hint="Unidades del producto que se deben inspeccionar. − y + cambian 1 unidad; −− y ++ cambian 5. Mínimo 1. Las flechas del teclado cambian una unidad." value={cantidad} onChange={setCantidad}/>
    </div>
    <label title={planoHint}>Código de plano (opcional)<input type="text" name="codigo_plano" title={planoHint} maxLength={150} defaultValue={data.codigo_plano ?? ''}/></label>
    <ObservacionesField value={data.observaciones} hint="Comentarios o antecedentes adicionales del producto. Este campo es opcional."/>
  </FormModal>;
}

export function InspeccionModal({ initial, productos, sdis, inspectors, onClose, onSubmit }) {
  const data = initial ?? {};
  const [itemId, setItemId] = useState(data.item ?? '');
  const [cantidad, setCantidad] = useState(() => productQuantity(data.cantidad_inspeccionada ?? 1));
  const producto = productos.find(item => item.localId === Number(itemId));
  const restantes = producto ? Math.max(0, producto.data.cantidad_a_inspeccionar - (producto.data.unidades_liberadas ?? 0)) : undefined;
  const cantidadVisible = boundedQuantity(cantidad, restantes);
  const changeProduct = event => {
    const nextId = event.target.value;
    const next = productos.find(item => item.localId === Number(nextId));
    setItemId(nextId);
    setCantidad(current => boundedQuantity(current, next.data.cantidad_a_inspeccionar - (next.data.unidades_liberadas ?? 0)));
  };
  return <FormModal title={initial ? 'Editar inspección' : 'Iniciar inspección'} description="Selecciona el producto, el inspector y las unidades a revisar." onClose={onClose} editing={Boolean(initial)} disabled={!producto || restantes < 1} onSubmit={form => onSubmit({
    item: Number(itemId),
    inspector: Number(form.get('inspector')),
    cantidad_inspeccionada: cantidadVisible,
    observaciones: form.get('observaciones'),
  })}>
    <label>Producto<select name="item" required disabled={Boolean(initial)} value={itemId} onChange={changeProduct} autoFocus>
      <option value="" disabled>Selecciona un producto</option>
      {productos.map(item => <option key={item.localId} value={item.localId}>{sdis.find(sdi => sdi.localId === item.data.sdi)?.id} · {item.data.orden} · {item.data.articulo}</option>)}
    </select></label>
    {!productos.length && <p className="form-hint" role="status">Primero agrega un producto a una SDI.</p>}
    <InspectorField inspectors={inspectors} value={data.inspector}/>
    <QuantityField id="cantidad-inspeccion" name="cantidad_inspeccionada" label="Cantidad inspeccionada" hint="Unidades que se revisarán en esta inspección. − y + cambian 1 unidad; −− y ++ cambian 5. Mínimo 1 y máximo las unidades restantes. Las flechas del teclado cambian una unidad." value={cantidadVisible} onChange={setCantidad} max={restantes} disabled={!producto || restantes < 1}/>
    {producto && <p className="form-hint">Unidades restantes del producto: {restantes}.</p>}
    {producto && restantes < 1 && <p className="form-hint" role="status">Este producto no tiene unidades disponibles para inspeccionar.</p>}
    <ObservacionesField value={data.observaciones}/>
  </FormModal>;
}
