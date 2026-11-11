import {CLASS_EVENT, validEmail} from './models.mjs';

export const SAVED_TICKET_KEY = 'tip.saved-ticket.v1';
export const SAVED_TICKET_COOKIE = 'tip_ticket_saved';
export const TICKET_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const TIME_ZONE = 'America/New_York';
const DAY_MS = 24 * 60 * 60 * 1000;
const timestamp = value => value instanceof Date ? value.getTime() : Number(value);

function localParts(date) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
}

// Convert noon in New York to UTC instead of assuming EST all year.
function noonInNewYork(year, month, day) {
  const guess = Date.UTC(year, month - 1, day, 12);
  const parts = localParts(guess);
  const displayed = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return new Date(guess + guess - displayed).toISOString();
}

export function availableTicketEvents(now = Date.now(), count = 4) {
  const current = timestamp(now);
  if (!Number.isFinite(current)) return [];
  const parts = localParts(current);
  const today = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  const first = today + ((6 - new Date(today).getUTCDay() + 7) % 7) * DAY_MS;
  const events = [];
  for (let candidate = first; events.length < Math.max(1, Math.min(12, Math.floor(count) || 4)); candidate += 7 * DAY_MS) {
    const date = new Date(candidate);
    const startsAt = noonInNewYork(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    if (Date.parse(startsAt) <= current) continue;
    const day = date.toISOString().slice(0, 10);
    events.push({...CLASS_EVENT, id: 'tip-class-' + day, startsAt, timeZone: TIME_ZONE});
  }
  return events;
}

export function validTicketEvent(event) {
  if (!event || typeof event !== 'object' || typeof event.id !== 'string' || !/^tip-(?:class-|owner-review-)\d{4}-\d{2}-\d{2}$/.test(event.id)
      || typeof event.startsAt !== 'string' || !Number.isFinite(Date.parse(event.startsAt)) || event.durationMinutes !== 55 || event.timeZone !== TIME_ZONE) return false;
  const parts = localParts(Date.parse(event.startsAt));
  return parts.weekday === 'Sat' && parts.hour === '12' && parts.minute === '00' && parts.second === '00'
    && event.id.endsWith(parts.year + '-' + parts.month + '-' + parts.day);
}

function browserStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

function marker(record) {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = SAVED_TICKET_COOKIE + '=' + (record ? '1' : '') + '; Path=/travelinginprofit/; SameSite=Lax; '
      + (record ? 'Expires=' + new Date(record.expiresAt).toUTCString() : 'Max-Age=0')
      + (globalThis.location?.protocol === 'https:' ? '; Secure' : '');
  } catch {}
}

export function clearSavedRegistration(storage = browserStorage()) {
  try { storage?.removeItem(SAVED_TICKET_KEY); } catch {}
  marker(null);
}

export function validateSavedRegistration(value, now = Date.now()) {
  const current = timestamp(now);
  if (!value || value.version !== 1 || !Number.isFinite(current) || !validTicketEvent(value.event)
      || typeof value.firstName !== 'string' || !value.firstName.trim() || value.firstName.length > 100
      || typeof value.email !== 'string' || value.email.length > 254 || !validEmail(value.email)
      || value.consent !== true || typeof value.weeklyInvitations !== 'boolean'
      || typeof value.ticketId !== 'string' || !/^[a-zA-Z0-9-]{8,100}$/.test(value.ticketId)) return null;
  const completedAt = Date.parse(value.completedAt), expiresAt = Date.parse(value.expiresAt);
  const start = Date.parse(value.event.startsAt), end = start + value.event.durationMinutes * 60000;
  if (!Number.isFinite(completedAt) || !Number.isFinite(expiresAt) || completedAt > current + 5 * 60000
      || completedAt >= start || start - completedAt > 35 * DAY_MS
      || expiresAt !== end + TICKET_RETENTION_MS || expiresAt <= current) return null;
  return {
    version: 1, firstName: value.firstName.trim(), email: value.email.trim(), consent: true,
    weeklyInvitations: value.weeklyInvitations, ticketId: value.ticketId,
    event: {id: value.event.id, title: CLASS_EVENT.title, startsAt: new Date(value.event.startsAt).toISOString(), durationMinutes: 55, timeZone: TIME_ZONE},
    completedAt: new Date(completedAt).toISOString(), expiresAt: new Date(expiresAt).toISOString()
  };
}

export function readSavedRegistration(storage = browserStorage(), now = Date.now()) {
  try {
    const raw = storage?.getItem(SAVED_TICKET_KEY);
    if (!raw) return null;
    if (raw.length > 4096) { clearSavedRegistration(storage); return null; }
    const saved = validateSavedRegistration(JSON.parse(raw), now);
    if (!saved) { clearSavedRegistration(storage); return null; }
    return saved;
  } catch { clearSavedRegistration(storage); return null; }
}

export function saveCompletedRegistration(registration, storage = browserStorage(), now = Date.now()) {
  if (registration?.torn !== true || !validTicketEvent(registration.event)) return {ok: false, record: null};
  const completedAt = timestamp(now);
  if (!Number.isFinite(completedAt)) return {ok: false, record: null};
  const record = validateSavedRegistration({...registration, version: 1,
    completedAt: new Date(completedAt).toISOString(),
    expiresAt: new Date(Date.parse(registration.event?.startsAt) + 55 * 60000 + TICKET_RETENTION_MS).toISOString()
  }, completedAt);
  if (!record || !storage) return {ok: false, record: null};
  try {
    storage.setItem(SAVED_TICKET_KEY, JSON.stringify(record));
    marker(record);
    return {ok: true, record};
  } catch { return {ok: false, record}; }
}

export function getSavedRegistrationEvent(storage = browserStorage(), now = Date.now()) {
  return readSavedRegistration(storage, now)?.event ?? null;
}
