export function digitsOnly(value, maxLength) {
  const digits = String(value).replace(/[^0-9]/g, '');
  return maxLength === undefined ? digits : digits.slice(0, maxLength);
}

export function todayInSantiago(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = type => parts.find(value => value.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function earliestEmissionDate(today = todayInSantiago()) {
  return `${Number(today.slice(0, 4)) - 1}-01-01`;
}

export function isValidEmissionDate(value, today = todayInSantiago()) {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) || value < earliestEmissionDate(today) || value > today) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
