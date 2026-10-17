
import msal  # Biblioteca para autenticarse con Microsoft 365.
from django.conf import settings  # Permite consultar la configuración de Django.
import requests  # Permite realizar consultas HTTP a Microsoft Graph.
from urllib.parse import quote  # Codifica de forma segura la dirección del buzón.
import base64  # Permite convertir los adjuntos de Outlook en archivos binarios.
from io import BytesIO  # Permite leer el PDF directamente desde memoria.
from pypdf import PdfReader  # Extrae texto de documentos PDF.
def obtener_token_outlook():
    """Obtiene un token de acceso para consultar Outlook mediante Microsoft Graph."""

    # 1. Verificar que las credenciales corporativas estén configuradas.
    if not all([
        settings.MS365_TENANT_ID,
        settings.MS365_CLIENT_ID,
        settings.MS365_CLIENT_SECRET,
    ]):
        raise ValueError(
            "Falta configurar las credenciales de Microsoft 365."
        )

    # 2. Crear el cliente de autenticación de Microsoft Entra ID.
    aplicacion = msal.ConfidentialClientApplication(
        client_id=settings.MS365_CLIENT_ID,
        authority=f"https://login.microsoftonline.com/{settings.MS365_TENANT_ID}",
        client_credential=settings.MS365_CLIENT_SECRET,
    )

    # 3. Solicitar un token con los permisos autorizados de Microsoft Graph.
    resultado = aplicacion.acquire_token_for_client(
        scopes=["https://graph.microsoft.com/.default"]
    )

    # 4. Comprobar que Microsoft 365 haya entregado el token.
    token = resultado.get("access_token")

    if not token:
        raise ValueError(
            "No fue posible obtener el token de Microsoft 365."
        )

    # 5. Entregar el token al servicio que consultará los correos.
    return token

def consultar_correos_outlook():
    """Consulta los mensajes recientes del buzón corporativo."""

    # 1. Verificar que se haya configurado el buzón de recepción.
    if not settings.MS365_MAILBOX:
        raise ValueError(
            "No se ha configurado el buzón corporativo de Outlook."
        )

    # 2. Obtener el token de autenticación de Microsoft 365.
    token = obtener_token_outlook()

    # 3. Preparar la dirección del buzón y la consulta a Microsoft Graph.
    buzon = quote(settings.MS365_MAILBOX, safe="")
    url = (
        f"{settings.MS365_GRAPH_URL}/users/{buzon}/mailFolders/inbox/messages"
    )

    # 4. Enviar el token de forma segura en la cabecera HTTP.
    encabezados = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }

    # 5. Consultar hasta 20 mensajes recientes, sin marcarlos como leídos.
    parametros = {
        "$top": 20,
        "$select": "id,subject,from,receivedDateTime,hasAttachments",
        "$orderby": "receivedDateTime desc",
    }

    respuesta = requests.get(
        url,
        headers=encabezados,
        params=parametros,
        timeout=30,
    )

    # 6. Detectar errores de autorización o comunicación.
    respuesta.raise_for_status()

    # 7. Devolver los mensajes para su posterior procesamiento.
    return respuesta.json().get("value", [])

def obtener_adjuntos_outlook(id_mensaje):
    """Consulta los archivos adjuntos de un mensaje de Outlook."""

    # 1. Verificar que el identificador del mensaje sea válido.
    if not id_mensaje:
        raise ValueError("Debe indicar el identificador del mensaje.")

    # 2. Verificar que el buzón corporativo esté configurado.
    if not settings.MS365_MAILBOX:
        raise ValueError("No se ha configurado el buzón corporativo.")

    # 3. Obtener autorización para consultar Microsoft Graph.
    token = obtener_token_outlook()

    # 4. Preparar la dirección segura del buzón y del mensaje.
    buzon = quote(settings.MS365_MAILBOX, safe="")
    mensaje = quote(str(id_mensaje), safe="")

    # 5. Construir la dirección para consultar los adjuntos.
    url = (
        f"{settings.MS365_GRAPH_URL}/users/{buzon}"
        f"/messages/{mensaje}/attachments"
    )

    # 6. Incorporar el token de acceso a la solicitud.
    encabezados = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }

    # 7. Consultar los archivos adjuntos del mensaje.
    respuesta = requests.get(
        url,
        headers=encabezados,
        timeout=30,
    )
    respuesta.raise_for_status()

    # 8. Devolver los datos de los adjuntos recibidos.
    return respuesta.json().get("value", [])

def extraer_pdfs_adjuntos(adjuntos):
    """Selecciona los PDF adjuntos y decodifica su contenido."""

    # 1. Preparar una lista para almacenar los documentos PDF.
    documentos_pdf = []

    # 2. Recorrer los adjuntos recibidos desde Microsoft Graph.
    for adjunto in adjuntos:

        # 3. Aceptar solamente archivos adjuntos con extensión PDF.
        nombre = adjunto.get("name", "")
        tipo = adjunto.get("@odata.type", "")

        if tipo != "#microsoft.graph.fileAttachment":
            continue

        if not nombre.lower().endswith(".pdf"):
            continue

        # 4. Obtener el contenido del archivo codificado en Base64.
        contenido_base64 = adjunto.get("contentBytes")

        if not contenido_base64:
            continue

        # 5. Convertir el contenido a bytes y verificar su firma PDF.
        try:
            contenido_pdf = base64.b64decode(
                contenido_base64,
                validate=True,
            )
        except (ValueError, base64.binascii.Error):
            continue

        if not contenido_pdf.startswith(b"%PDF-"):
            continue

        # 6. Conservar el nombre y contenido para validaciones posteriores.
        documentos_pdf.append({
            "nombre": nombre,
            "contenido": contenido_pdf,
        })

    # 7. Devolver los documentos PDF identificados.
    return documentos_pdf

def leer_texto_pdf(contenido_pdf):
    """Extrae el texto de un PDF recibido como bytes."""

    # 1. Comprobar que el documento tenga contenido.
    if not contenido_pdf:
        raise ValueError("El documento PDF está vacío.")

    # 2. Abrir el PDF directamente desde memoria.
    try:
        documento = PdfReader(BytesIO(contenido_pdf))

        # 3. Extraer el texto de todas las páginas.
        paginas = []

        for pagina in documento.pages:
            texto = pagina.extract_text() or ""
            paginas.append(texto)

        # 4. Unir el contenido de las páginas.
        texto_completo = "\n".join(paginas).strip()

        # 5. Detectar documentos sin texto extraíble.
        if not texto_completo:
            raise ValueError(
                "El PDF no contiene texto extraíble. Puede ser un documento escaneado."
            )

        # 6. Devolver el texto para identificar los campos de la SDI.
        return texto_completo

    except ValueError:
        raise

    except Exception as error:
        # 7. Informar si el documento está dañado o no puede procesarse.
        raise ValueError(
            "No fue posible leer el contenido del PDF."
        ) from error
