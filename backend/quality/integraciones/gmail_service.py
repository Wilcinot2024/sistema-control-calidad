
import os  # Obtiene la configuración desde variables de entorno.
import imaplib  # Permite consultar Gmail mediante IMAP seguro.
import email  # Interpreta los mensajes recibidos.
from email import policy  # Facilita la lectura de encabezados y adjuntos.


def consultar_correos_gmail(limite=20, carpeta=None):
    """Obtiene correos recientes de Gmail sin modificarlos."""

    # 1. Leer las credenciales sin incluirlas en el código.
    buzon = os.environ.get("GMAIL_BUZON", "").strip()
    clave = os.environ.get("GMAIL_APP_PASSWORD", "").replace(" ", "")
    # Permitir seleccionar una carpeta sin modificar la configuración general.
    carpeta = carpeta or os.environ.get("GMAIL_CARPETA", "[Gmail]/Todos")

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

import re  # Permite interpretar los resultados de autenticación.
from email.utils import parseaddr  # Extrae la dirección del remitente.



def validar_autenticacion_gmail(mensaje):
    """Revisa los resultados de autenticación del correo recibido."""

    # Obtener la dirección declarada por el remitente.
    remitente = parseaddr(mensaje.get("From", ""))[1].strip().lower()
    if "@" not in remitente:
        raise ValidationError("El remitente no es válido.")

    dominio = remitente.rsplit("@", 1)[1]

    # Buscar el resultado de autenticación atribuido a Google.
    resultados = mensaje.get_all("Authentication-Results", [])
    resultado_google = next(
        (
            str(valor) for valor in resultados
            if re.match(r"^\s*mx\.google\.com\s*;", str(valor), re.I)
        ),
        None,
    )

    if not resultado_google:
        raise ValidationError("No se encontró autenticación de Gmail.")

    # Comprobar DMARC y la coincidencia del dominio declarado.
    coincidencia = re.search(
        r"\bdmarc=pass\b[^;]*\bheader\.from=([^\s;]+)",
        resultado_google,
        re.I,
    )

    if not coincidencia or coincidencia.group(1).lower() != dominio:
        raise ValidationError("El remitente no superó la validación DMARC.")

    return True

def recibir_sdi_desde_gmail(limite=20, ejecutar_importacion=False):
    """Consulta Gmail e importa únicamente documentos aprobados."""

    # 1. Exigir habilitación explícita antes de escribir en PostgreSQL.
    habilitada = os.environ.get("GMAIL_IMPORTACION_HABILITADA", "0") == "1"

    if ejecutar_importacion and not habilitada:
        raise ValidationError("La importación Gmail está deshabilitada.")

    # 2. Seleccionar exclusivamente los mensajes aprobados al importar.
    carpeta = (
        "ANCOR_SDI_AUTORIZADA"
        if ejecutar_importacion
        else os.environ.get("GMAIL_CARPETA", "[Gmail]/Todos")
    )

    correos = consultar_correos_gmail(limite=limite, carpeta=carpeta)
    buzon = os.environ.get("GMAIL_BUZON", "").strip().lower()
    resultados = []

    # 3. Recorrer los correos recuperados.
    for correo in correos:
        mensaje = correo["mensaje"]
        asunto = str(mensaje.get("Subject", "")).strip().lower()

        if "sdi" not in asunto:
            continue

        try:
            # 4. Procesar mediante las autorizaciones existentes.
            # La etiqueta seleccionada representa aprobación manual.
            resultado = procesar_mensaje_gmail(
                mensaje=mensaje,
                buzon=buzon,
                ejecutar_importacion=ejecutar_importacion,
                aprobado_manualmente=ejecutar_importacion,
            )

            resultados.append({
                "uid": correo["uid"],
                **resultado,
            })

        except ValidationError as error:
            # 5. Conservar el resultado y continuar con los demás correos.
            resultados.append({
                "uid": correo["uid"],
                "estado": "rechazado",
                "detalle": error.messages,
            })

    # 6. Entregar el resumen al comando Django.
    return {
        "correos_revisados": len(correos),
        "resultados": resultados,
    }
