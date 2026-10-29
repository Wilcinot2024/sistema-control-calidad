
import re  # Permite identificar los campos del formulario mediante patrones.
from datetime import datetime  # Convierte la fecha del PDF a una fecha válida.

# Meses utilizados en los formularios FR-OPE-133.
MESES = {
    "ene": 1, "feb": 2, "mar": 3, "abr": 4,
    "may": 5, "jun": 6, "jul": 7, "ago": 8,
    "sep": 9, "oct": 10, "nov": 11, "dic": 12,
}

def extraer_datos_generales_sdi(texto):
    """Extrae y valida los datos generales de una SDI desde el texto del PDF."""

    # 1. Comprobar que recibimos texto.
    if not isinstance(texto, str) or not texto.strip():
        raise ValueError("El documento no contiene texto válido.")

    # 2. Verificar el código del formulario.
    if not re.search(r"\bFR-OPE-133\b", texto, re.IGNORECASE):
        raise ValueError("El documento no corresponde al formulario FR-OPE-133.")

    # 3. Identificar el número de SDI, incluyendo solicitudes de Bodega.
    patron_sdi = r"\bSDI-(BOD-)?(\d{1,6})-(\d+)\b"
    coincidencia = re.search(patron_sdi, texto, re.IGNORECASE)

    if not coincidencia:
        raise ValueError("No se encontró un número de SDI válido.")

    prefijo_bod = bool(coincidencia.group(1))
    activacion_proyecto = coincidencia.group(2)
    numero_sdi = coincidencia.group(3)

    # 4. Localizar la fecha de emisión.
    patron_fecha = r"\b(\d{1,2})-([a-záéíóú]{3,})\.?-(\d{2,4})\b"
    fecha_encontrada = re.search(patron_fecha, texto, re.IGNORECASE)

    if not fecha_encontrada:
        raise ValueError("No se encontró la fecha de emisión.")

    dia = int(fecha_encontrada.group(1))
    mes_texto = fecha_encontrada.group(2).lower()[:3]
    anio_texto = fecha_encontrada.group(3)

    if mes_texto not in MESES:
        raise ValueError("El mes de emisión no es válido.")

    # 5. Interpretar los años de dos dígitos como 2000–2099.
    anio = int(anio_texto)
    if len(anio_texto) == 2:
        anio += 2000

    try:
        fecha_emision = datetime(anio, MESES[mes_texto], dia).date()
    except ValueError as error:
        raise ValueError("La fecha de emisión no es válida.") from error

    # 6. Identificar el proyecto indicado al final del formulario.
    patron_proyecto = r"P\s*R\s*O\s*Y\s*E\s*C\s*T\s*O\s*\n\s*([^\n]+)"
    proyecto_encontrado = re.search(patron_proyecto, texto, re.IGNORECASE)

    if not proyecto_encontrado:
        raise ValueError("No se encontró el nombre del proyecto.")

    proyecto = proyecto_encontrado.group(1).strip()

    # 7. Entregar datos estructurados sin modificar la base de datos.
    return {
        "prefijo_bod": prefijo_bod,
        "activacion_proyecto": activacion_proyecto,
        "numero_sdi": numero_sdi,
        "fecha_emision": fecha_emision.isoformat(),
        "proyecto": proyecto,
    }

def extraer_articulos_sdi(texto_layout):
    """Extrae artículos con unidades a inspeccionar mayores que cero."""

    if not isinstance(texto_layout, str) or not texto_layout.strip():
        raise ValueError("El PDF no contiene una tabla válida.")

    articulos = []
    dentro_tabla = False

    for numero_linea, linea in enumerate(texto_layout.splitlines(), start=1):
        # Identifica el encabezado de la tabla.
        if "Código de Plano" in linea and "Artículo" in linea:
            dentro_tabla = True
            continue

        if not dentro_tabla:
            continue
        # Separa el código y el artículo usando los espacios entre ambas columnas.
        columnas_iniciales = re.split(r"\s{2,}", linea[:80].strip(), maxsplit=1)
        codigo = columnas_iniciales[0] if len(columnas_iniciales) == 2 else ""  # Código completo.
        articulo = columnas_iniciales[1] if len(columnas_iniciales) == 2 else ""  # Descripción completa.
        cantidad_texto = linea[126:148].strip()
        observaciones = linea[170:].strip()

        # Descarta encabezados, filas vacías y continuaciones sin cantidades.
        if not cantidad_texto.isdigit():
            continue

        cantidad = int(cantidad_texto)

        # Solo se importan artículos con unidades pendientes de inspección.
        if cantidad <= 0:
            continue

        # Evita incorporar filas incompletas como artículos válidos.
        if not codigo or not articulo:
            raise ValueError(
                f"Artículo incompleto en la línea {numero_linea}."
            )

        # Conserva cada artículo, incluso si comparte código de plano.
        articulos.append({
            "orden": len(articulos) + 1,
            "codigo_plano": codigo,
            "articulo": articulo,
            "cantidad_a_inspeccionar": cantidad,
            "observaciones": observaciones,
        })

    if not dentro_tabla:
        raise ValueError("No se encontró la tabla de artículos.")

    return articulos
