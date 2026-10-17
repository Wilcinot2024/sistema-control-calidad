
import re  # Permite identificar los códigos y las cantidades de cada fila.


def extraer_productos_sdi(texto_pdf):
    """Extrae los productos solicitados para inspección desde el PDF."""

    # 1. Preparar la lista de productos solicitados.
    productos = []

    # 2. Revisar individualmente las líneas extraídas del documento.
    for linea in texto_pdf.splitlines():

        # 3. Identificar filas con código de plano AT y sus cuatro cantidades.
        patron = (
            r"^\s*(AT\S+)\s+(.+?)\s{2,}"
            r"(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)(?:\s{2,}.*)?$"
        )
        coincidencia = re.match(patron, linea)

        # 4. Ignorar encabezados y líneas que no correspondan al formato.
        if not coincidencia:
            continue

        # 5. Recuperar el código, nombre y cantidad a inspeccionar.
        codigo = coincidencia.group(1)
        nombre = coincidencia.group(2).strip()
        cantidad = int(coincidencia.group(5))

        # 6. Registrar únicamente artículos con cantidad positiva.
        if cantidad <= 0:
            continue

        # 7. Conservar cada producto, aunque comparta código con otro.
        productos.append({
            "codigo_plano": codigo,
            "nombre_producto": nombre,
            "cantidad_inspeccionar": cantidad,
        })

    # 8. Devolver cada producto con su cantidad individual, sin sumas.
    return productos
