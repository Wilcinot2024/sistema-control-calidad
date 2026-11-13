
import os  # Obtiene la configuración desde variables de entorno.
import imaplib  # Permite consultar Gmail mediante IMAP seguro.
import email  # Interpreta los mensajes recibidos.
from email import policy  # Facilita la lectura de encabezados y adjuntos.


def consultar_correos_gmail(limite=20):
    """Obtiene correos recientes de Gmail sin modificarlos."""

    # 1. Leer las credenciales sin incluirlas en el código.
    buzon = os.environ.get("GMAIL_BUZON", "").strip()
    clave = os.environ.get("GMAIL_APP_PASSWORD", "").replace(" ", "")
    carpeta = os.environ.get("GMAIL_CARPETA", "[Gmail]/Todos")

    if not buzon or not clave:
        raise ValueError("Falta configurar el acceso a Gmail.")

    # 2. Limitar la cantidad de mensajes consultados.
    if not isinstance(limite, int) or not 1 <= limite <= 100:
        raise ValueError("El límite debe estar entre 1 y 100.")

    mensajes = []

    # 3. Abrir una conexión cifrada con Gmail.
    with imaplib.IMAP4_SSL("imap.gmail.com", 993) as conexion:
        conexion.login(buzon, clave)

        # 4. Abrir la carpeta sin marcar mensajes como leídos.
        estado, _ = conexion.select(f'"{carpeta}"', readonly=True)
        if estado != "OK":
            raise RuntimeError("No se pudo abrir la carpeta de Gmail.")

        # 5. Buscar los identificadores de los correos.
        estado, datos = conexion.uid("search", None, "ALL")
        if estado != "OK":
            raise RuntimeError("No se pudo consultar Gmail.")

        identificadores = datos[0].split()[-limite:]

        # 6. Recuperar los mensajes sin modificar su estado.
        for identificador in identificadores:
            estado, respuesta = conexion.uid(
                "fetch", identificador, "(BODY.PEEK[])"
            )

            if estado != "OK":
                continue

            for elemento in respuesta:
                if not isinstance(elemento, tuple):
                    continue

                mensaje = email.message_from_bytes(
                    elemento[1], policy=policy.default
                )

                mensajes.append({
                    "uid": identificador.decode("ascii"),
                    "mensaje": mensaje,
                })
                break

        conexion.logout()

    return mensajes

from django.core.exceptions import ValidationError  # Gestiona errores de recepción.
from quality.integraciones.gmail_recepcion import procesar_mensaje_gmail  # Servicio existente.


def recibir_sdi_desde_gmail(limite=20, ejecutar_importacion=False):
    """Consulta Gmail y coordina la recepción de documentos SDI."""

    # 1. Mantener bloqueada la escritura hasta completar la seguridad.
    if ejecutar_importacion:
        raise ValidationError(
            "La importación automática requiere validar la autenticidad del remitente."
        )

    # 2. Consultar los correos mediante el servicio Gmail existente.
    correos = consultar_correos_gmail(limite=limite)
    buzon = os.environ.get("GMAIL_BUZON", "").strip().lower()

    resultados = []


    # 3. Revisar únicamente los correos destinados a recepción SDI.
    for correo in correos:
        mensaje = correo["mensaje"]

        # Ignorar correos ajenos al proceso de Control de Calidad.
        asunto = str(mensaje.get("Subject", "")).strip().lower()
        if "sdi" not in asunto:
            continue

        try:
            # Aplicar las validaciones y permisos ya implementados.
            resultado = procesar_mensaje_gmail(
                mensaje=mensaje,
                buzon=buzon,
                ejecutar_importacion=False,  # Escritura bloqueada por seguridad.
            )

            resultados.append({
                "uid": correo["uid"],
                "estado": resultado["estado"],
                "departamento": resultado["departamento"],
                "cantidad_pdf": resultado["cantidad_pdf"],
            })

        except ValidationError as error:
            # 4. Rechazar mensajes no autorizados sin detener los demás.
            resultados.append({
                "uid": correo["uid"],
                "estado": "rechazado",
                "detalle": error.messages,
            })

    # 5. Entregar un resumen del procesamiento.
    return {
        "correos_revisados": len(correos),
        "resultados": resultados,
    }
