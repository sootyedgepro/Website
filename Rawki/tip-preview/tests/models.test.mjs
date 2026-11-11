import test from 'node:test';
import assert from 'node:assert/strict';
import {CLASS_EVENT,eventStatus,countdown,eventTime,eventDate,calendarIcs,validEmail,validUsername} from '../shared/models.mjs';
test('published event is noon Eastern and eleven Central after DST ends',()=>{
 assert.match(eventTime(CLASS_EVENT,'America/New_York'),/12:00 PM EST/);
 assert.match(eventTime(CLASS_EVENT,'America/Chicago'),/11:00 AM CST/);
 assert.equal(eventDate(CLASS_EVENT),'Saturday, November 14, 2026');
});
test('calendar uses the same UTC event and 55 minute duration',()=>{
 const ics=calendarIcs(CLASS_EVENT,new Date('2026-11-06T12:00:00Z'));
 assert.match(ics,/DTSTART:20261114T170000Z\r\n/);
 assert.match(ics,/DTEND:20261114T175500Z\r\n/);
 assert.match(ics,/LOCAL REVIEW DRAFT/);
 assert.ok(!ics.includes('https://zoom'));
 for(const line of ics.split('\r\n'))assert.ok(new TextEncoder().encode(line).length<=75,'Calendar line exceeds 75 octets');
});
test('event state and countdown stop after the class',()=>{
 const start=Date.parse(CLASS_EVENT.startsAt);
 assert.equal(eventStatus(CLASS_EVENT,start-1),'upcoming');
 assert.equal(eventStatus(CLASS_EVENT,start),'live');
 assert.equal(eventStatus(CLASS_EVENT,start+55*60000),'ended');
 assert.deepEqual(countdown(CLASS_EVENT,start+1),{days:0,hours:0,minutes:0,seconds:0});
 assert.deepEqual(countdown(CLASS_EVENT,start-90061000),{days:1,hours:1,minutes:1,seconds:1});
});
test('review input checks reject incomplete or mistaken activation data',()=>{
 assert.ok(validEmail('owner@example.test'));
 assert.ok(!validEmail('not-an-email'));
 assert.ok(validUsername('ReviewTrader_1'));
 assert.ok(!validUsername('@ReviewTrader'));
 assert.ok(!validUsername('https://tradingview.com/u/test'));
 assert.ok(!validUsername(' '));
});

