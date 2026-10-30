"""Lectura de documentos: validación común y extracción revisable FR-OPE-133."""

from .pdf_intake import extract_proposal


def propuesta(content):
    texto, datos = extract_proposal(content)
    from .fr_ope_parser import extraer_datos_generales_sdi, extraer_articulos_sdi
    advertencias = list(datos.get("advertencias", []))
    try:
        generales = extraer_datos_generales_sdi(texto)
        datos["campos"].update(generales)
    except ValueError as exc:
        advertencias.append(str(exc))
    try:
        articulos = extraer_articulos_sdi(texto)
        if articulos:
            datos["productos"] = [dict(p, cantidad_indicada=p["cantidad_a_inspeccionar"]) for p in articulos]
    except ValueError as exc:
        advertencias.append(str(exc))
    datos["advertencias"] = list(dict.fromkeys(advertencias))
    return datos
