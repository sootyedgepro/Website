import {useCallback, useEffect, useRef, useState} from 'react';

export function validatedClassroomConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const {startsAt, timeZone, durationMinutes, recordingSrc} = value;
  if (typeof startsAt !== 'string' || !/(?:Z|[+-]\d{2}:\d{2})$/.test(startsAt) || !Number.isFinite(Date.parse(startsAt))) return null;
  if (typeof timeZone !== 'string' || !timeZone.trim()) return null;
  try { new Intl.DateTimeFormat('en-US', {timeZone}).format(0); } catch { return null; }
  if (typeof durationMinutes !== 'number' || !Number.isFinite(durationMinutes) || durationMinutes <= 0) return null;
  const config = {startsAt, timeZone, durationMinutes};
  if (recordingSrc !== undefined) {
    if (typeof recordingSrc !== 'string' || !recordingSrc.trim()) return null;
    try {
      const source = new URL(recordingSrc, 'https://classroom.invalid/');
      if (!['http:', 'https:'].includes(source.protocol)) return null;
    } catch { return null; }
    config.recordingSrc = recordingSrc;
  }
  return config;
}

const sameEvent = (left, right) => {
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => left[key] === right[key]);
};

// Estimate server wall time once, then advance it using the monotonic clock.
// A device clock adjustment must not jump the broadcast or restart its countdown.
export function useClassroomClock(initialEvent, scheduleUrl) {
  const fallbackRef = useRef(initialEvent);
  fallbackRef.current = initialEvent;
  const anchorRef = useRef(null);
  if (!anchorRef.current) anchorRef.current = {wall:Date.now(), mono:performance.now()};
  const clockNow = useCallback(() => anchorRef.current.wall + performance.now() - anchorRef.current.mono, []);
  const [event, setEvent] = useState(initialEvent);
  const [now, setNow] = useState(clockNow);
  const endpoint = scheduleUrl || (typeof window !== 'undefined' ? new URL('/travelinginprofit/classroom/schedule.json', window.location.origin).href : null);

  useEffect(() => {
    let disposed = false;
    let pending = null;
    const refresh = async () => {
      if (!endpoint || disposed) return;
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      try {
        const url = new URL(endpoint, window.location.origin);
        url.searchParams.set('_clock', String(Date.now()));
        const sent = performance.now();
        const response = await fetch(url.href, {cache:'no-store', signal:controller.signal});
        const received = performance.now();
        if (!response.ok) return;
        const config = validatedClassroomConfig(await response.json());
        if (disposed || controller.signal.aborted || !config) return;
        const serverDate = Date.parse(response.headers.get('date') || '');
        if (Number.isFinite(serverDate)) {
          anchorRef.current = {wall:serverDate, mono:(sent + received) / 2};
          setNow(clockNow());
        }
        const next = {...fallbackRef.current, ...config};
        setEvent(previous => sameEvent(previous, next) ? previous : next);
      } catch {
        // Keep the last accepted schedule and monotonic clock during outages.
      } finally {
        if (pending === controller) pending = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        setNow(clockNow());
        refresh();
      }
    };
    refresh();
    const poll = window.setInterval(refresh, 15000);
    const tick = window.setInterval(() => setNow(clockNow()), 250);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      pending?.abort();
      window.clearInterval(poll);
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [endpoint, clockNow]);

  return {event, now, clockNow};
}

export default useClassroomClock;
