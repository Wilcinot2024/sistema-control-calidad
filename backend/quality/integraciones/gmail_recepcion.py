
from email.utils import parseaddr  # Extrae el correo real del encabezado.
from django.core.exceptions import ValidationError  # Gestiona errores.
from quality.integraciones.outlook_recepcion import (
    identificar_departamento_remitente,  # Comprueba el remitente autorizado.
    obtener_usuario_servicio_outlook,  # Valida la cuenta técnica.
    procesar_pdf_recibido,  # Reutiliza la importación y evita duplicados.
)

def procesar_mensaje_gmail(mensaje, buzon, ejecutar_importacion=False):
    """Procesa los PDF de un mensaje Gmail con autorización explícita."""

    # 1. Obtener el remitente y validar su departamento.
    remitente = parseaddr(mensaje.get("From", ""))[1].strip().lower()
    mensaje_outlook = {
        "from": {"emailAddress": {"address": remitente}}
    }
    departamento = identificar_departamento_remitente(mensaje_outlook)

    # 2. Validar el usuario técnico del sistema.
    usuario_servicio = obtener_usuario_servicio_outlook()

    # 3. Identificar el mensaje para controlar duplicados.
    mensaje_id = mensaje.get("Message-ID", "").strip()
    if not mensaje_id:
        raise ValidationError("El correo no contiene un Message-ID válido.")

    # 4. Detectar los documentos PDF adjuntos.
    documentos = []
    for parte in mensaje.walk():
        nombre = parte.get_filename()
        if not nombre or not nombre.lower().endswith(".pdf"):
            continue

        contenido = parte.get_payload(decode=True) or b""
        if contenido.startswith(b"%PDF-"):
            documentos.append((nombre, contenido))

    # 5. Mantener desactivada la escritura por defecto.
    if not ejecutar_importacion:
        return {
            "estado": "validado_sin_importar",
            "departamento": departamento,
            "cantidad_pdf": len(documentos),
        }

    # 6. Importar cada documento utilizando el servicio existente.
    resultados = []
    for nombre, contenido in documentos:
        resultado = procesar_pdf_recibido(
            contenido_pdf=contenido,
            buzon=buzon,
            mensaje_id=mensaje_id,
            nombre_archivo=nombre,
            usuario_actual=usuario_servicio,
            departamento_solicitante=departamento,
            solicitante=remitente,
        )
        resultados.append({"archivo": nombre, **resultado})

    return {
        "estado": "procesado",
        "departamento": departamento,
        "resultados": resultados,
    }
