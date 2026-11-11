import React, {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import TearTicket from './vendor/react-bits/TearTicket.jsx';
import {Backlight} from './vendor/magic-ui/Backlight.jsx';
import {eventDate, eventTime, eventStatus, validEmail, escapeIcs, foldIcsLine} from './models.mjs';
import {readSavedRegistration, saveCompletedRegistration, clearSavedRegistration, validTicketEvent} from './registration-storage.mjs';
import './registration-ticket.css';
import {captureLead} from '../../tracking-client.mjs';

// Draft details stay in memory; only a completed ticket is saved on this browser.
const emptyRegistration = () => ({firstName:'', email:'', consent:false, weeklyInvitations:false, event:null,
  step:1, timeConfirmed:false, unlocked:false, torn:false, ticketId:'', tearRevision:0, files:null, delivery:'idle', error:'', disclosures:[], storageSaved:false, saving:false});
const savedRegistration = readSavedRegistration();
let registration = {...emptyRegistration(), ...(savedRegistration ? {
  firstName:savedRegistration.firstName, email:savedRegistration.email, consent:savedRegistration.consent,
  weeklyInvitations:savedRegistration.weeklyInvitations, event:savedRegistration.event, ticketId:savedRegistration.ticketId,
  step:4, timeConfirmed:true, unlocked:true, torn:true, storageSaved:true, delivery:'unconfigured'
} : {})};
const listeners = new Set();
let deliveryAdapter = null;
let ticketController = null;
const subscribe = listener => {listeners.add(listener); return () => listeners.delete(listener)};
const snapshot = () => registration;
function update(patch) {registration = {...registration, ...patch}; listeners.forEach(listener => listener())}
export function useTicketRegistration() {return useSyncExternalStore(subscribe, snapshot, snapshot)}
function releaseFiles() {
  if (!registration.files) return;
  URL.revokeObjectURL(registration.files.ticketUrl);
  URL.revokeObjectURL(registration.files.calendarUrl);
}
export function editTicketDetails(patch = {}) {
  if(registration.saving)return;
  releaseFiles();
  update({...patch, step:2, unlocked:false, torn:false, ticketId:'', files:null, delivery:'idle', error:''});
}
export function setTicketStep(step) {
  const next = Math.max(1, Math.min(4, Number(step) || 1));
  if (registration.saving || registration.torn || (next === 4 && !registration.unlocked)) return;
  update({step:next, ...(next < 4 ? {unlocked:false} : {})});
}
export function confirmTicketTime(checked) {
  if(registration.saving)return;
  if(!checked){releaseFiles();update({timeConfirmed:false,unlocked:false,torn:false,ticketId:'',files:null,delivery:'idle',error:'',step:Math.min(3,registration.step)})}
  else if(registration.event) update({timeConfirmed:true,error:''});
}
export function setTicketEvent(event) {
  if(registration.saving)return;
  const old = registration.event;
  if (!validTicketEvent(event) || eventStatus(event) !== 'upcoming' || registration.torn) return;
  if (old?.id === event.id && old.startsAt === event.startsAt) { update({timeConfirmed:true,error:''}); return; }
  releaseFiles();
  update({event, timeConfirmed:true, unlocked:false, ticketId:'', files:null, delivery:'idle', error:''});
}
export function preparePersonalTicket() {
  if(registration.saving)return false;
  if (!registration.firstName.trim() || !validEmail(registration.email) || !registration.consent || !registration.timeConfirmed || !registration.event || eventStatus(registration.event) !== 'upcoming') return false;
  const ticketId = globalThis.crypto?.randomUUID?.() || 'tip-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  update({step:4, unlocked:true, ticketId, error:''});
  return true;
}
export function resetPersonalTicket() {
  if(registration.saving)return;
  releaseFiles();
  clearSavedRegistration();
  update({...emptyRegistration(), disclosures:registration.disclosures, tearRevision:registration.tearRevision+1});
  requestAnimationFrame(()=>document.querySelector('#reserve .stepper__button--next')?.focus());
}
const xml = value => String(value).replace(/[<>&"']/g, character => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[character]));
const utc = value => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

export function buildPersonalCalendar({event, firstName, ticketId, classroomUrl, now = new Date()}) {
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Traveling in Profit//Personal class ticket//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH',
    'BEGIN:VEVENT','UID:'+escapeIcs(ticketId)+'@travelinginprofit','DTSTAMP:'+utc(now),
    'DTSTART:'+utc(event.startsAt),'DTEND:'+utc(new Date(new Date(event.startsAt).getTime()+event.durationMinutes*60000)),
    'SUMMARY:Traveling in Profit — class with Zi Morris',
    'DESCRIPTION:'+escapeIcs('Class ticket for '+firstName.trim()+'. '+event.durationMinutes+' minutes. Open the classroom: '+classroomUrl),
    'URL:'+classroomUrl,'LOCATION:Online classroom','BEGIN:VALARM','TRIGGER:-PT15M','ACTION:DISPLAY',
    'DESCRIPTION:Traveling in Profit starts in 15 minutes','END:VALARM','END:VEVENT','END:VCALENDAR',''].map(foldIcsLine).join('\r\n');
}
export function buildPersonalTicketSvg({event, firstName, ticketId}) {
  const name=firstName.trim(), fittedName=name.length>26?' textLength="570" lengthAdjust="spacingAndGlyphs"':'';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="600" viewBox="0 0 1100 600" role="img" aria-labelledby="title desc">'
    +'<title id="title">Traveling in Profit personal class ticket</title><desc id="desc">'+xml(name)+' · '+xml(eventDate(event,event.timeZone))+' · '+xml(eventTime(event,event.timeZone))+'</desc>'
    +'<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#12364a"/><stop offset="1" stop-color="#04131f"/></linearGradient></defs>'
    +'<rect width="1100" height="600" rx="34" fill="#031019"/><rect x="18" y="18" width="1064" height="564" rx="25" fill="url(#bg)" stroke="#5c9bac"/>'
    +'<path d="M45 340L130 315 200 330 280 255 350 285 430 210 505 225 570 160 640 175 735 110" fill="none" stroke="#55dbce" stroke-opacity=".14" stroke-width="4"/>'
    +'<path d="M800 20V580" stroke="#84dfe4" stroke-opacity=".45" stroke-dasharray="5 10"/>'
    +'<g font-family="Arial,Helvetica,sans-serif"><text x="64" y="78" font-size="15" letter-spacing="4" fill="#9acdd8">TRAVELING IN PROFIT</text>'
    +'<text x="64" y="150" font-size="49" font-weight="700" fill="#f0fcff">Behind the trade.</text><text x="66" y="184" font-size="17" fill="#94c8d6">A class with Zi Morris</text>'
    +'<text x="66" y="268" font-size="12" letter-spacing="3" fill="#76a3b7">PREPARED FOR</text><text x="64" y="319" font-size="38" font-weight="600" fill="#bef7ed"'+fittedName+'>'+xml(name)+'</text>'
    +'<path d="M64 359H740" stroke="#4b7789"/><text x="64" y="410" font-size="22" fill="#e1f4f8">'+xml(eventDate(event,event.timeZone))+'</text>'
    +'<text x="64" y="453" font-size="27" fill="#8ae5e9">'+xml(eventTime(event,event.timeZone))+'</text><text x="64" y="520" font-size="13" fill="#8cafbf">'+xml(ticketId)+'</text>'
    +'<text x="842" y="128" font-size="14" letter-spacing="3" fill="#aadbe3">CLASS</text><text x="839" y="190" font-size="49" font-weight="700" fill="#e9fcff">FREE</text>'
    +'<text x="843" y="230" font-size="17" fill="#a5ced9">'+event.durationMinutes+' MINUTES</text><text x="843" y="400" font-size="14" fill="#a5ced9">YOUR REMINDER</text>'
    +'<text x="843" y="430" font-size="14" fill="#a5ced9">15 minutes before</text><text x="843" y="460" font-size="12" fill="#779baa">Import the .ics file</text><text x="843" y="480" font-size="12" fill="#779baa">into your calendar.</text></g></svg>';
}

// Integration hook only: no endpoint is configured in the static site.
// An adapter must return {status:'accepted', messageId} after provider acceptance.
export function configureRegistrationDelivery(adapter) {
  if (adapter!==null && typeof adapter!=='function') throw new TypeError('The ticket delivery adapter must be a function or null.');
  deliveryAdapter=adapter;
}
export function createTicketEmailAdapter(endpoint) {
  const target=new URL(endpoint,window.location.origin);
  if(target.origin!==window.location.origin || !/^https?:$/.test(target.protocol)) throw new Error('Ticket delivery requires an explicitly configured same-origin endpoint.');
  return async payload=>{
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch(target,{method:'POST',credentials:'same-origin',signal:controller.signal,
        headers:{'Content-Type':'application/json','Idempotency-Key':payload.ticketId},body:JSON.stringify(payload)});
      if(!response.ok)throw new Error('The delivery service did not accept the request.');
      const result=await response.json();
      if(result.status!=='accepted'||typeof result.messageId!=='string'||!result.messageId.trim())throw new Error('Ticket delivery was not confirmed.');
      return result;
    }finally{clearTimeout(timeout)}
  };
}
async function deliverTicket(){
  const current=registration;
  if(!current.files||current.delivery==='sending'||current.delivery==='accepted')return;
  if(!deliveryAdapter){update({delivery:'unconfigured'});return}
  update({delivery:'sending'});
  try{
    const result=await deliveryAdapter({ticketId:current.ticketId,
      attendee:{firstName:current.firstName.trim(),email:current.email.trim()},event:current.event,
      consent:{eventContact:current.consent,futureInvitations:current.weeklyInvitations},
      attachments:[{filename:current.files.ticketName,contentType:'image/svg+xml',content:current.files.svg},
        {filename:current.files.calendarName,contentType:'text/calendar; charset=utf-8',content:current.files.ics}]});
    if(result?.status!=='accepted'||typeof result.messageId!=='string'||!result.messageId.trim())throw new Error('Delivery not confirmed');
    if(registration.ticketId===current.ticketId)update({delivery:'accepted'});
  }catch{if(registration.ticketId===current.ticketId)update({delivery:'failed'})}
}
export const retryTicketDelivery=()=>deliverTicket();
function download(url,filename){
  const link=document.createElement('a');link.href=url;link.download=filename;
  document.body.append(link);try{link.click()}finally{link.remove()}
}
function createTicketFiles(current) {
  let ticketUrl, calendarUrl;
  try {
    const classroomUrl = new URL('/travelinginprofit/classroom/', location.origin).href;
    const svg = buildPersonalTicketSvg(current), ics = buildPersonalCalendar({...current, classroomUrl});
    ticketUrl = URL.createObjectURL(new Blob([svg], {type:'image/svg+xml;charset=utf-8'}));
    calendarUrl = URL.createObjectURL(new Blob([ics], {type:'text/calendar;charset=utf-8'}));
    const slug = current.firstName.trim().normalize('NFKD').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').slice(0,40) || 'guest';
    return {svg,ics,ticketUrl,calendarUrl,ticketName:'traveling-in-profit-'+slug+'.svg',calendarName:'traveling-in-profit-class.ics'};
  } catch (error) {
    if(ticketUrl) URL.revokeObjectURL(ticketUrl);
    if(calendarUrl) URL.revokeObjectURL(calendarUrl);
    throw error;
  }
}
async function completeTicketTear({restoreFocus=false}={}){
  const current=registration;
  if(current.torn||current.saving)return false;
  if(!current.unlocked||!current.firstName.trim()||!validEmail(current.email)||!current.consent||!current.timeConfirmed||!current.event||eventStatus(current.event)!=='upcoming'){
    update({unlocked:false,tearRevision:current.tearRevision+1,error:'Your ticket could not be saved. Please check your details and the scheduled class time.'});
    return false;
  }
  update({saving:true,error:''});
  let files;
  try{
    files=createTicketFiles(current);
    await captureLead('registration_completed',{name:current.firstName.trim(),email:current.email.trim(),consent:current.consent,
      marketingConsent:current.weeklyInvitations,eventId:'registration_'+current.ticketId,
      metadata:{form:'class-ticket',ticketId:current.ticketId,eventStart:current.event.startsAt,duration:current.event.durationMinutes*60}});
    // Only a confirmed collector response completes the ticket. Failed requests
    // leave the same event ID retryable so an interrupted response cannot duplicate it.
    const saved=saveCompletedRegistration({...current,torn:true});
    update({torn:true,files,storageSaved:saved.ok,error:'',saving:false});
    if(restoreFocus)requestAnimationFrame(()=>document.querySelector('#reserve .tip-ticket-keepsake a')?.focus({preventScroll:true}));
    // A browser download policy must not invalidate successfully created files.
    // Persistent links remain available if automatic downloads are blocked.
    try{download(files.ticketUrl,files.ticketName)}catch{}
    try{download(files.calendarUrl,files.calendarName)}catch{}
    void deliverTicket();return true;
  }catch{
    if(files){URL.revokeObjectURL(files.ticketUrl);URL.revokeObjectURL(files.calendarUrl)}
    update({torn:false,saving:false,files:null,tearRevision:current.tearRevision+1,error:'Your registration could not be confirmed. Your details are still here. Please try collecting your stub again.'});return false;
  }
}
export function tearPersonalTicket(){
  if(!registration.unlocked||registration.torn||registration.saving)return false;
  if(ticketController?.current)return ticketController.current.tear();
  return completeTicketTear();
}

function NativeContent({nodes,className}){
  const host=useRef(null);
  useEffect(()=>{const target=host.current;nodes.forEach(node=>target.append(node));return()=>nodes.forEach(node=>{if(node.parentNode===target)node.remove()})},[nodes]);
  return <div ref={host} className={className}/>;
}
export default function RegistrationTicket({heading,controls:_controls,disclosure}){
  const stage=useRef(null),controller=useRef(null),downloadLink=useRef(null);
  const state=useTicketRegistration(),{event,firstName,email,unlocked,torn,files}=state;
  const [width,setWidth]=useState(520),[visible,setVisible]=useState(false);
  const [quiet,setQuiet]=useState(()=>document.documentElement.dataset.motion==='paused'||document.hidden);
  const compact=width<390;
  useEffect(()=>{
    // Rebuild Blob URLs after a revisit. Restoring never sends mail or downloads.
    if(!registration.torn || registration.files) return;
    try { update({files:createTicketFiles(registration)}); }
    catch { update({error:'Your saved ticket could not be opened in this browser. Please reload and try again.'}); }
  },[]);
  useEffect(()=>{
    ticketController=controller;
    const paragraphs=disclosure.filter(node=>node.matches('p')).map(node=>({text:node.textContent.trim(),offer:node.classList.contains('offer-disclosure')}));
    update({disclosures:paragraphs});
    return()=>{if(ticketController===controller)ticketController=null};
  },[disclosure]);
  useEffect(()=>{
    let paused=document.documentElement.dataset.motion==='paused';
    const updateQuiet=()=>setQuiet(paused||document.hidden);
    const change=message=>{paused=!!message.detail?.paused;updateQuiet()};
    document.addEventListener('funnelmotionchange',change);document.addEventListener('visibilitychange',updateQuiet);
    return()=>{document.removeEventListener('funnelmotionchange',change);document.removeEventListener('visibilitychange',updateQuiet)};
  },[]);
  useEffect(()=>{
    if(torn&&document.activeElement?.closest('.tear-ticket__piece--stub'))downloadLink.current?.focus({preventScroll:true});
  },[torn]);
  useEffect(()=>{
    const observer=new ResizeObserver(entries=>setWidth(Math.max(240,Math.min(520,Math.floor(entries[0].contentRect.width)))));
    const intersection=new IntersectionObserver(entries=>setVisible(entries.some(entry=>entry.isIntersecting)),{rootMargin:'100px'});
    observer.observe(stage.current);intersection.observe(stage.current);
    return()=>{observer.disconnect();intersection.disconnect()};
  },[]);
  const date=event?new Intl.DateTimeFormat('en-US',{timeZone:event.timeZone,weekday:'short',month:'short',day:'numeric'}).format(new Date(event.startsAt)):'';
  const ready=unlocked&&state.step===4&&!torn;
  return <div className="tip-ticket-composition tip-tear-composition" data-complete={torn?'':undefined} data-ready={ready?'':undefined}>
    <NativeContent nodes={heading} className="tip-ticket-heading"/>
    <div ref={stage} className="tip-tear-stage">
      <Backlight className="tip-ticket-backlight" blur={22}><div aria-hidden="true" className="tip-ticket-glow-surface"/></Backlight>
      <TearTicket key={state.ticketId+':'+state.tearRevision} className="tip-class-ticket" width={width} height={compact?306:318} stubSize={compact?80:108}
        radius={18} holes={15} holeSize={5} notch={8} roughness={1.1} tearAngle={30} stretch={25}
        rotate={torn?0:-2} tilt={visible&&!quiet&&!torn} tiltMax={7} tiltReach={150} parallax={quiet||torn?0:12} perspective={1100}
        background="#081b2b" stubBackground={unlocked?'#76e4ed':'#284c5c'} color="#d7faff" borderColor="#74cdd68c"
        image="/travelinginprofit/charts/sooty-flow-tracker.webp" imageAlt="" imageRadius={12} scrim
        disabled={!unlocked||!event||state.saving||eventStatus(event)!=='upcoming'} torn={torn} onTear={completeTicketTear} controlsRef={controller} recenter
        usedLabel="Personal ticket and calendar reminder ready to download"
        ariaLabel="Tear and download your personal ticket and calendar reminder. Drag the stub, or press Enter or Space."
        stub={<div className={'tip-ticket-stub-content'+(unlocked?' is-ready':'')}>
          <span className="tip-ticket-stub-type">YOUR<br/>REMINDER</span><strong>FREE</strong>
          <span className="tip-ticket-stub-duration">55 MIN</span>
          <span className="tip-ticket-stub-arrow" aria-hidden="true">{unlocked?'↗':'◇'}</span>
          <span className="tip-ticket-stub-hint">{unlocked?'TEAR TO SAVE':'LOCKED'}</span><span className="tip-ticket-stub-bars" aria-hidden="true"/>
        </div>}>
        <div className="tip-ticket-face">
          <div className="tip-ticket-face-brand"><img src="/travelinginprofit/branding/sootyedge-gold-logo.webp" alt=""/><span>TRAVELING<br/><strong>IN PROFIT</strong></span></div>
          <div className="tip-ticket-face-title"><span>WITH ZI MORRIS</span><strong>Behind<br/>the trade.</strong></div>
          <div className="tip-ticket-attendee"><span>PREPARED FOR</span><strong title={firstName.trim()||undefined}>{firstName.trim()||'Your name'}</strong><small title={email.trim()||undefined}>{email.trim()||'Your email address'}</small></div>
          <div className="tip-ticket-face-date" aria-label={event?undefined:'Select your class date and time in the form'}><span>{date}</span><strong>{event?eventTime(event,event.timeZone):''}</strong></div>
        </div>
      </TearTicket>
    </div>
    {state.saving&&<p role="status" className="tip-ticket-storage-notice">Saving your registration…</p>}
    {torn&&files&&<div className="tip-ticket-keepsake">
      <p className="tip-ticket-keepsake-title" role="status">We'll see you in class, {firstName.trim()}.</p>
      <div className="tip-ticket-downloads">
        <a ref={downloadLink} href={files.ticketUrl} download={files.ticketName}>Save my ticket <span aria-hidden="true">↓</span></a>
        <a href={files.calendarUrl} download={files.calendarName}>Add to calendar <span aria-hidden="true">↓</span></a>
      </div>
      <a className="tip-ticket-classroom" href="/travelinginprofit/classroom/">Open the classroom <span aria-hidden="true">↗</span></a>
      {!state.storageSaved&&<p className="tip-ticket-storage-notice" role="status">Your downloads are ready. This browser couldn't save your ticket for your next visit.</p>}
      <button className="tip-ticket-reset" type="button" onClick={resetPersonalTicket}>Start a new ticket</button>
    </div>}
  </div>;
}
