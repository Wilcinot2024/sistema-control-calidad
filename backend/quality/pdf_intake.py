"""Extracción conservadora: las propuestas nunca sustituyen la revisión humana."""
import re
from io import BytesIO
from pypdf import PdfReader
from django.core.exceptions import ValidationError

MAX_PDF_BYTES = 20 * 1024 * 1024


def extract_proposal(content):
    if not content.startswith(b"%PDF-") or len(content) > MAX_PDF_BYTES:
        raise ValidationError("Adjunta un PDF válido de hasta 20 MB.")
    try:
        reader = PdfReader(BytesIO(content))
        if reader.is_encrypted or len(reader.pages) > 100:
            raise ValidationError("El PDF debe estar sin contraseña y tener hasta 100 páginas.")
        texts = []
        for page in reader.pages:
            stream = page.get_contents()
            if stream and len(stream.get_data()) > 10 * 1024 * 1024:
                raise ValidationError("El PDF contiene una página demasiado compleja para el análisis automático.")
            texts.append(page.extract_text(extraction_mode="layout") or "")
        text = "\n".join(texts)[:200_000]
    except ValidationError:
        raise
    except Exception as exc:
        raise ValidationError("No se pudo leer el PDF. Comprueba que el archivo no esté dañado.") from exc
    fields = {}
    code = re.search(r"\bSDI[-\s]*(BOD[-\s]*)?(\d{1,6})[-\s]+(\d+)\b", text, re.I)
    if code:
        fields.update(prefijo_bod=bool(code[1]), activacion_proyecto=code[2], numero_sdi=code[3])
    for field, label in [("proyecto", "Proyecto"), ("departamento_solicitante", "Departamento(?: solicitante)?"), ("solicitante", "Solicitante")]:
        found = re.search(r"^\s*" + label + r"\s*:\s*([^\n|]+)", text, re.I | re.M)
        if found:
            fields[field] = found[1].strip()
    date = re.search(r"Fecha(?: de emisi[oó]n)?\s*:\s*(\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4})", text, re.I)
    if date:
        fields["fecha_emision"] = date[1] if "-" in date[1] else "-".join(reversed(date[1].split("/")))
    products = []
    for block in re.split(r"(?=Art[ií]culo\s*:|Producto\s*:)", text, flags=re.I)[1:]:
        article = re.search(r"(?:Art[ií]culo|Producto)\s*:\s*([^\n|]+)", block, re.I)
        quantity = re.search(r"Cantidad(?: indicada)?\s*:\s*(\d+)\b", block, re.I)
        description = re.search(r"Descripci[oó]n\s*:\s*([^\n|]+)", block, re.I)
        if article:
            count = int(quantity[1]) if quantity and len(quantity[1]) <= 10 else 0
            products.append({"articulo": article[1].strip()[:250], "descripcion": description[1].strip() if description else "", "cantidad_indicada": count if 0 < count <= 2147483647 else None})
    warnings = []
    if not text.strip():
        warnings.append("PDF sin texto seleccionable: revisa el documento y completa los datos manualmente. Puede requerir OCR.")
    if not code:
        warnings.append("No se identificó un código SDI. Debe completarse durante la revisión.")
    if not products:
        warnings.append("No se identificaron productos con certeza. Agrégalos durante la revisión.")
    return text, {"campos": fields, "productos": products, "advertencias": warnings}
