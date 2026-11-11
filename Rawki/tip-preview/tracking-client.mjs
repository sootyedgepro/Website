const PREFERENCE='streamline.analytics.v1', VISITOR='streamline.visitor.v1', SESSION='streamline.session.v1', ATTRIBUTION='streamline.attribution.v1';
const uuid=()=>crypto.randomUUID();
const storage=(which,method,key,value)=>{try{return globalThis[which][method](key,value)}catch{return null}};
const idValid=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{6,100}$/.test(value);
const site=()=>location.pathname.startsWith('/travelinginprofit')?'travelinginprofit':'sootyedge';
export function analyticsAllowed(){return storage('localStorage','getItem',PREFERENCE)==='on' && navigator.globalPrivacyControl!==true;}
export function setAnalyticsPreference(allowed){
  storage('localStorage','setItem',PREFERENCE,allowed?'on':'off');
  if(!allowed){storage('localStorage','removeItem',VISITOR);storage('sessionStorage','removeItem',SESSION);storage('sessionStorage','removeItem',ATTRIBUTION);}
  window.dispatchEvent(new Event('streamlineconsentchange'));
  if(allowed) void trackEvent('page_view');
}
function identity(){
  let visitorId=storage('localStorage','getItem',VISITOR),sessionId=storage('sessionStorage','getItem',SESSION);
  if(!idValid(visitorId)){visitorId=uuid();storage('localStorage','setItem',VISITOR,visitorId)}
  if(!idValid(sessionId)){sessionId=uuid();storage('sessionStorage','setItem',SESSION,sessionId)}
  return {visitorId,sessionId};
}
function attribution(){
  let saved={};try{saved=JSON.parse(storage('sessionStorage','getItem',ATTRIBUTION)||'{}')}catch{}
  const params=new URLSearchParams(location.search),utm={};
  for(const key of ['source','medium','campaign','content','term']){
    const value=params.get('utm_'+key);
    if(value&&/^[a-zA-Z0-9 _.,:+/-]{1,120}$/.test(value))utm[key]=value;
  }
  if(Object.keys(utm).length){saved={utm};storage('sessionStorage','setItem',ATTRIBUTION,JSON.stringify(saved))}
  try{saved.referrer=new URL(document.referrer).hostname}catch{}
  return saved;
}
async function send(event){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch('/api/streamline/events',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},signal:controller.signal,keepalive:true,body:JSON.stringify(event)});
    if(!response.ok)throw new Error('Your request could not be saved. Please try again.');
    const result=await response.json();
    if(result?.data?.accepted!==true||result.data.eventId!==event.eventId)throw new Error('Your request was not confirmed. Please try again.');
    return result.data;
  }finally{clearTimeout(timer)}
}
function eventBase(type,eventId,operationalId){
  const allowed=analyticsAllowed();
  return {eventId:eventId||uuid(),...(allowed?identity():{visitorId:operationalId,sessionId:operationalId}),site:site(),type,path:location.pathname,timestamp:new Date().toISOString(),analyticsConsent:allowed,...(allowed?attribution():{})};
}
export async function trackEvent(type,metadata={}){
  if(!analyticsAllowed())return {skipped:true};
  try{return await send({...eventBase(type),metadata})}catch{return {accepted:false}}
}
export async function captureLead(type,{name,email,consent,marketingConsent=false,eventId,metadata={}}){
  if(!['registration_completed','lead_magnet_requested','support_requested'].includes(type)||consent!==true)throw new Error('Please accept the contact notice.');
  const operationalId=eventId||uuid();
  return send({...eventBase(type,operationalId,operationalId),contact:{name,email,consent:true,marketingConsent},metadata:{...metadata,policyVersion:'streamline-contact-2026-11-09',consentAt:new Date().toISOString(),legalBasis:'explicit-contact-consent'}});
}

export function openAnalyticsPreferences(){
  let dialog=document.querySelector('#streamline-privacy');
  if(!dialog){
    dialog=document.createElement('dialog');dialog.id='streamline-privacy';dialog.setAttribute('aria-labelledby','streamline-privacy-title');
    dialog.innerHTML='<form method="dialog"><h2 id="streamline-privacy-title">Traffic preferences</h2><p>Allow anonymous visit and interaction measurement across SootyEdge and Traveling in Profit. It helps us understand which pages and campaigns bring people to the class.</p><label><input type="checkbox" name="analytics"> Allow optional analytics</label><p class="streamline-privacy-note">Off by default. Registration and checklist requests are still saved when you submit them. Your choice is separate from the interactive chart preference.</p><div><button value="cancel">Cancel</button><button value="save">Save preferences</button></div></form>';
    dialog.addEventListener('close',()=>{if(dialog.returnValue==='save')setAnalyticsPreference(dialog.querySelector('input').checked)});
    document.body.append(dialog);
  }
  const input=dialog.querySelector('input');input.checked=analyticsAllowed();input.disabled=navigator.globalPrivacyControl===true;
  dialog.returnValue='';dialog.showModal();
}

export function mountTrafficPreferences(doc=document){
  const visible=element=>!element.closest('[hidden]');
  const host=[...doc.querySelectorAll('footer')].find(visible)||[...doc.querySelectorAll('main')].find(visible)||doc.body;
  let row=doc.querySelector('[data-streamline-privacy]')?.closest('.streamline-privacy-link');
  if(!row){
    row=doc.createElement('div');row.className='streamline-privacy-link';
    const button=doc.createElement('button');button.type='button';button.textContent='Traffic preferences';button.dataset.streamlinePrivacy='';button.onclick=openAnalyticsPreferences;row.append(button);
  }
  if(row.parentElement!==host)host.append(row);
}

export function initializeTracking(){
  if(window.StreamLineTracking)return;
  window.StreamLineTracking={analyticsAllowed,setAnalyticsPreference,openAnalyticsPreferences,trackEvent,captureLead};
  const addPreferences=()=>{
    mountTrafficPreferences();
    if(location.pathname==='/free-checklist'||location.pathname==='/free-checklist/')configureChecklist();
    if(location.pathname==='/support'||location.pathname==='/support/')configureSupport();
    if(/\/privacy\/?$/.test(location.pathname)&&!document.querySelector('[data-streamline-policy]')){
      const notice=document.createElement('section');notice.dataset.streamlinePolicy='';notice.className='streamline-policy';
      const heading=document.createElement('h2');heading.textContent='How this site saves requests';
      const copy=document.createElement('p');copy.textContent='Submitted class registrations, checklist requests, and support requests are saved in Stream Line Agentic, our private customer system. We store the details you submit, your selected class or request category, and your contact and marketing choices. Optional traffic analytics are off until you allow them. If allowed, random browser identifiers connect visits across these two site experiences, along with page paths and campaign labels. We do not use device fingerprinting. Completed class tickets also stay in this browser so you can return to them.';
      const button=document.createElement('button');button.type='button';button.textContent='Manage traffic preferences';button.onclick=openAnalyticsPreferences;
      notice.append(heading,copy,button);(document.querySelector('main')||document.body).prepend(notice);
    }
    if(location.pathname==='/thank-you'||location.pathname==='/thank-you/'){
      document.querySelectorAll('p').forEach(p=>{if(/check your inbox|sent.*email|email.*sent/i.test(p.textContent))p.textContent='Your checklist is ready below. Save the guide and printable checklist to use with your next chart.'});
    }
  };
  window.StreamLineTracking.refreshControls=addPreferences;
  addPreferences();setTimeout(addPreferences,2000);
  void trackEvent('page_view');
  if(location.pathname.includes('/classroom'))void trackEvent('classroom_entered');
  document.addEventListener('click',event=>{
    const element=event.target.closest('a,button');if(!element||element.closest('#streamline-privacy'))return;
    const href=element.getAttribute('href')||'';
    let target='';try{const url=new URL(href,location.origin);if(/^https?:$/.test(url.protocol))target=url.origin===location.origin?url.pathname:url.hostname+url.pathname}catch{}
    const label=(element.getAttribute('aria-label')||element.textContent.trim().slice(0,100)).replace(/[^\s@]+@[^\s@]+/g,'[email]');
    if(/checkout|buy\.stripe|review-purchase/.test(href)||/get lifetime access|buy.*suite/i.test(label))void trackEvent('checkout_clicked',{label,target});
    else if(href||element.matches('[data-track-cta],.tip-ticket-tear-action'))void trackEvent('cta_click',{label,target});
  },true);
  const forms=new WeakSet();document.addEventListener('focusin',event=>{
    if(!event.target.matches('input,select,textarea'))return;
    const form=event.target.closest('.tip-registration-stepper,.registration-form,#get-checklist');
    if(form&&!forms.has(form)){forms.add(form);void trackEvent('registration_started',{form:form.id==='get-checklist'?'checklist':'class-registration'})}
  });
}
function configureChecklist(){
  const form=document.querySelector('#get-checklist');if(!form||form.hasAttribute('data-crm-ready'))return;form.dataset.crmReady='';
  form.addEventListener('input',()=>{if(!form.dataset.crmPending)delete form.dataset.crmRequestId});
  const label=form.querySelector('.lead-consent span');if(label){label.textContent='Use my details to provide the checklist. ';const link=document.createElement('a');link.href='/privacy';link.textContent='Privacy notice';label.append(link)}
  const optional=document.createElement('label');optional.className='lead-consent';optional.innerHTML='<input name="marketingConsent" type="checkbox"><span>Send me SootyEdge educational emails, too. Optional.</span>';
  form.querySelector('.lead-consent')?.after(optional);
  const button=form.querySelector('button[type=submit]');if(button)button.textContent='Get the free checklist';
  const note=form.querySelector('.form-note');if(note)note.textContent='Your request is saved in our customer system. The checklist opens here after submission.';
}
function configureSupport(){
  const form=document.querySelector('.support-form');if(!form||form.hasAttribute('data-crm-ready'))return;form.dataset.crmReady='';
  form.addEventListener('input',()=>{if(!form.dataset.crmPending)delete form.dataset.crmRequestId});
  const consent=document.createElement('label');consent.className='support-check';consent.innerHTML='<input type="checkbox" name="contactConsent" required><span>Use these details to save and respond to my support request.</span>';
  form.querySelector('button[type=submit]')?.before(consent);
  const note=form.querySelector('.support-form-note');if(note)note.textContent='Your request is saved with a reference number. Never submit passwords, card numbers, API keys, or brokerage credentials.';
}
