// A host-published classroom date takes precedence over an older saved ticket.
// Registration availability remains independent of this one-off event.
export function resolveClassroomEvent(override, savedEvent, fallbackEvent) {
  if (override?.startsAt && Number.isFinite(Date.parse(override.startsAt))) {
    return {...fallbackEvent, ...override};
  }
  return savedEvent || fallbackEvent;
}

export function classroomSchedule(event, now = Date.now(), ownerPreview = false) {
  const start = Date.parse(event.startsAt);
  const durationSeconds = Math.max(0, Number(event.durationMinutes) * 60);
  if (!Number.isFinite(start) || !Number.isFinite(durationSeconds)) return {phase:'unavailable', remaining:0, position:0};
  if (ownerPreview) return {phase:'preview', remaining:0, position:0};
  if (now < start) return {phase:'upcoming', remaining:Math.ceil((start-now)/1000), position:0};
  const position = Math.max(0, (now-start)/1000);
  if (position >= durationSeconds) return {phase:'ended', remaining:0, position:durationSeconds};
  return {phase:'live', remaining:0, position};
}

export function scheduledPlaybackPosition(event, now, mediaDuration) {
  const state = classroomSchedule(event, now);
  if (state.phase !== 'live') return null;
  if (Number.isFinite(mediaDuration) && (mediaDuration <= 0 || state.position >= mediaDuration)) return null;
  return state.position;
}

// The shared broadcast clock keeps advancing while a viewer pauses or rewinds.
// This is only an upper seek bound: it must not pull a rewound viewer forward.
export function livePlaybackBounds(event, now = Date.now(), mediaDuration) {
  const state = classroomSchedule(event, now);
  const knownDuration = Number.isFinite(mediaDuration) && mediaDuration >= 0;
  const mediaEdge = knownDuration ? Math.max(0, mediaDuration - 0.05) : Infinity;
  const liveEdge = Math.max(0, Math.min(state.position, mediaEdge));
  const recordingEnded = knownDuration && state.phase === 'live' && state.position >= mediaDuration;
  const phase = recordingEnded ? 'ended' : state.phase;
  return {phase, liveEdge, canPlay:phase === 'live'};
}

export function clampLiveSeek(requested, liveEdge) {
  const limit = Number.isFinite(liveEdge) ? Math.max(0, liveEdge) : 0;
  const position = Number.isFinite(requested) ? requested : 0;
  return Math.min(limit, Math.max(0, position));
}

export function countdownParts(seconds) {
  const value = Math.max(0, Math.floor(seconds));
  return {days:Math.floor(value/86400), hours:Math.floor(value%86400/3600), minutes:Math.floor(value%3600/60), seconds:value%60};
}
