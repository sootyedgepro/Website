import {CLASS_EVENT,TOOLS,CHANGES,eventStatus,countdown,eventDate,eventTime,calendarIcs,validUsername} from './models.mjs';
import {mountMarketing} from './marketing.mjs';
import {hasDemoConsent,setDemoConsent} from './consent.mjs';
const site=document.documentElement.dataset.reviewSite;
const isSooty=site==='sootyedge';
const storeKey='owner-review:'+site+':v1';
const config=await fetch(new URL('./review-config.json',import.meta.url)).then(r=>{if(!r.ok)throw new Error('Preview configuration could not load');return r.json()});
let review;
try{review=JSON.parse(localStorage.getItem(storeKey)||'{}')}catch{review={}}
let enhanced=review.enhanced!==false;
let scenario='success';
let previewEnded=false;
let currentEvent=CLASS_EVENT;
const registered=new Set();
const q=(selector,root=document)=>root.querySelector(selector);
const qa=(selector,root=document)=>[...root.querySelectorAll(selector)];
function save(){review.enhanced=enhanced;try{localStorage.setItem(storeKey,JSON.stringify(review))}catch{}}
function el(tag,attrs={},text=''){const node=document.createElement(tag);for(const [k,v]of Object.entries(attrs))node.setAttribute(k,v);if(text)node.textContent=text;return node}
function otherUrl(path='/'){const other=config.sites.find(x=>x.name!==site);return new URL(path.replace(/^\/+/,''),new URL(other.url,location.origin)).href}
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=el('a',{href:url,download:name});a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
function status(form,message,kind='error'){let p=q('.review-status',form);if(!p){p=el('p',{class:'review-status',role:'alert'});form.append(p)}p.dataset.kind=kind;p.textContent=message;return p}
function modal(title,content,className=''){
 const d=el('dialog',{class:'review-dialog '+className,'aria-label':title});
 const head=el('div',{class:'review-dialog-head'});
 head.append(el('h2',{},title));
 const close=el('button',{type:'button'},'Close');head.append(close);
 const body=el('div',{class:'review-dialog-body'});body.innerHTML=content;
 d.append(head,body);document.body.append(d);
 const last=document.activeElement;
 close.addEventListener('click',()=>d.close());
 d.addEventListener('click',e=>{if(e.target===d){const box=d.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)d.close()}});
 d.addEventListener('close',()=>{d.remove();if(last?.isConnected)last.focus()},{once:true});
 d.showModal();close.focus();
 return {dialog:d,body};
}
function downloadCalendar(){download('Traveling-in-Profit-review.ics',calendarIcs(currentEvent),'text/calendar;charset=utf-8')}
function showChart(src,title,description='Historical chart reference. Use the original context when reviewing this image.'){
 const view=modal(title,'<div class="review-chart-controls"><button type="button" data-zoom="in">Zoom in</button><button type="button" data-zoom="out">Zoom out</button><button type="button" data-zoom="fit">Fit image</button><button type="button" data-zoom="actual">Actual size</button><span role="status"></span></div><div class="review-chart-scroll"><img alt=""></div><p class="review-chart-caption"></p>','review-chart-dialog');
 view.body.style.padding='0';
 const img=q('img',view.body),scroll=q('.review-chart-scroll',view.body),readout=q('[role=status]',view.body);
 img.alt=title;img.src=src;q('.review-chart-caption',view.body).textContent=description;
 let scale=1;
 function fit(){scale=Math.min(1,(scroll.clientWidth-24)/(img.naturalWidth||1200));render()}
 function render(){img.style.width=Math.round((img.naturalWidth||1200)*scale)+'px';readout.textContent=Math.round(scale*100)+'%'}
 img.addEventListener('load',fit,{once:true});if(img.complete&&img.naturalWidth)fit();
 qa('button[data-zoom]',view.body).forEach(button=>button.addEventListener('click',()=>{
  const action=button.dataset.zoom;if(action==='fit')return fit();
  scale=action==='actual'?1:Math.max(.08,Math.min(3,scale*(action==='in'?1.4:1/1.4)));render();
 }));
}
function setupImages(){
 qa('a[href]').forEach(a=>{
  const href=a.getAttribute('href');
  if(/\.(png|jpe?g|webp|avif)(\?.*)?$/i.test(href)&&a.querySelector('img')||/\.(png|jpe?g|webp|avif)(\?.*)?$/i.test(href)&&/chart/i.test(a.textContent+a.getAttribute('aria-label'))){
   a.removeAttribute('target');a.setAttribute('aria-label','Open image viewer: '+(a.querySelector('img')?.alt||a.textContent.trim()||'chart'));
   a.addEventListener('click',e=>{if(e.ctrlKey||e.metaKey)return;e.preventDefault();const image=a.querySelector('img');const tool=TOOLS.find(t=>a.getAttribute('href').includes(t.slug));showChart(a.getAttribute('href'),tool?tool.name+' — chart':(image?.alt||'Image reference').slice(0,80),image?.alt||'Historical TradingView chart reference. Not live market data.')});
  }
 });
}
function setupSootyTabs(){
 qa('[role=tablist]').forEach(group=>{
  const buttons=qa('[role=tab]',group);
  function select(index,focus=false){buttons.forEach((b,i)=>{b.setAttribute('aria-selected',String(i===index));b.tabIndex=i===index?0:-1;const panel=document.getElementById(b.getAttribute('aria-controls'));if(panel)panel.hidden=i!==index});if(focus)buttons[index].focus()}
  buttons.forEach((button,index)=>{
   button.addEventListener('click',()=>select(index));
   button.addEventListener('keydown',e=>{const keys={ArrowRight:(index+1)%buttons.length,ArrowLeft:(index+buttons.length-1)%buttons.length,Home:0,End:buttons.length-1};if(e.key in keys){e.preventDefault();select(keys[e.key],true)}});
  });
 });
}
function addSootyEnhancements(){
 const hero=q('#home'),framework=q('#framework');
 if(framework){
  const comparison=el('section',{class:'review-enhancement review-compare','aria-labelledby':'review-compare-title'});
  comparison.innerHTML='<h2 id="review-compare-title">Three tools. Three different jobs.</h2><p>Start with direction, locate reaction areas, then evaluate price against a fixed weekly map. The tools support your judgment; they do not place trades.</p><table><thead><tr><th scope="col">The tool</th><th scope="col">What it helps you read</th><th scope="col">What appears on your chart</th></tr></thead><tbody></tbody></table>';
  const tbody=q('tbody',comparison);
  TOOLS.forEach(tool=>{const row=el('tr');const name=el('td',{},tool.name);name.append(el('span',{},tool.role));row.append(name,el('td',{},tool.question),el('td',{},tool.detail));tbody.append(row)});
  framework.before(comparison);
 }
 if(hero){const anchor=q('a[href="#framework"]',hero);if(anchor){const guide=el('a',{class:'review-enhancement review-guide-link',href:'/free-checklist'},'Start with the free prep checklist');anchor.parentElement.append(guide)}}
 const offer=q('#offer');
 if(offer){const bridge=el('aside',{class:'review-enhancement review-bridge'});bridge.innerHTML='<p><strong>Prefer to see the process explained?</strong><br>Explore Zi’s free live class and the chart preparation behind the tools.</p>';bridge.append(el('a',{href:otherUrl()},'Explore the live class'));offer.before(bridge)}
 if(location.pathname.replace(/\/$/,'')==='/support'){
  const intake=q('.support-form');
  if(intake){const box=el('section',{class:'review-enhancement review-bridge'});box.innerHTML='<p><strong>Already purchased the Trading Suite?</strong><br>Preview the shorter activation form for your purchase email and TradingView username.</p>';const button=el('button',{class:'review-primary',type:'button'},'Preview activation');button.onclick=()=>openPurchase('activation');box.append(button);intake.before(box)}
 }
 qa('a[href]').forEach(a=>{const href=a.getAttribute('href');if(href.startsWith('/api/checkout')||href.includes('buy.stripe.com')){a.href='#review-purchase';a.addEventListener('click',e=>{e.preventDefault();openPurchase()})}});
}
function openPurchase(stage='offer'){
 const view=modal(stage==='offer'?'The Trading Suite — purchase preview':'Activate your Trading Suite','');
 function activation(){
  q('.review-dialog-head h2',view.dialog).textContent='Activate your Trading Suite — demo';view.dialog.setAttribute('aria-label','Activate your Trading Suite — demo');
  view.body.innerHTML='<p class="review-demo-note">Owner review only. No payment has been made. These details are not sent to SootyEdge or TradingView.</p><h3>Your purchase. The right account.</h3><p>After verified payment, use your purchase email and exact TradingView username. Activation is completed within one business day after both are received, Monday–Friday, US Eastern time.</p><form class="review-fields" novalidate><label>Purchase email<input type="email" name="purchaseEmail" required autocomplete="email" placeholder="you@example.com"></label><label>Exact TradingView username<input type="text" name="tradingViewUsername" minlength="3" maxlength="50" required placeholder="YourTradingViewUsername" autocomplete="off"><small>Use your username, not a profile URL or password.</small></label><div class="review-actions"><button class="review-primary" type="submit">Preview activation request</button></div></form>';
  const form=q('form',view.body);
  form.addEventListener('submit',async e=>{
   e.preventDefault();if(!form.checkValidity()){status(form,'Complete your purchase email and TradingView username.');form.reportValidity();return}
   const username=form.elements.tradingViewUsername.value.trim();
   if(!validUsername(username)){status(form,'Enter your exact username without spaces, an @ prefix, or a profile URL.');form.elements.tradingViewUsername.focus();return}
   if(!await simulate(form,'Preparing preview…'))return;
   view.body.innerHTML='<p class="review-demo-note">Demonstration complete. No activation request was sent.</p><h3>Clear details. Clear next step.</h3><p data-account></p><ol><li>Your verified payment is matched to your purchase email.</li><li>The exact TradingView account receives private access to all three tools.</li><li>Setup documentation and technical support guide your next step.</li></ol><p>Expected activation: within one business day after payment verification and receipt of the exact username, Monday–Friday, US Eastern time.</p><div class="review-actions"><button class="review-primary" type="button" data-done>Return to the site</button><a class="review-secondary" href="/support">Explore support</a></div>';
   q('[data-account]',view.body).textContent='TradingView username in this preview: '+username;
   q('[data-done]',view.body).onclick=()=>view.dialog.close();
  });
  q('input',form).focus();
 }
 if(stage==='activation')return activation();
 view.body.innerHTML='<p class="review-demo-note">This is an owner-review checkout demonstration. It does not collect card details or charge money.</p><h3>Three indicators. One purchase.</h3><p class="review-price">$2,500 <small>one-time payment</small></p><ul><li>Flow Tracker: trend and momentum</li><li>Action Zones: weekly and monthly reaction areas</li><li>Tunnel Bands: levels calculated weekly and fixed throughout the week</li><li>Lifetime personal software access under the published license</li><li>Setup documentation and technical support</li></ul><p>TradingView is required and may have separate platform fees. The published seven-day refund policy applies to the real offer.</p><p><a href="/terms">Terms</a> · <a href="/license">Software license</a> · <a href="/refunds">Refund policy</a></p><div class="review-actions"><button class="review-primary" type="button" data-payment>Preview payment success</button></div>';
 q('[data-payment]',view.body).onclick=activation;
}
async function simulate(form,label='Preparing preview…'){
 const button=q('button[type=submit]',form),original=button?.textContent;
 if(button){button.dataset.pending='true';button.disabled=true;button.textContent=label}
 const error=q('.review-status',form);if(error)error.remove();
 await new Promise(resolve=>setTimeout(resolve,500));
 if(button){delete button.dataset.pending;button.disabled=false;button.textContent=original}
 if(scenario==='failure'){status(form,'Preview error: the request could not be completed. Your details are still here. Choose Success in Review updates and try again.');return false}
 return true;
}
function registrationSuccess(name,email,duplicate=false){
 const view=modal(duplicate?'Registration already on file — demo':'Your class registration — demo','');
 view.body.innerHTML='<p class="review-demo-note">No seat has been reserved and no email has been sent. This is the proposed confirmation experience.</p><h3 data-greeting></h3><p data-event></p><ol><li>In the live experience, your registration email would contain confirmation and joining instructions.</li><li>Save the class to your calendar.</li><li>Review the host’s instructions for private community access.</li></ol><p>Your optional future-class preference stays separate from the consent needed for this class.</p><div class="review-actions"><button type="button" class="review-primary" data-calendar>Download calendar preview</button><button type="button" class="review-secondary" data-done>Back to the page</button></div>';
 q('[data-greeting]',view.body).textContent=duplicate?'Your registration is already recorded in this demo.':'You have the next steps, '+name+'.';
 q('[data-event]',view.body).textContent=eventDate(currentEvent)+' · '+eventTime(currentEvent)+' · 55 minutes';
 q('[data-calendar]',view.body).onclick=downloadCalendar;q('[data-done]',view.body).onclick=()=>view.dialog.close();
}
function setupForms(){
 qa('form').forEach(form=>{
  form.noValidate=true;
  form.addEventListener('submit',async e=>{
   e.preventDefault();e.stopImmediatePropagation();
   if(eventStatus(currentEvent)==='ended'&&!isSooty){status(form,'This class has ended. The next session needs to be confirmed by the host.');return}
   if(!form.checkValidity()){status(form,'Complete the required fields, use a valid email address, and check the required consent box.');form.reportValidity();return}
   const fields=new FormData(form);if(fields.get('website')){status(form,'Leave the website field empty.');return}
   if(!await simulate(form,isSooty?'Preparing preview…':'Preparing registration…'))return;
   if(!isSooty){
    const name=String(fields.get('firstName')||'').trim(),email=String(fields.get('email')||'').trim().toLowerCase();
    const duplicate=scenario==='duplicate'||registered.has(email);registered.add(email);
    const popup=form.closest('dialog');if(popup?.open)popup.close();
    registrationSuccess(name,email,duplicate);
   }else if(form.id==='get-checklist'){location.assign('/thank-you?preview=1')}
   else status(form,'Support preview complete. No request was sent. Your details remain available here for review.','success');
  });
 });
}
function setupTipTools(){
 const figure=q('#tools .market-chart');if(!figure)return;
 const buttons=qa('.market-chart-tabs button',figure),img=q('img',figure),link=q('a',figure),caption=q('.market-chart-header p span',figure);
 const allImages=qa('#method img');
 buttons.forEach((button,index)=>button.addEventListener('click',()=>{
  const tool=TOOLS[index];const match=allImages.find(i=>i.src.includes(tool.slug));
  if(match){img.src=match.getAttribute('src');img.alt=match.alt;link.href=match.getAttribute('src')}
  buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
  caption.textContent='/ '+(index===1?'4-hour':'1-hour')+' · '+tool.name;
 }));
 qa('.hero-facts dd[aria-label]').forEach(dd=>dd.textContent=dd.getAttribute('aria-label'));
}
let updateEvent=()=>{};
function addTipEnhancements(){
 const reserve=q('#reserve');if(!reserve)return;
 const details=q('.event-details',reserve);
 const zoneBox=el('div',{class:'review-enhancement review-local-time'});
 zoneBox.innerHTML='<strong>THE CLASS IN YOUR TIME ZONE</strong><span role="status"></span><label><select aria-label="Class time zone"></select></label>';
 let detected='America/Chicago';try{detected=Intl.DateTimeFormat().resolvedOptions().timeZone}catch{}
 const zones=[...new Set([detected,'America/New_York','America/Chicago','America/Denver','America/Los_Angeles','Europe/London','UTC'])];
 const select=q('select',zoneBox);
 zones.forEach(zone=>{const option=el('option',{value:zone},zone.replaceAll('_',' '));select.append(option)});select.value=detected;
 details.after(zoneBox);
 const sticky=el('aside',{class:'review-enhancement review-sticky','aria-label':'Class reservation shortcut'});
 sticky.innerHTML='<p><strong>Free live class</strong><span data-short-time></span></p><a href="#reserve">Save my seat</a>';document.body.append(sticky);
 const chartHeader=q('#tools .market-chart-header');
 if(chartHeader){const suiteLink=el('a',{class:'tip-suite-link',href:otherUrl('/#suite-demo')},'Explore the suite ↗');chartHeader.append(suiteLink)}
 const previewLink=el('a',{class:'tip-classroom-link',href:'/travelinginprofit/classroom/'},'Preview the class player →');
 q('#reserve .registration-copy')?.append(previewLink);
 const hostPreview=el('a',{class:'tip-classroom-link',href:'/travelinginprofit/classroom/'},'See the recorded class experience →');
 q('#meet-zi .meet-finale-grid > div')?.append(hostPreview);
 const originalHeading=q('#clients-title')?.innerHTML;
 function heading(){if(q('#clients-title'))q('#clients-title').innerHTML=enhanced?'Member examples.<br><span>In their original context.</span>':originalHeading}
 heading();document.addEventListener('reviewmode',heading);
 const dateNodes=[];const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let dateNode;
 while((dateNode=walker.nextNode())){if(dateNode.parentElement?.closest('script,style'))continue;if(dateNode.nodeValue.includes('Saturday, November 14, 2026')||dateNode.nodeValue.includes('12 noon Eastern (EST)'))dateNodes.push({node:dateNode,template:dateNode.nodeValue})}
 const countdownNodes=qa('.countdown-units dd');
 updateEvent=()=>{
  currentEvent=previewEnded?{...CLASS_EVENT,startsAt:'2020-01-01T17:00:00Z'}:CLASS_EVENT;
  const state=eventStatus(currentEvent),parts=countdown(currentEvent);
  countdownNodes.forEach((node,index)=>node.textContent=String(Object.values(parts)[index]).padStart(2,'0'));
  const caption=q('.countdown-caption');if(caption)caption.textContent=state==='upcoming'?'LIVE CLASS STARTS IN':state==='live'?'THE SCHEDULED CLASS IS IN PROGRESS':'THIS SCHEDULED CLASS HAS ENDED';
  q('[role=status]',zoneBox).textContent=eventDate(currentEvent,select.value)+' · '+eventTime(currentEvent,select.value);
  const date=q('.event-details dd',reserve);if(date)date.textContent=eventDate(currentEvent);
  const time=qa('.event-details dd',reserve)[1];if(time)time.textContent=eventTime(currentEvent);
  dateNodes.forEach(({node,template})=>{if(node.isConnected)node.nodeValue=template.replaceAll('Saturday, November 14, 2026',eventDate(currentEvent)).replaceAll('12 noon Eastern (EST)',eventTime(currentEvent))});
  const shortDate=new Intl.DateTimeFormat('en-US',{timeZone:currentEvent.timeZone,weekday:'short',month:'short',day:'numeric'}).format(new Date(currentEvent.startsAt));
  const header=q('.hero-header > span');if(header)header.textContent='FREE LIVE CLASS · '+shortDate+' · '+eventTime(currentEvent);
  q('[data-short-time]',sticky).textContent=eventTime(currentEvent,select.value)+' · '+(state==='ended'?'Class ended':shortDate);
  q('a',sticky).textContent=state==='ended'?'Class status':'Save my seat';
  qa('.seat-button:not(.tip-rb-seat) strong').forEach(strong=>strong.textContent=state==='ended'?'VIEW CLASS STATUS':'YES, SAVE MY FREE SEAT');
  qa('.registration-form button[type=submit]').forEach(button=>{if(button.dataset.pending)return;button.disabled=state==='ended';if(state==='ended')button.textContent='Class ended';else button.textContent='Reserve my free seat'});
  document.dispatchEvent(new CustomEvent('reviewevent',{detail:{event:currentEvent,status:state}}));
 };
 updateEvent();setInterval(updateEvent,1000);select.addEventListener('change',updateEvent);
 const observer=new IntersectionObserver(entries=>{sticky.hidden=entries[0].isIntersecting},{threshold:.1});observer.observe(q('.registration-card',reserve)||reserve);
 qa('a[href*="/api/calendar"],a[href$="/review/calendar.ics"]').forEach(a=>{a.href='/travelinginprofit/review/calendar.ics';a.textContent='Download calendar invitation';a.addEventListener('click',e=>{e.preventDefault();downloadCalendar()})});
 q('.signup-popup-close')?.addEventListener('click',()=>q('.signup-popup').close());
}
function cookiePreferences(doNotShare=false){
 if(isSooty){
  const view=modal('Cookie preferences','<p>The interactive chart preference and optional traffic measurement are separate choices.</p><form class="review-fields"><label class="review-cookie-choice"><input type="checkbox" name="demo">Enable interactive chart</label><label class="review-cookie-choice"><input type="checkbox" name="analytics">Allow optional analytics across SootyEdge and Traveling in Profit</label><p>Registration and checklist requests are saved when you submit them, regardless of your analytics choice.</p><div class="review-actions"><button type="submit" class="review-primary">Save preferences</button></div></form>');
  const form=q('form',view.body);form.elements.demo.checked=hasDemoConsent();form.elements.analytics.checked=!!window.StreamLineTracking?.analyticsAllowed();form.elements.analytics.disabled=navigator.globalPrivacyControl===true;
  form.onsubmit=e=>{e.preventDefault();window.StreamLineTracking?.setAnalyticsPreference(form.elements.analytics.checked);if(setDemoConsent(form.elements.demo.checked)){view.dialog.close()}else status(form,'The browser could not save this choice. Check whether it allows cookies for this site.')};
  return;
 }
 if(doNotShare)window.StreamLineTracking?.setAnalyticsPreference(false);
 window.StreamLineTracking?.openAnalyticsPreferences();
}
function setupLocalLinks(){
 qa('a[href]').forEach(a=>{
  const href=a.getAttribute('href');
  if(/^https?:\/\/(?:www\.)?sootyedge\.com/.test(href)&&!isSooty){const url=new URL(href);a.href=otherUrl(url.pathname+url.hash)}
  if(/^https?:\/\/(?:www\.)?travelinginprofit\.com/.test(href)&&isSooty){const url=new URL(href);a.href=otherUrl(url.pathname+url.hash)}
  if(href.startsWith('mailto:'))a.addEventListener('click',e=>{e.preventDefault();modal('Contact — owner review','<p>This is a owner review version. No email will be sent from this prototype.</p><p>The production contact address is shown on the original website. Use the review panel to record any contact-flow changes for its owner.</p>')});
 });
 qa('.footer-privacy-button').forEach(button=>button.addEventListener('click',()=>cookiePreferences(button.textContent.includes('Do not'))));
}
function openReview(){
 const view=modal('Review the proposed updates','');
 view.dialog.classList.add('review-drawer');
 view.body.innerHTML='<p>Compare the current visual baseline with the proposed enhancements. Feedback stays in this browser until you export it.</p><p class="review-save-note">This owner preview sends no registrations, payments, support messages, or reviewer notes to the live sites.</p><form class="review-checklist"></form><div class="review-fields" style="margin-top:24px"><label>Form outcome to preview<select data-scenario><option value="success">Success</option><option value="failure">Recoverable error</option><option value="duplicate">Already registered</option></select></label></div><div class="review-actions"><button type="button" class="review-primary" data-export>Export owner feedback</button></div><p class="review-save-note" role="status" data-saved>Changes save in this browser.</p>';
 const form=q('form',view.body);
 for(const[id,label]of CHANGES[site]){
  const field=el('fieldset');field.append(el('legend',{},label));
  const value=review[id]||{status:'unreviewed',note:''};
  for(const [key,text]of [['unreviewed','Unreviewed'],['approved','Approve for implementation'],['revise','Needs revision']]){
   const option=el('label');const input=el('input',{type:'radio',name:id,value:key});input.checked=value.status===key;option.append(input,document.createTextNode(text));field.append(option);
   input.onchange=()=>{review[id]={status:key,note:q('textarea',field).value};save();q('[data-saved]',view.body).textContent='Saved locally.'};
  }
  const notes=el('textarea',{'aria-label':'Notes: '+label,placeholder:'What should change before the owner approves?'});notes.value=value.note;field.append(notes);notes.oninput=()=>{review[id]={status:q('input:checked',field).value,note:notes.value};save();q('[data-saved]',view.body).textContent='Saved locally.'};form.append(field);
 }
 const scenarioSelect=q('[data-scenario]',view.body);scenarioSelect.value=scenario;scenarioSelect.onchange=()=>scenario=scenarioSelect.value;
 if(!isSooty){
  const expired=el('button',{type:'button',class:'review-secondary'},previewEnded?'Restore scheduled class':'Preview class-ended state');
  expired.onclick=()=>{previewEnded=!previewEnded;updateEvent();expired.textContent=previewEnded?'Restore scheduled class':'Preview class-ended state'};q('.review-actions',view.body).append(expired);
  if(!enhanced){const popup=el('button',{type:'button',class:'review-secondary'},'Preview baseline signup popup');popup.onclick=()=>{view.dialog.close();q('.signup-popup')?.showModal()};q('.review-actions',view.body).append(popup)}
 }
 q('[data-export]',view.body).onclick=()=>download(site+'-owner-feedback.json',JSON.stringify({site,reference:isSooty?'https://www.sootyedge.com/':'https://travelinginprofit.com/',exportedAt:new Date().toISOString(),mode:'owner-preview',feedback:review},null,2),'application/json');
}
function toolbar(){
 const bar=el('aside',{class:'review-toolbar','aria-label':'Local prototype controls'});
 bar.append(el('strong',{},'OWNER PREVIEW'),el('span',{},'Registrations, checklist requests, and support requests are saved. Email and payments are not connected.'));
 const toggle=el('button',{type:'button','aria-pressed':String(enhanced)},enhanced?'View baseline':'View enhancements');
 toggle.onclick=()=>{enhanced=!enhanced;applyMode();toggle.textContent=enhanced?'View baseline':'View enhancements';toggle.setAttribute('aria-pressed',String(enhanced));save()};
 const reviewButton=el('button',{type:'button'},'Review updates');reviewButton.onclick=openReview;
 const other=el('a',{href:otherUrl()},isSooty?'View class site':'View SootyEdge');
 bar.append(toggle,reviewButton,other);document.body.prepend(bar);
 const chip=el('button',{type:'button',class:'review-chip'},'Review updates');chip.onclick=openReview;document.body.append(chip);
}
function applyMode(){document.documentElement.dataset.reviewEnhanced=String(enhanced);document.dispatchEvent(new Event('reviewmode'))}
toolbar();applyMode();setupSootyTabs();
if(isSooty)addSootyEnhancements();else{setupTipTools();addTipEnhancements()}
mountMarketing({site,otherUrl,openPurchase});
setupImages();setupForms();setupLocalLinks();
if(!isSooty){
 const {mountMemberResults,mountAgenda,mountRegistrationSteppers,mountEventPreview,mountFunnelLanyards,mountFunnelMotion,mountFunnelEditorial}=await import('./funnel-ui.js');
 mountMemberResults();mountAgenda();mountFunnelLanyards();
 mountRegistrationSteppers({getEvent:()=>currentEvent,getScenario:()=>scenario,downloadCalendar});
 mountFunnelMotion({getEvent:()=>currentEvent});
 mountFunnelEditorial();
 const player=q('[data-event-preview]');if(player)mountEventPreview(player);
}
if(location.hash==='#review-purchase')openPurchase();
else if(!isSooty&&location.hash)requestAnimationFrame(()=>requestAnimationFrame(()=>document.getElementById(location.hash.slice(1))?.scrollIntoView({block:'start'})));

