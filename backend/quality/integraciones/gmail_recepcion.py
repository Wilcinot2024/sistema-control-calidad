
from email.header import decode_header, make_header  # Decodifica nombres de adjuntos.
from email.utils import parseaddr  # Obtiene el remitente declarado.
from django.core.exceptions import ValidationError  # Gestiona errores de recepción.

from quality.integraciones.outlook_recepcion import (
    identificar_departamento_remitente,  # Comprueba remitentes autorizados.
    obtener_usuario_servicio_outlook,  # Valida el usuario técnico.
    procesar_pdf_recibido,  # Importa SDI y controla duplicados.
)


def procesar_mensaje_gmail(
    mensaje, buzon, ejecutar_importacion=False, origen_verificado=False
):
    """Valida y procesa los documentos PDF de un correo Gmail."""

    # 1. Validar que se recibió un mensaje y un buzón identificable.
    if mensaje is None or not hasattr(mensaje, "walk"):
        raise ValidationError("El mensaje Gmail no es válido.")

    if not isinstance(buzon, str) or not buzon.strip():
        raise ValidationError("El buzón receptor es obligatorio.")

    buzon = buzon.strip().lower()

    # 2. Extraer el remitente y comprobar el departamento autorizado.
    remitente = parseaddr(mensaje.get("From", ""))[1].strip().lower()
    if not remitente:
        raise ValidationError("No se pudo identificar el remitente.")

    mensaje_outlook = {
        "from": {"emailAddress": {"address": remitente}}
    }
    departamento = identificar_departamento_remitente(mensaje_outlook)

    # 3. Validar la cuenta técnica antes de cualquier importación.
    usuario_servicio = obtener_usuario_servicio_outlook()

    # 4. Obtener el identificador para controlar recepciones duplicadas.
    mensaje_id = str(mensaje.get("Message-ID", "")).strip()
    if not mensaje_id or len(mensaje_id) > 512:
        raise ValidationError("El correo no contiene un Message-ID válido.")

    # 5. Extraer solamente adjuntos PDF con contenido reconocible.
    documentos = []

    for parte in mensaje.walk():
        nombre = parte.get_filename()
        if not nombre:
            continue

        nombre = str(make_header(decode_header(nombre))).strip()
        contenido = parte.get_payload(decode=True) or b""

        if nombre.lower().endswith(".pdf") and contenido.startswith(b"%PDF-"):
            documentos.append((nombre, contenido))

    # 6. Permitir consultar la recepción sin escribir en PostgreSQL.
    if not ejecutar_importacion:
        return {
            "estado": "validado_sin_importar",
            "departamento": departamento,
            "cantidad_pdf": len(documentos),
        }

    # 7. Bloquear escrituras si no existe autorización de origen confiable.
    if not origen_verificado:
        raise ValidationError(
            "No se ha acreditado de forma confiable el origen del correo."
        )

    if not documentos:
        return {
            "estado": "sin_pdf",
            "departamento": departamento,
            "resultados": [],
        }

    # 8. Reutilizar el importador existente para cada documento autorizado.
    resultados = []

    for nombre, contenido in documentos:
        try:
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

        except ValidationError as error:
            # Un PDF inválido no impide procesar los demás documentos.
            resultados.append({
                "archivo": nombre,
                "estado": "error",
                "detalle": error.messages,
            })

    # 9. Resumir el procesamiento del correo.
    cantidad_errores = sum(
        1 for resultado in resultados if resultado["estado"] == "error"
    )

    return {
        "estado": "parcial" if cantidad_errores else "procesado",
        "departamento": departamento,
        "resultados": resultados,
    }
