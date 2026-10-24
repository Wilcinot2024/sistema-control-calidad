export function articleText(value, maxLength = 250) {
  return String(value).normalize('NFC').replace(/[^\p{L}\p{N} .-]/gu, '').slice(0, maxLength);
}

export function nextProductOrder(productos, sdiId) {
  const orders = productos.filter(producto => producto.data.sdi === Number(sdiId)).map(producto => producto.data.orden);
  return Math.max(0, ...orders) + 1;
}

export function productQuantity(value) {
  const quantity = Number(value);
  return Number.isSafeInteger(quantity) && quantity >= 1 ? quantity : 1;
}

export function boundedQuantity(value, max = Number.MAX_SAFE_INTEGER) {
  return Math.min(productQuantity(value), Math.max(0, max));
}

export function stepQuantity(value, delta, max = Number.MAX_SAFE_INTEGER, min = 1) {
  const current = Math.min(max, Math.max(min, Number.isSafeInteger(Number(value)) ? Number(value) : min));
  return Math.max(Math.min(min, max), Math.min(max, current + delta));
}
