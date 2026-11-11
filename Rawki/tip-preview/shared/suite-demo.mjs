import {hasDemoConsent,setDemoConsent,DEMO_COOKIE} from './consent.mjs';
import {sampleMarket,DEMO_STEPS,TUNNEL_LEVELS,layersThroughStep} from './demo-data.mjs';
import {DemoOverlay} from './demo-overlay.mjs';
import {mountGuideLight} from './ui.js';
const playIcon='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5 3 8 5-8 5Z" fill="currentColor"/></svg>';
const bubbleCopy=[
 'Green and red show direction. Compare the colored line with the slower blue reference.',
 'Watch price as it reaches a shaded zone. Use the reaction to reassess your plan.',
 'The gold line anchors the week. The surrounding levels stay fixed as price moves.'
];
export function demoMarkup(){
 return `<section class="suite-demo" id="suite-demo" aria-labelledby="suite-demo-title">
 <h2 id="suite-demo-title" class="sr-only">Explore the SootyEdge Trading Suite</h2>
 <div class="demo-workspace">
 <div class="demo-board" id="suite-chart-panel" role="region" aria-label="SootyEdge chart">
 <div class="chart-topbar" aria-label="Chart controls">
 <div class="chart-symbol"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3v18M2 8h6v7H2zM16 1v22M12 5h8v13h-8z" fill="none" stroke="currentColor"/></svg><strong>XAUUSD</strong><span>Gold / US Dollar</span></div>
 <div class="chart-intervals" aria-label="Chart timeframe"><button type="button" data-interval="60" aria-pressed="true" disabled>1h</button><button type="button" data-interval="240" aria-pressed="false" disabled>4h</button></div>
 <label class="chart-style"><span class="sr-only">Chart style</span><select data-chart-style disabled><option value="candles">Candles</option><option value="bars">Bars</option></select></label>
 <span class="chart-demo-label">Demo prices</span>
 <div class="chart-view-controls"><button type="button" class="chart-guide-button" data-replay disabled aria-label="Replay the software guide">${playIcon}<span>Guide</span></button><button type="button" aria-label="Zoom out on chart" data-zoom="out" disabled>−</button><button type="button" aria-label="Zoom in on chart" data-zoom="in" disabled>+</button><button type="button" data-reset disabled aria-label="Reset chart view">↺</button><details class="demo-info"><summary aria-label="About this chart">i</summary><div><strong>SootyEdge chart demo</strong><p>Illustrative prices and software layers on TradingView Lightweight Charts. The demo does not use live prices or the private SootyEdge indicator code.</p><a href="/sooty-flow-tracker.png" data-chart-reference>View the original SootyEdge chart</a></div></details></div>
 </div>
 <div class="demo-plot-wrap"><div class="demo-chart" data-chart tabindex="-1" aria-label="SootyEdge illustrative chart. Drag to pan. Plus and minus zoom, arrow keys pan, and zero resets." role="group"></div>
 <div class="demo-static" data-static aria-hidden="true"><svg viewBox="0 0 800 400" preserveAspectRatio="none">${sampleMarket().bars.filter((_,i)=>i%2===0).map((b,i)=>{const scale=p=>330-(p-4070)*1.8;return `<path d="M${i*12+35} ${scale(b.high)}V${scale(b.low)}" stroke="${b.close>b.open?'#4caa35':'#d82b38'}"/><rect x="${i*12+32}" y="${scale(Math.max(b.open,b.close))}" width="6" height="${Math.max(2,Math.abs(b.close-b.open)*1.8)}" fill="${b.close>b.open?'#4caa35':'#d82b38'}"/>`}).join('')}</svg></div>
 <div class="demo-lock" data-lock><div><img src="/sootyedge-icon.png" alt="" width="48" height="54"><h3 data-lock-title>Explore the suite.</h3><p data-lock-message>Allow the functional chart cookie to start. You can change this in Cookie preferences.</p><button type="button" class="clean-primary" data-enable>Enable chart ${playIcon}</button></div></div>
 <div class="demo-guide-dock" data-guide-dock hidden><div class="demo-speech" data-speech role="region" aria-label="Chart guide"><div class="demo-specular-edge" data-guide-light aria-hidden="true"></div>
 <div class="demo-speech-heading"><span data-chapter>Flow Tracker</span><span data-step-count>1 / 3</span><span data-tour-state class="sr-only">Introducing</span><div class="demo-speech-controls"><button type="button" data-play aria-label="Pause chart guide">Ⅱ</button><button type="button" data-next aria-label="Next chart guide tip">→</button><button type="button" data-dismiss aria-label="Hide chart guide">×</button></div></div>
 <p data-step-text aria-live="polite" aria-atomic="true"></p></div>
 <button type="button" class="demo-guide-restore" data-restore hidden>${playIcon} Guide</button></div></div></div>
 </div><div class="demo-attribution"><a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">Charts by TradingView</a><button type="button" class="footer-privacy-button">Cookie preferences</button></div>
 <p class="demo-access-status" role="status" data-access-status>Enable the chart to begin.</p></section>`;
}
export function mountSuiteDemo(root){
 if(!root)return;
 const q=s=>root.querySelector(s),qa=s=>[...root.querySelectorAll(s)],reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
 let sample=sampleMarket(),interval='60',chartStyle='candles',disposeGuideLight=null;
 const host=q('[data-chart]');
 let chart,candles,overlay,flowLine,slowLine,markers,tunnelLines=[];
 let phase='locked',step=-1,layers=new Set(),playing=false,complete=false,generation=0,timer=null,inView=false,pendingStart=false;
 function clearGuideLight(){disposeGuideLight?.();disposeGuideLight=null}
 function syncGuideLight(){
  const visible=phase==='ready'&&hasDemoConsent()&&!document.hidden&&!q('[data-guide-dock]').hidden&&!q('[data-speech]').hidden;
  if(!visible){clearGuideLight();return}
  if(!disposeGuideLight)disposeGuideLight=mountGuideLight(q('[data-guide-light]'));
 }
 function stopTimer(){clearTimeout(timer);timer=null}
 function allowed(){if(!hasDemoConsent()){lock();return false}return true}
 function controls(enabled){qa('[data-play],[data-next],[data-dismiss],[data-restore],[data-zoom],[data-reset],[data-interval],[data-chart-style],[data-replay]').forEach(b=>b.disabled=!enabled)}
 function announce(text){q('[data-access-status]').textContent=text}
 function playLabel(text){q('[data-play]').textContent=text==='Pause'?'Ⅱ':text==='Replay'?'↺':'▷';q('[data-play]').setAttribute('aria-label',text+' chart guide')}
 function pause(){playing=false;pendingStart=false;stopTimer();if(phase==='ready'){q('[data-tour-state]').textContent=complete?'Explore':'Paused';playLabel(complete?'Replay':'Continue')}}
 function lock(message='Allow the functional chart cookie to start. You can change this in Cookie preferences.'){
  const focused=document.activeElement,lostFocus=root.contains(focused)&&focused.closest('.demo-workspace')&&!focused.matches('[data-enable]');
  generation++;pause();clearGuideLight();phase='locked';chart?.remove();chart=null;candles=null;overlay=null;markers=null;tunnelLines=[];
  host.replaceChildren();layers.clear();step=-1;complete=false;controls(false);host.tabIndex=-1;
  q('[data-lock]').hidden=false;q('[data-static]').hidden=false;q('[data-guide-dock]').hidden=true;
  q('[data-lock-title]').textContent='Explore the suite.';q('[data-lock-message]').textContent=message;
  q('[data-enable]').disabled=false;q('[data-enable]').innerHTML='Enable chart '+playIcon;
  announce('Demo locked. The chart, software layers, and guide are disabled.');if(lostFocus)q('[data-enable]').focus({preventScroll:true});
 }
 function setLayers(next){
  if(!chart||!allowed())return;
  layers=new Set(next);const flow=layers.has('flow'),tunnels=layers.has('tunnels');
  flowLine.applyOptions({visible:flow});slowLine.applyOptions({visible:flow});markers.setMarkers(flow?sample.markers:[]);
  tunnelLines.forEach(line=>line.applyOptions({lineVisible:tunnels,axisLabelVisible:tunnels}));overlay.setLayers(layers);
  
 }
 function finish(){
  playing=false;complete=true;stopTimer();q('[data-chapter]').textContent='The complete suite';q('[data-step-count]').textContent='3 / 3';q('[data-tour-state]').textContent='Explore';
  q('[data-step-text]').textContent='Drag to explore all three layers. Zoom in to inspect a price bar.';
  playLabel('Replay');q('[data-next]').hidden=true;announce('All three software layers are visible. Drag, zoom, or explore with the arrow keys.');
 }
 function schedule(){
  stopTimer();if(!playing)return;const token=generation;
  timer=setTimeout(()=>{timer=null;if(token!==generation||!allowed()||!playing)return;if(step<2)showStep(step+1,true);else finish()},7000);
 }
 function showStep(index,auto=false){
  if(!chart||!allowed())return;
  stopTimer();pendingStart=false;complete=false;step=Math.max(0,Math.min(2,index));playing=auto&&!reducedMotion.matches;
  const item=DEMO_STEPS[step];setLayers(layersThroughStep(step));
  q('[data-speech]').hidden=false;q('[data-restore]').hidden=true;q('[data-next]').hidden=false;
  q('[data-chapter]').textContent=item.name;q('[data-step-count]').textContent=`${step+1} / 3`;
  q('[data-step-text]').textContent=bubbleCopy[step];q('[data-tour-state]').textContent=playing?'Introducing':'Explore';
  q('[data-next]').textContent=step===2?'✓':'→';
  q('[data-next]').setAttribute('aria-label',step===2?'Finish chart guide':'Next chart guide tip');
  playLabel(playing?'Pause':'Continue');announce(item.name+'. '+bubbleCopy[step]);schedule();syncGuideLight();
 }
 function reset(){if(!chart||!allowed())return;chart.priceScale('right').applyOptions({autoScale:true});chart.timeScale().setVisibleLogicalRange({from:-3,to:sample.bars.length+5});chart.clearCrosshairPosition()}
 function zoom(direction){
  if(!chart||!allowed())return;pause();const range=chart.timeScale().getVisibleLogicalRange();if(!range)return;
  const center=(range.from+range.to)/2,span=Math.max(16,Math.min(220,(range.to-range.from)*(direction==='in'?.78:1.28)));chart.timeScale().setVisibleLogicalRange({from:center-span/2,to:center+span/2});
 }
 async function load(resume=null){
  if(phase==='loading'||phase==='ready')return;
  if(!hasDemoConsent()){lock('Your browser could not save the demo cookie. Allow cookies for this site, then try again.');return}
  const moveFocus=document.activeElement===q('[data-enable]'),token=++generation;
  phase='loading';q('[data-enable]').disabled=true;q('[data-enable]').textContent='Preparing chart…';
  try{
   const L=await import('./vendor/lightweight-charts/lightweight-charts.mjs');if(token!==generation||!hasDemoConsent())return;
   chart=L.createChart(host,{autoSize:true,layout:{background:{type:L.ColorType.VerticalGradient,topColor:'#292c32',bottomColor:'#060f29'},textColor:'#9da8af',fontFamily:'Arial, sans-serif',fontSize:11,attributionLogo:true},
    grid:{vertLines:{visible:false},horzLines:{visible:false}},rightPriceScale:{borderColor:'#ffffff15',scaleMargins:{top:.09,bottom:.25},minimumWidth:70},
    timeScale:{borderColor:'#ffffff15',timeVisible:true,secondsVisible:false,rightOffset:5,lockVisibleTimeRangeOnResize:true},crosshair:{mode:L.CrosshairMode.Normal,vertLine:{color:'#d5b34d70'},horzLine:{color:'#d5b34d70'}},
    handleScroll:{mouseWheel:false,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},handleScale:{mouseWheel:true,pinch:true,axisPressedMouseMove:true}});
   candles=chart.addSeries(chartStyle==='bars'?L.BarSeries:L.CandlestickSeries,{upColor:'#3c9b2d',downColor:'#c72b39',...(chartStyle==='candles'?{wickUpColor:'#57a644',wickDownColor:'#d43244',borderVisible:false}:{}),priceLineVisible:false,lastValueVisible:true,autoscaleInfoProvider:()=>({priceRange:{minValue:4068,maxValue:4228}})});
   candles.setData(sample.bars);
   flowLine=chart.addSeries(L.LineSeries,{lineWidth:2,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false,visible:false});flowLine.setData(sample.flow.map(({time,value,color})=>({time,value,color})));
   slowLine=chart.addSeries(L.LineSeries,{lineWidth:1,color:'#12a7db',priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false,visible:false});slowLine.setData(sample.flow.map(({time,slow})=>({time,value:slow})));
   markers=L.createSeriesMarkers(candles,[],{autoScale:false});
   tunnelLines=TUNNEL_LEVELS.map((price,index)=>candles.createPriceLine({price,color:index<4?'#c57772':index===4?'#ddbd63':'#6ca787',lineWidth:1,lineStyle:L.LineStyle.Solid,lineVisible:false,axisLabelVisible:false,title:index<4?'U'+(4-index):index===4?'Weekly':'L'+(index-4)}));
   overlay=new DemoOverlay(sample);candles.attachPrimitive(overlay);
   phase='ready';host.tabIndex=0;q('[data-lock]').hidden=true;q('[data-static]').hidden=true;q('[data-guide-dock]').hidden=false;q('[data-enable]').disabled=false;controls(true);
   reset();showStep(resume?Math.max(0,resume.step):0,!resume&&inView&&!document.hidden);pendingStart=!resume&&!inView;
   if(resume){
    if(resume.complete)finish();
    if(resume.range)chart.timeScale().setVisibleLogicalRange(resume.range);
    if(resume.hidden){q('[data-speech]').hidden=true;q('[data-restore]').hidden=false;syncGuideLight()}
   }
   if(moveFocus)host.focus({preventScroll:true});
   else if(resume?.focus&&(document.activeElement===document.body||document.activeElement===resume.focus))resume.focus.focus({preventScroll:true});
  }catch(error){
   if(token!==generation)return;clearGuideLight();chart?.remove();chart=null;host.replaceChildren();phase='error';controls(false);
   q('[data-lock]').hidden=false;q('[data-guide-dock]').hidden=true;q('[data-lock-title]').textContent='The chart could not load.';q('[data-lock-message]').textContent='Try again to load the chart. You can still turn off its cookie below.';
   q('[data-enable]').disabled=false;q('[data-enable]').textContent='Try loading the demo again';announce('Chart unavailable. Retry loading the demo.');console.error('Suite demo failed to initialize:',error);
  }
 }
 function rebuild(preserveRange=false){
  const resume={step,complete,focus:document.activeElement,hidden:q('[data-speech]').hidden,range:preserveRange?chart?.timeScale().getVisibleLogicalRange():null};
  generation++;pause();clearGuideLight();chart?.remove();chart=null;candles=null;overlay=null;markers=null;tunnelLines=[];host.replaceChildren();phase='locked';controls(false);
  load(resume);
 }
 function sync(event){if(!hasDemoConsent()){if(phase!=='locked')lock();return}if(phase==='locked'||(phase==='error'&&event?.type==='suiteconsentchange'))load()}
 q('[data-enable]').onclick=()=>{if(setDemoConsent(true,true)){if(phase==='error')load()}else lock('Your browser could not save the demo cookie. Allow cookies for this site, then try again.')};
 q('[data-play]').onclick=()=>{if(playing){pause();return}if(complete){reset();showStep(0,true)}else if(reducedMotion.matches){if(step<2)showStep(step+1);else finish()}else{playing=true;q('[data-tour-state]').textContent='Introducing';playLabel('Pause');schedule()}};
 q('[data-next]').onclick=()=>{if(!allowed())return;if(step<2)showStep(step+1,playing);else finish()};
 q('[data-dismiss]').onclick=()=>{pause();q('[data-speech]').hidden=true;q('[data-restore]').hidden=false;syncGuideLight();q('[data-restore]').focus({preventScroll:true})};
 q('[data-restore]').onclick=()=>{q('[data-speech]').hidden=false;q('[data-restore]').hidden=true;syncGuideLight();q('[data-play]').focus({preventScroll:true})};
 q('[data-replay]').onclick=()=>{if(!chart||!allowed())return;reset();showStep(0,true)};
 q('[data-reset]').onclick=()=>{pause();reset()};qa('[data-zoom]').forEach(b=>b.onclick=()=>zoom(b.dataset.zoom));
 for(const type of ['pointerdown','wheel'])host.addEventListener(type,()=>{if(phase==='ready')pause()},{passive:true});
 host.addEventListener('keydown',event=>{
  if(phase!=='ready'||!['+','=','-','0','ArrowLeft','ArrowRight'].includes(event.key))return;
  event.preventDefault();if(!allowed())return;pause();
  if(event.key==='+'||event.key==='=')zoom('in');else if(event.key==='-')zoom('out');else if(event.key==='0')reset();
  else{const range=chart.timeScale().getVisibleLogicalRange();if(range){const offset=(range.to-range.from)*.08*(event.key==='ArrowRight'?1:-1);chart.timeScale().setVisibleLogicalRange({from:range.from+offset,to:range.to+offset})}}
 });
 q('[data-chart-style]').onchange=event=>{
  if(!chart||!allowed())return;const next=event.target.value;if(!['candles','bars'].includes(next)||next===chartStyle)return;chartStyle=next;rebuild(true);
 };
 qa('[data-interval]').forEach(button=>button.onclick=()=>{
  if(!chart||!allowed()||interval===button.dataset.interval)return;interval=button.dataset.interval;sample=sampleMarket(interval);qa('[data-interval]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));rebuild();
 });
 const observer=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;if(!inView){if(playing){pause();pendingStart=true}}else if(phase==='ready'&&pendingStart&&!document.hidden)showStep(Math.max(0,step),true)},{threshold:.35});observer.observe(q('.demo-plot-wrap'));
 window.addEventListener('suiteconsentchange',sync);window.addEventListener('focus',sync);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else sync();syncGuideLight()});
 document.addEventListener('reviewmode',()=>{if(document.documentElement.dataset.reviewEnhanced==='false')pause()});reducedMotion.addEventListener('change',()=>pause());
 if('cookieStore' in window)cookieStore.addEventListener('change',event=>{if([...event.changed,...event.deleted].some(cookie=>cookie.name===DEMO_COOKIE))sync()});
 const poll=setInterval(sync,1000);window.addEventListener('pagehide',event=>{pause();clearGuideLight();if(!event.persisted){clearInterval(poll);observer.disconnect();generation++;chart?.remove();chart=null}});window.addEventListener('pageshow',()=>{sync();syncGuideLight()});sync();
}
