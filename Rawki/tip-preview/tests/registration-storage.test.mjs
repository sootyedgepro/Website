import test from 'node:test';
import assert from 'node:assert/strict';
import {availableTicketEvents, validTicketEvent, readSavedRegistration, saveCompletedRegistration,
  clearSavedRegistration, getSavedRegistrationEvent, SAVED_TICKET_KEY, TICKET_RETENTION_MS} from '../funnel/shared/registration-storage.mjs';

const now = Date.parse('2026-11-09T18:00:00Z');
const memoryStorage = () => {
  const values = new Map();
  return {getItem:key=>values.get(key)??null, setItem:(key,value)=>values.set(key,value), removeItem:key=>values.delete(key)};
};
const completed = () => ({firstName:'  Jamie  ',email:'jamie@example.test',consent:true,weeklyInvitations:false,
  event:availableTicketEvents(now)[1],ticketId:'12345678-abcd-4321-abcd-123456789abc',torn:true,
  files:{ticketUrl:'blob:never-persist'},delivery:'accepted',error:'never-persist'});

test('offers the next four Saturdays at noon New York and skips a class that has started',()=>{
  assert.deepEqual(availableTicketEvents(now).map(event=>event.startsAt),[
    '2026-11-14T17:00:00.000Z','2026-11-21T17:00:00.000Z','2026-11-28T17:00:00.000Z','2026-12-05T17:00:00.000Z']);
  assert.equal(availableTicketEvents(Date.parse('2026-11-14T17:00:00Z'))[0].startsAt,'2026-11-21T17:00:00.000Z');
  assert.deepEqual(availableTicketEvents(NaN),[]);
});

test('weekly availability keeps local noon across both daylight-saving changes',()=>{
  const spring=availableTicketEvents(Date.parse('2026-03-06T15:00:00Z'));
  assert.equal(spring[0].startsAt,'2026-03-07T17:00:00.000Z');
  assert.equal(spring[1].startsAt,'2026-03-14T16:00:00.000Z');
  const fall=availableTicketEvents(Date.parse('2026-10-30T15:00:00Z'));
  assert.equal(fall[0].startsAt,'2026-10-31T16:00:00.000Z');
  assert.equal(fall[1].startsAt,'2026-11-07T17:00:00.000Z');
});

test('saves only a completed validated ticket and restores the selected event without transient URLs',()=>{
  const storage=memoryStorage(), input=completed();
  assert.equal(saveCompletedRegistration({...input,torn:false},storage,now).ok,false);
  assert.equal(storage.getItem(SAVED_TICKET_KEY),null);
  assert.equal(saveCompletedRegistration(input,storage,now).ok,true);
  const restored=readSavedRegistration(storage,now+1000);
  assert.equal(restored.firstName,'Jamie');
  assert.equal(restored.email,input.email);
  assert.equal(restored.event.startsAt,input.event.startsAt);
  assert.equal(Date.parse(restored.expiresAt),Date.parse(input.event.startsAt)+55*60000+TICKET_RETENTION_MS);
  assert.equal('files' in restored,false);
  assert.equal('delivery' in restored,false);
  assert.equal('error' in restored,false);
  assert.deepEqual(getSavedRegistrationEvent(storage,now+1000),restored.event);
  clearSavedRegistration(storage);
  assert.equal(getSavedRegistrationEvent(storage,now),null);
});

test('expired, malformed, or edited records are discarded instead of crashing restoration',()=>{
  for(const mutation of [value=>({...value,version:2}),value=>({...value,consent:false}),
    value=>({...value,event:{...value.event,startsAt:'2026-11-22T17:00:00Z'}}),
    value=>({...value,expiresAt:'2099-01-01T00:00:00Z'}),value=>({...value,email:'not-an-email'}),
    value=>({...value,completedAt:'2025-01-01T00:00:00Z'})]) {
    const storage=memoryStorage();
    const {record}=saveCompletedRegistration(completed(),storage,now);
    storage.setItem(SAVED_TICKET_KEY,JSON.stringify(mutation(record)));
    assert.equal(readSavedRegistration(storage,now),null);
    assert.equal(storage.getItem(SAVED_TICKET_KEY),null);
  }
  const storage=memoryStorage();
  const {record}=saveCompletedRegistration(completed(),storage,now);
  assert.equal(readSavedRegistration(storage,Date.parse(record.expiresAt)),null);
  storage.setItem(SAVED_TICKET_KEY,'{not-json');
  assert.equal(readSavedRegistration(storage,now),null);
  assert.equal(storage.getItem(SAVED_TICKET_KEY),null);
});

test('storage restrictions and invalid input fail safely while valid in-memory tickets remain usable',()=>{
  const denied={getItem(){throw new Error('denied')},setItem(){throw new Error('full')},removeItem(){throw new Error('denied')}};
  assert.equal(readSavedRegistration(denied,now),null);
  assert.equal(saveCompletedRegistration(completed(),denied,now).ok,false);
  assert.equal(saveCompletedRegistration({...completed(),event:null},memoryStorage(),now).ok,false);
  assert.equal(saveCompletedRegistration(completed(),memoryStorage(),NaN).ok,false);
  assert.equal(validTicketEvent({...completed().event,startsAt:'2026-11-21T18:00:00Z'}),false);
  assert.doesNotThrow(()=>clearSavedRegistration(denied));
});

test('the necessary cookie is only a same-site marker; personal details remain in browser storage',()=>{
  const documentBefore=Object.getOwnPropertyDescriptor(globalThis,'document');
  const locationBefore=Object.getOwnPropertyDescriptor(globalThis,'location');
  const cookies=[];
  try {
    Object.defineProperty(globalThis,'document',{configurable:true,value:{set cookie(value){cookies.push(value)}}});
    Object.defineProperty(globalThis,'location',{configurable:true,value:{protocol:'https:'}});
    const storage=memoryStorage();
    assert.equal(saveCompletedRegistration(completed(),storage,now).ok,true);
    assert.match(cookies[0],/^tip_ticket_saved=1; Path=\/travelinginprofit\/; SameSite=Lax; Expires=/);
    assert.match(cookies[0],/; Secure$/);
    assert.doesNotMatch(cookies[0],/Jamie|jamie|example|12345678/);
    clearSavedRegistration(storage);
    assert.match(cookies[1],/tip_ticket_saved=;.*Max-Age=0/);
    assert.equal(storage.getItem(SAVED_TICKET_KEY),null);
  } finally {
    if(documentBefore)Object.defineProperty(globalThis,'document',documentBefore);else delete globalThis.document;
    if(locationBefore)Object.defineProperty(globalThis,'location',locationBefore);else delete globalThis.location;
  }
});
