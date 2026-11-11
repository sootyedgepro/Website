import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {transform} from 'esbuild';

const source = await fs.readFile(new URL('../funnel/shared/use-classroom-clock.jsx', import.meta.url), 'utf8');
const {code} = await transform(source, {loader:'jsx', format:'cjs'});
const initialEvent = {id:'class', title:'Class', startsAt:'2026-11-14T17:00:00Z', timeZone:'America/New_York', durationMinutes:55};
const config = {startsAt:'2026-11-09T18:55:00Z', timeZone:'America/Chicago', durationMinutes:55, recordingSrc:'https://www.youtube.com/watch?v=dnfD5fO2PrE'};
const serverDate = 'Mon, 09 Nov 2026 18:55:00 GMT';
const serverTime = Date.parse(serverDate);

function mount() {
  let mono = 0, wall = 2030000000000, index = 0, effect, cleanup, timerId = 0;
  const slots = [], timers = new Map(), listeners = new Map(), requests = [];
  const react = {
    useRef(value) { const at = index++; return slots[at] ||= {current:value}; },
    useCallback(fn) { const at = index++; return slots[at] ||= fn; },
    useState(value) {
      const at = index++;
      if (!(at in slots)) slots[at] = typeof value === 'function' ? value() : value;
      return [slots[at], next => { slots[at] = typeof next === 'function' ? next(slots[at]) : next; }];
    },
    useEffect(fn) { effect ||= fn; }
  };
  const document = {visibilityState:'visible', addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener(name) { listeners.delete(name); }};
  const window = {location:{origin:'https://classroom.example'}, setInterval(fn, ms) { const id = ++timerId; timers.set(id, {fn, ms}); return id; }, clearInterval(id) { timers.delete(id); }};
  class ClockDate extends Date { static now() { return wall; } }
  const context = {module:{exports:{}}, require:() => react, window, document, Date:ClockDate, performance:{now:() => mono}, URL, Intl, AbortController,
    fetch(url, options) { return new Promise(resolve => requests.push({url, options, resolve})); }
  };
  vm.runInNewContext(code, context);
  const render = () => { index = 0; return context.module.exports.useClassroomClock(initialEvent); };
  const first = render();
  cleanup = effect();
  return {first, render, requests, timers, document, listeners, cleanup, validate:context.module.exports.validatedClassroomConfig,
    advance(value) { mono = value; }, moveWall(value) { wall = value; },
    async respond(payload=config, date=serverDate, ok=true) {
      requests.at(-1).resolve({ok, json:async () => payload, headers:{get:() => date}});
      for (let i = 0; i < 5; i++) await Promise.resolve();
    },
    poll() { for (const timer of timers.values()) if (timer.ms === 15000) timer.fn(); }
  };
}

test('server midpoint corrects a skewed device clock and continues monotonically', async () => {
  const view = mount();
  assert.equal(view.first.now, 2030000000000);
  assert.match(view.requests[0].url, /\/travelinginprofit\/classroom\/schedule.json\?_clock=/);
  assert.equal(view.requests[0].options.cache, 'no-store');
  view.advance(200);
  await view.respond();
  const synced = view.render();
  assert.equal(synced.clockNow, view.first.clockNow);
  assert.equal(synced.now, serverTime + 100);
  assert.equal(synced.event.id, initialEvent.id);
  assert.equal(synced.event.startsAt, config.startsAt);
  view.moveWall(0);
  view.advance(500);
  assert.equal(synced.clockNow(), serverTime + 400);
  view.cleanup();
});

test('unchanged polls preserve event identity; invalid schedules preserve the last clock', async () => {
  const view = mount();
  await view.respond();
  const accepted = view.render().event;
  view.poll();
  await view.respond();
  assert.equal(view.render().event, accepted);
  view.advance(15000);
  view.poll();
  await view.respond({...config, startsAt:'not a date'}, 'Mon, 09 Nov 2037 18:55:00 GMT');
  assert.equal(view.render().event, accepted);
  assert.equal(view.first.clockNow(), serverTime + 15000);
  view.cleanup();
});

test('visibility refresh aborts old requests and unmount removes timers and listeners', async () => {
  const view = mount();
  const original = view.requests[0];
  view.document.visibilityState = 'hidden';
  view.listeners.get('visibilitychange')();
  assert.equal(view.requests.length, 1);
  view.document.visibilityState = 'visible';
  view.listeners.get('visibilitychange')();
  assert.equal(original.options.signal.aborted, true);
  assert.equal(view.requests.length, 2);
  view.cleanup();
  assert.equal(view.requests[1].options.signal.aborted, true);
  assert.equal(view.timers.size, 0);
  assert.equal(view.listeners.size, 0);
  await view.respond();
  assert.equal(view.render().event, initialEvent);
});

test('schedule validation requires an unambiguous time and safe recording source', () => {
  const view = mount();
  for (const invalid of [null, [], {...config, startsAt:'2026-11-09T12:55:00'}, {...config, timeZone:'Neverland'}, {...config, durationMinutes:0}, {...config, durationMinutes:'55'}, {...config, recordingSrc:'javascript:alert(1)'}]) {
    assert.equal(view.validate(invalid), null);
  }
  assert.equal(view.validate({...config, recordingSrc:'/video.mp4'}).recordingSrc, '/video.mp4');
  assert.equal(view.validate({...config, recordingSrc:undefined}).startsAt, config.startsAt);
  view.cleanup();
});
