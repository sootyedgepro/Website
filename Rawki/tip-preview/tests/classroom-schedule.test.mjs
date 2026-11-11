import test from 'node:test';
import assert from 'node:assert/strict';
import {classroomSchedule,scheduledPlaybackPosition,countdownParts,resolveClassroomEvent,livePlaybackBounds,clampLiveSeek} from '../funnel/shared/classroom-schedule.mjs';
import {CLASS_EVENT} from '../funnel/shared/models.mjs';
import fs from 'node:fs/promises';

const event={startsAt:'2026-11-14T17:00:00Z',durationMinutes:55};
const start=Date.parse(event.startsAt),end=start+55*60*1000;

test('the published classroom date overrides older tickets and opens at its configured instant',async()=>{
  const html=await fs.readFile(new URL('../funnel/public/classroom/index.html',import.meta.url),'utf8');
  const override={startsAt:html.match(/data-event-start="([^"]+)"/)[1],timeZone:html.match(/data-event-timezone="([^"]+)"/)[1]};
  const selected=resolveClassroomEvent(override,CLASS_EVENT,CLASS_EVENT);
  const publishedStart=Date.parse(override.startsAt);
  assert.ok(Number.isFinite(publishedStart));
  assert.equal(selected.startsAt,override.startsAt);
  assert.equal(selected.timeZone,override.timeZone);
  assert.equal(classroomSchedule(selected,publishedStart-1000).remaining,1);
  assert.equal(classroomSchedule(selected,publishedStart).phase,'live');
  assert.equal(classroomSchedule(selected,publishedStart+selected.durationMinutes*60000).phase,'ended');
  assert.equal(resolveClassroomEvent(null,CLASS_EVENT,event),CLASS_EVENT);
});

test('countdown ends exactly at scheduled start and only the event window is playable',()=>{
  assert.deepEqual(classroomSchedule(event,start-1),{phase:'upcoming',remaining:1,position:0});
  assert.deepEqual(classroomSchedule(event,start),{phase:'live',remaining:0,position:0});
  assert.equal(classroomSchedule(event,end-1).phase,'live');
  assert.deepEqual(classroomSchedule(event,end),{phase:'ended',remaining:0,position:3300});
});
test('late arrival and return from pause use wall-clock position, without looping short recordings',()=>{
  assert.equal(scheduledPlaybackPosition(event,start+137500,3300),137.5);
  assert.equal(scheduledPlaybackPosition(event,start+197500,3300),197.5);
  assert.equal(scheduledPlaybackPosition(event,start+137500,120),null);
  assert.equal(scheduledPlaybackPosition(event,start-1,3300),null);
  assert.equal(scheduledPlaybackPosition(event,end,3300),null);
});
test('explicit owner preview bypasses dates without changing visitor schedule',()=>{
  assert.equal(classroomSchedule(event,start-5000,true).phase,'preview');
  assert.equal(classroomSchedule(event,end+5000,true).phase,'preview');
  assert.equal(classroomSchedule(event,start-5000,false).phase,'upcoming');
});
test('invalid schedules fail closed and countdown parts preserve whole remaining seconds',()=>{
  assert.equal(classroomSchedule({...event,startsAt:'invalid'},start).phase,'unavailable');
  assert.deepEqual(countdownParts(90061),{days:1,hours:1,minutes:1,seconds:1});
  assert.deepEqual(countdownParts(-12),{days:0,hours:0,minutes:0,seconds:0});
});

test('DVR bounds follow the shared clock and preserve a viewer rewind',()=>{
  const first=livePlaybackBounds(event,start+120000,3300);
  assert.deepEqual(first,{phase:'live',liveEdge:120,canPlay:true});
  assert.equal(clampLiveSeek(75,first.liveEdge),75);
  assert.equal(clampLiveSeek(700,first.liveEdge),120);
  const later=livePlaybackBounds(event,start+150000,3300);
  // A paused or rewound viewer can resume from the same location; chat can
  // independently use later.liveEdge and keep advancing with the broadcast.
  assert.equal(clampLiveSeek(75,later.liveEdge),75);
  assert.equal(clampLiveSeek(later.liveEdge,later.liveEdge),150);
});

test('DVR handles the first frame, event end, and shorter recording safely',()=>{
  assert.deepEqual(livePlaybackBounds(event,start-1,3300),{phase:'upcoming',liveEdge:0,canPlay:false});
  assert.deepEqual(livePlaybackBounds(event,start,3300),{phase:'live',liveEdge:0,canPlay:true});
  assert.deepEqual(livePlaybackBounds(event,end,3300),{phase:'ended',liveEdge:3299.95,canPlay:false});
  assert.deepEqual(livePlaybackBounds(event,start+100000,90),{phase:'ended',liveEdge:89.95,canPlay:false});
  assert.deepEqual(livePlaybackBounds(event,start,0),{phase:'ended',liveEdge:0,canPlay:false});
  assert.deepEqual(livePlaybackBounds(event,start+100000,NaN),{phase:'live',liveEdge:100,canPlay:true});
  assert.deepEqual(livePlaybackBounds({...event,startsAt:'invalid'},start,3300),{phase:'unavailable',liveEdge:0,canPlay:false});
});

test('seek clamps reject invalid positions and cannot escape the broadcast boundary',()=>{
  assert.equal(clampLiveSeek(-10,100),0);
  assert.equal(clampLiveSeek(NaN,100),0);
  assert.equal(clampLiveSeek(Infinity,100),0);
  assert.equal(clampLiveSeek(30,NaN),0);
  assert.equal(clampLiveSeek(30,-1),0);
  assert.equal(clampLiveSeek(99.5,100),99.5);
});
