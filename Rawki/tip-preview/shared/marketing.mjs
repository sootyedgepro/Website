import {CLASS_EVENT,eventDate,eventTime,eventStatus} from './models.mjs';
import {demoMarkup,mountSuiteDemo} from './suite-demo.mjs';
import {mountOffer,mountNavigation,mountSuiteIntroduction,mountSuiteGettingStarted,mountSuiteAtmosphere} from './ui.js';

const playIcon='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 9 6-9 6Z" fill="currentColor"/></svg>';
const brand=(sooty)=>sooty?'<img src="/sootyedge-icon.png" alt="" width="40" height="40"><span>SootyEdge<small>Structure. Precision. Edge.</small></span>':'<img src="/branding/sootyedge-gold-logo.webp" alt="" width="38" height="42"><span>Traveling in Profit<small>With Zi Morris</small></span>';
function footer(sooty){return `<footer class="clean-footer"><div><a class="clean-brand" href="/">${brand(sooty)}</a><p>Educational material only. Trading involves substantial risk, including loss of capital. No profit or performance is guaranteed.</p></div><div class="clean-footer-links"><a href="/privacy">Privacy</a>${sooty?'<a href="/terms">Terms</a><a href="/license">Software license</a><a href="/refunds">Refund policy</a><a href="/support">Support</a>':''}<button type="button" class="footer-privacy-button">Cookie preferences</button><span>© 2026 Champion Credit LLC</span></div></footer>`}

function sootyPage(otherUrl){return `
  <header class="sooty-nav-shell" data-nav-mount></header>
  <main id="refined-main">
    <div data-suite-introduction></div>
    ${demoMarkup()}
    <div data-suite-getting-started></div>
    <section id="suite-offer" data-offer-mount></section>
    <section class="clean-faq" aria-labelledby="suite-faq-title"><h2 id="suite-faq-title">Before you put it on your chart.</h2><div><details><summary>Is this demo the actual indicator code?</summary><p>This interactive preview illustrates the three tools with sample prices. Your purchased SootyEdge indicators run in your own TradingView account.</p></details><details><summary>Does the software trade for me?</summary><p>No. The tools support chart analysis. Trade selection, execution and risk management remain your responsibility.</p></details><details><summary>What happens if I turn off cookies?</summary><p>The interactive demo locks immediately. The chart and guide stop. Turn the functional cookie back on in Cookie preferences to continue.</p></details><details><summary>Can I learn the process first?</summary><p>Attend Zi's free class or start with the free preparation checklist before deciding about the software.</p><div class="clean-inline-links"><a href="${otherUrl()}">Explore the free class</a><a href="/free-checklist">Get the free checklist</a></div></details></div></section>
  </main>${footer(true)}`}

function tipPage(otherUrl){return `
  <header class="clean-header"><a class="clean-brand" href="/">${brand(false)}</a><nav aria-label="Main navigation"><a href="#class-agenda">What you'll learn</a><a href="#class-host">Meet Zi</a></nav><a class="clean-nav-cta" href="#class-reserve" data-class-cta>Save my free seat</a></header>
  <main id="refined-main">
    <section class="clean-class-hero" aria-labelledby="clean-class-title"><div class="clean-class-pitch"><p class="clean-context">Free live trading class · 55 minutes with Q&A</p><h1 id="clean-class-title">A clear plan before your next trade.</h1><p class="clean-lede">See how Zi reads direction, identifies key areas, and prepares his scenarios before considering an entry.</p><ul class="clean-class-benefits"><li>Understand the context before the setup.</li><li>Know what to prepare and when to wait.</li><li>See the three SootyEdge tools in the process.</li></ul><div class="clean-host-mini"><img src="/photos/zi-portrait.webp" alt="Zi Morris, class host" width="100" height="110"><div><strong>Learn with Zi Morris</strong><p>Live charts. A repeatable preparation process. Time for your questions.</p></div></div><p class="clean-small">For active traders who want more structure in their chart preparation. Education only. No promise of profits.</p></div>
      <div class="clean-registration registration-card" id="class-reserve">
        <h2 data-registration-heading>Save your free seat.</h2>
        <div class="clean-schedule"><div><strong data-event-date></strong><span data-event-time></span></div><span>Live online · 55 minutes · Q&A</span></div>
        <div class="clean-timezone"><label for="class-zone">In your time zone</label><select id="class-zone" aria-label="Class time zone"></select><p data-local-time role="status"></p></div>
        <p class="clean-registration-status" data-registration-status role="status" hidden>This class has ended. Check back for the next confirmed date.</p>
        <div data-registration-mount></div>
        <p class="clean-registration-note">Free private Inner Circle community access is included with registration.</p>
        <p class="clean-demo-notice">Local preview: no seat is reserved or email sent.</p>
      </div>
    </section>
    <section class="clean-class-agenda" id="class-agenda" aria-labelledby="class-agenda-title"><div class="clean-section-intro"><p class="clean-context">What we'll cover</p><h2 id="class-agenda-title">Three questions.<br>One preparation process.</h2><p>Leave with a clearer order for reviewing your chart, rather than more things to watch.</p></div><ol><li><span>01</span><div><h3>What's the direction?</h3><p>Start with trend and momentum. Use the larger context before reacting to a move.</p></div></li><li><span>02</span><div><h3>Where does the plan change?</h3><p>Locate reaction areas and fixed weekly references for the scenarios you're preparing.</p></div></li><li><span>03</span><div><h3>What would make you wait?</h3><p>Consider invalidation and risk before execution. Standing aside can be a complete decision.</p></div></li></ol></section>
    <section class="clean-class-chart" aria-labelledby="class-chart-title"><div><p class="clean-context">See the process on a chart</p><h2 id="class-chart-title">The tools add context.<br>You make the decision.</h2><p>Flow Tracker reads direction. Action Zones locates reaction areas. Tunnel Bands maps fixed weekly levels.</p><a class="clean-secondary" href="${otherUrl('/#suite-demo')}">${playIcon} Explore the interactive suite demo</a><p class="clean-small">The class is free to attend. The software is a separate purchase.</p></div><figure><a href="/charts/sooty-flow-tracker.webp" aria-label="Open the original Flow Tracker chart"><img src="/charts/sooty-flow-tracker.webp" alt="Original historical XAUUSD chart showing SootyEdge Flow Tracker" width="1440" height="836" loading="lazy"></a><figcaption>Original chart reference. Historical example, not a live signal.</figcaption></figure></section>
    <section class="clean-class-host" id="class-host" aria-labelledby="class-host-title"><img src="/photos/travel-maldives-working.webp" alt="Zi working at his laptop overlooking the water in the Maldives" width="800" height="600" loading="lazy"><div><p class="clean-context">Your host</p><h2 id="class-host-title">Zi Morris</h2><p>Travel is part of Zi's story. This class focuses on the preparation behind the chart: what he reviews, how he organizes the tools, and what he wants to understand before a trade.</p><p>Bring your questions about the process. You'll see the tools explained in context, with time for live Q&A.</p><a class="clean-text-link" href="#class-reserve" data-class-cta>Save my free seat</a></div></section>
    <section class="clean-faq" aria-labelledby="class-faq-title"><h2 id="class-faq-title">A few practical questions.</h2><div><details><summary>Is the class free?</summary><p>Yes. The live class is free to attend. The SootyEdge software offer is separate and is not required to reserve your place.</p></details><details><summary>Do I need the software to follow along?</summary><p>No purchase is needed to attend. The class explains the preparation process and shows how the tools support chart analysis.</p></details><details><summary>How do I join?</summary><p>In the live experience, registration confirmation and joining instructions would come to your email. The local confirmation demonstrates those next steps and offers a matching calendar entry.</p></details><details><summary>Will there be a replay?</summary><p>Replay availability needs to be confirmed by the host. The current offer is a live class with Q&A.</p></details><details><summary>Does this guarantee trading results?</summary><p>No. Trading involves substantial risk, including loss of capital. This is educational content, not personalized financial advice or a promise of profits.</p></details></div></section>
    <aside class="clean-next-step"><div><h2>See the preparation before the trade.</h2><p data-bottom-schedule></p></div><a class="clean-primary" href="#class-reserve" data-class-cta>Save my free seat</a></aside>
  </main>${footer(false)}<aside class="clean-class-sticky" aria-label="Class registration shortcut"><span><strong>Free live class</strong><small data-sticky-time></small></span><a href="#class-reserve" data-class-cta>Save my free seat</a></aside>`}

export function mountMarketing({site,otherUrl,openPurchase}){
  if(location.pathname.replace(/\/$/,'')!=='')return;
  const sooty=site==='sootyedge';
  const oldForm=!sooty?document.querySelector('.registration-form')?.cloneNode(true):null;
  const baseline=document.createElement('div');baseline.dataset.visualBaseline='true';
  for(const child of [...document.body.children]){
    if(child.tagName==='SCRIPT'||child.matches('.review-toolbar,.review-chip'))continue;
    baseline.append(child);
  }
  document.body.append(baseline);
  const root=document.createElement('div');root.className='clean-site review-enhancement '+(sooty?'clean-sooty':'clean-class');root.id='refined-site';
  root.innerHTML=sooty?sootyPage(otherUrl):tipPage(otherUrl);baseline.after(root);
  if(sooty)mountSuiteAtmosphere(root);
  const syncVisibility=()=>{
    const active=document.documentElement.dataset.reviewEnhanced!=='false';baseline.hidden=active;root.hidden=!active;
    window.StreamLineTracking?.refreshControls?.();
    if(!active){root.querySelector('.clean-class-sticky')?.setAttribute('hidden','');root.querySelectorAll('dialog[open]').forEach(d=>d.close())}
  };
  syncVisibility();document.addEventListener('reviewmode',syncVisibility);
  const anchor=document.getElementById(location.hash.slice(1));
  if(anchor&&root.contains(anchor)&&!root.hidden)requestAnimationFrame(()=>anchor.scrollIntoView({block:'start',behavior:'instant'}));
  root.querySelectorAll('[data-purchase]').forEach(button=>button.addEventListener('click',()=>openPurchase()));
  if(sooty){mountNavigation(root.querySelector('[data-nav-mount]'),otherUrl());mountSuiteIntroduction(root.querySelector('[data-suite-introduction]'));mountSuiteGettingStarted(root.querySelector('[data-suite-getting-started]'),otherUrl());mountSuiteDemo(root.querySelector('.suite-demo'));mountOffer(root.querySelector('[data-offer-mount]'),openPurchase);return}
  if(oldForm){
    for(const element of oldForm.querySelectorAll('[id]'))element.id='funnel-'+element.id;
    for(const label of oldForm.querySelectorAll('label[for]'))label.htmlFor='funnel-'+label.htmlFor;
    oldForm.setAttribute('aria-label','Free class registration');root.querySelector('[data-registration-mount]').append(oldForm);
  }
  const select=root.querySelector('#class-zone');let localZone='America/Chicago';try{localZone=Intl.DateTimeFormat().resolvedOptions().timeZone}catch{}
  const zoneLabels={'America/New_York':'New York (Eastern)','America/Chicago':'Chicago (Central)','America/Denver':'Denver (Mountain)','America/Los_Angeles':'Los Angeles (Pacific)','Europe/London':'London','UTC':'UTC'};
  for(const zone of [...new Set([localZone,...Object.keys(zoneLabels)])]){
    const option=document.createElement('option');option.value=zone;option.textContent=zoneLabels[zone]||zone.replaceAll('_',' ');select.append(option);
  }
  select.value=localZone;let event=CLASS_EVENT;
  function render(){
    const ended=eventStatus(event)==='ended';
    root.querySelector('[data-event-date]').textContent=eventDate(event);root.querySelector('[data-event-time]').textContent=eventTime(event);
    root.querySelector('[data-local-time]').textContent=eventDate(event,select.value)+' · '+eventTime(event,select.value);
    root.querySelector('[data-registration-heading]').textContent=ended?'Registration has closed.':'Save your free seat.';
    root.querySelector('[data-registration-status]').hidden=!ended;
    root.querySelector('[data-bottom-schedule]').textContent=ended?'This scheduled class has ended. The next session needs confirmation from the host.':eventDate(event)+' · '+eventTime(event)+' · 55 minutes';
    root.querySelector('[data-sticky-time]').textContent=ended?'Class ended':eventTime(event,select.value);
    root.querySelectorAll('[data-class-cta]').forEach(link=>link.textContent=ended?'View class status':'Save my free seat');
    const submit=root.querySelector('button[type=submit]');if(submit&&!submit.dataset.pending){submit.disabled=ended;submit.textContent=ended?'Class ended':'Save my free seat'}
  }
  select.addEventListener('change',render);document.addEventListener('reviewevent',e=>{event=e.detail.event;render()});render();
  const sticky=root.querySelector('.clean-class-sticky');
  new IntersectionObserver(entries=>{sticky.hidden=entries[0].isIntersecting||root.hidden},{threshold:.05}).observe(root.querySelector('.clean-registration'));
}
