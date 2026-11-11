import {hasDemoConsent,setDemoConsent,DEMO_COOKIE} from './consent.mjs';
import {sampleMarket,DEMO_STEPS,TUNNEL_LEVELS,layersThroughStep} from './demo-data.mjs';
import {DemoOverlay} from './demo-overlay.mjs';
const playIcon='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5 3 8 5-8 5Z" fill="currentColor"/></svg>';
const bubbleCopy=[
 'Follow the colored line and cloud to read direction. The blue line adds a slower reference.',
 'The shaded areas mark places to reassess as price approaches. Watch the reaction before making a decision.',
 'The gold line anchors the week. Compare price with the four reference levels above and below it.'
];
export function demoMarkup(){
 return `<section class="suite-demo" id="suite-demo" aria-labelledby="suite-demo-title">
 <div class="demo-title"><div><h2 id="suite-demo-title">One chart. Your perspective.</h2><p>Watch the layers arrive. Drag or zoom whenever you're ready.</p></div><span class="demo-sample-label">Illustrative replay · XAUUSD · 1h</span></div>
 <div class="demo-workspace"><div class="demo-board"><div class="demo-plot-wrap">
 <div class="demo-chart" data-chart tabindex="-1" aria-label="Illustrative gold candlestick chart. Drag to pan. Use plus and minus to zoom, arrow keys to pan, and zero to reset." role="group"></div>
 <div class="demo-static" data-static aria-hidden="true"><svg viewBox="0 0 800 400" preserveAspectRatio="none"><defs><pattern id="demo-grid" width="80" height="66" patternUnits="userSpaceOnUse"><path d="M80 0H0V66" fill="none" stroke="#ffffff0b"/></pattern></defs><rect width="800" height="400" fill="url(#demo-grid)"/>${sampleMarket().bars.filter((_,i)=>i%2===0).map((b,i)=>{const scale=p=>365-(p-4070)*2.3;return `<path d="M${i*12+35} ${scale(b.high)}V${scale(b.low)}" stroke="${b.close>b.open?'#83b99e':'#cb817b'}"/><rect x="${i*12+32}" y="${scale(Math.max(b.open,b.close))}" width="6" height="${Math.max(2,Math.abs(b.close-b.open)*2.3)}" fill="${b.close>b.open?'#83b99e':'#cb817b'}"/>`}).join('')}</svg></div>
 <div class="demo-lock" data-lock><div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg><h3 data-lock-title>See the suite come together.</h3><p data-lock-message>Enable one demo preference cookie to explore the chart. You can turn it off anytime below.</p><button type="button" class="clean-primary" data-enable>Enable interactive demo ${playIcon}</button><span class="demo-cookie-detail">No advertising or analytics cookies.</span></div></div>
 <div class="demo-chart-watermark" data-watermark hidden>Illustrative data</div></div>
 <div class="demo-chart-footer"><span data-ohlc>Illustrative XAUUSD · 1h</span><div class="demo-trend" data-trend hidden><span>Flow Tracker</span><div>Trend <strong data-trend-direction></strong></div><div>Momentum <strong data-momentum></strong></div></div><div><button type="button" aria-label="Zoom in on chart" data-zoom="in" disabled>+</button><button type="button" aria-label="Zoom out on chart" data-zoom="out" disabled>−</button><button type="button" data-reset disabled>Reset</button></div></div></div>
 <div class="demo-guide-dock" data-guide-dock hidden><div class="demo-speech" data-speech role="region" aria-label="Chart guide">
 <div class="demo-speech-copy" aria-live="polite" aria-atomic="true"><div class="demo-speech-heading"><span data-chapter>Flow Tracker</span><span data-step-count>01 / 03</span><span data-tour-state>Introducing</span></div><p data-step-text></p></div>
 <div class="demo-speech-controls"><button type="button" data-play aria-label="Pause chart guide">Pause</button><button type="button" data-next aria-label="Next chart guide tip">Next <span aria-hidden="true">→</span></button><button type="button" data-dismiss aria-label="Hide chart guide">×</button></div></div>
 <button type="button" class="demo-guide-restore" data-restore hidden>${playIcon} Show guide</button></div></div>
 <div class="demo-consent-row"><div><button type="button" class="demo-cookie-switch" role="switch" aria-checked="false" aria-label="Interactive demo cookies"><span></span></button><span>Interactive demo cookies <strong data-cookie-state>Off</strong></span></div><p>Illustrative overlays and sample prices. Private indicator logic and live market data are not connected.</p></div>
 <div class="demo-attribution"><a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">TradingView Lightweight Charts™ © 2025 TradingView, Inc.</a></div>
 <p class="demo-access-status" role="status" data-access-status>Demo locked. Enable interactive demo cookies to continue.</p></section>`;
}
export function mountSuiteDemo(root){
 if(!root)return;
 const q=s=>root.querySelector(s),qa=s=>[...root.querySelectorAll(s)],sample=sampleMarket(),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
 const indexByTime=new Map(sample.bars.map((bar,index)=>[bar.time,index])),host=q('[data-chart]');
 let chart,candles,overlay,flowLine,slowLine,markers,tunnelLines=[];
 let phase='locked',step=-1,layers=new Set(),playing=false,complete=false,generation=0,timer=null,inView=false,pendingStart=false;
 function stopTimer(){clearTimeout(timer);timer=null}
 function allowed(){if(!hasDemoConsent()){lock();return false}return true}
 function controls(enabled){qa('[data-play],[data-next],[data-dismiss],[data-restore],[data-zoom],[data-reset]').forEach(b=>b.disabled=!enabled)}
 function announce(text){q('[data-access-status]').textContent=text}
 function readTrend(index){
  if(index==null)return;
  const current=sample.flow[index],prior=sample.flow[Math.max(0,index-1)];
  for(const [selector,up] of [['[data-trend-direction]',current.value>=current.slow],['[data-momentum]',current.value>=prior.value]]){const label=q(selector);label.textContent=up?'↗ Upward':'↘ Downward';label.dataset.direction=up?'up':'down'}
 }
 function playLabel(text){q('[data-play]').textContent=text;q('[data-play]').setAttribute('aria-label',text+' chart guide')}
 function pause(){playing=false;pendingStart=false;stopTimer();if(phase==='ready'){q('[data-tour-state]').textContent=complete?'Explore':'Paused';playLabel(complete?'Replay':'Continue')}}
 function lock(message='Enable one demo preference cookie to explore the chart. You can turn it off anytime below.'){
  const focused=document.activeElement,lostFocus=root.contains(focused)&&focused.closest('.demo-workspace')&&!focused.matches('[data-enable]');
  generation++;pause();phase='locked';chart?.remove();chart=null;candles=null;overlay=null;markers=null;tunnelLines=[];
  host.replaceChildren();layers.clear();step=-1;complete=false;controls(false);host.tabIndex=-1;
  q('[data-lock]').hidden=false;q('[data-static]').hidden=false;q('[data-guide-dock]').hidden=true;
  q('[data-lock-title]').textContent='The interactive demo is locked.';q('[data-lock-message]').textContent=message;
  q('[data-enable]').disabled=false;q('[data-enable]').innerHTML='Enable interactive demo '+playIcon;
  q('[data-trend]').hidden=true;q('[data-watermark]').hidden=true;q('[data-ohlc]').textContent='Illustrative XAUUSD · 1h';
  q('[data-cookie-state]').textContent='Off';q('.demo-cookie-switch').setAttribute('aria-checked','false');
  announce('Demo locked. The chart, software layers, and guide are disabled.');if(lostFocus)q('[data-enable]').focus({preventScroll:true});
 }
 function setLayers(next){
  if(!chart||!allowed())return;
  layers=new Set(next);const flow=layers.has('flow'),tunnels=layers.has('tunnels');
  flowLine.applyOptions({visible:flow});slowLine.applyOptions({visible:flow});markers.setMarkers(flow?sample.markers:[]);
  tunnelLines.forEach(line=>line.applyOptions({lineVisible:tunnels,axisLabelVisible:tunnels}));overlay.setLayers(layers);
  q('[data-trend]').hidden=!flow;if(flow)readTrend(sample.bars.length-1);
 }
 function finish(){
  playing=false;complete=true;stopTimer();q('[data-chapter]').textContent='Your chart. Your pace.';q('[data-step-count]').textContent='03 / 03';q('[data-tour-state]').textContent='Explore';
  q('[data-step-text]').textContent='All three layers are in place. Drag to explore price, or zoom in for a closer look.';
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
  q('[data-chapter]').textContent=item.name;q('[data-step-count]').textContent=`0${step+1} / 03`;
  q('[data-step-text]').textContent=bubbleCopy[step];q('[data-tour-state]').textContent=playing?'Introducing':'Explore';
  q('[data-next]').innerHTML=step===2?'Done':'Next <span aria-hidden="true">→</span>';
  q('[data-next]').setAttribute('aria-label',step===2?'Finish chart guide':'Next chart guide tip');
  playLabel(playing?'Pause':'Continue');announce(item.name+'. '+bubbleCopy[step]);schedule();
 }
 function reset(){if(!chart||!allowed())return;chart.priceScale('right').applyOptions({autoScale:true});chart.timeScale().setVisibleLogicalRange({from:-3,to:sample.bars.length+5});chart.clearCrosshairPosition()}
 function zoom(direction){
  if(!chart||!allowed())return;pause();const range=chart.timeScale().getVisibleLogicalRange();if(!range)return;
  const center=(range.from+range.to)/2,span=Math.max(16,Math.min(220,(range.to-range.from)*(direction==='in'?.78:1.28)));chart.timeScale().setVisibleLogicalRange({from:center-span/2,to:center+span/2});
 }
 async function load(){
  if(phase==='loading'||phase==='ready')return;
  if(!hasDemoConsent()){lock('Your browser could not save the demo cookie. Allow cookies for this site, then try again.');return}
  const moveFocus=document.activeElement===q('[data-enable]'),token=++generation;
  phase='loading';q('[data-enable]').disabled=true;q('[data-enable]').textContent='Preparing chart…';
  try{
   const L=await import('./vendor/lightweight-charts/lightweight-charts.mjs');if(token!==generation||!hasDemoConsent())return;
   chart=L.createChart(host,{autoSize:true,layout:{background:{type:L.ColorType.Solid,color:'#14191d'},textColor:'#9da8af',fontFamily:'Arial, sans-serif',fontSize:11,attributionLogo:true},
    grid:{vertLines:{color:'#ffffff07'},horzLines:{color:'#ffffff09'}},rightPriceScale:{borderColor:'#ffffff15',scaleMargins:{top:.08,bottom:.08},minimumWidth:70},
    timeScale:{borderColor:'#ffffff15',timeVisible:true,secondsVisible:false,rightOffset:5},crosshair:{mode:L.CrosshairMode.Normal,vertLine:{color:'#d5b34d70'},horzLine:{color:'#d5b34d70'}},
    handleScroll:{mouseWheel:false,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},handleScale:{mouseWheel:true,pinch:true,axisPressedMouseMove:true}});
   candles=chart.addSeries(L.CandlestickSeries,{upColor:'#78b899',downColor:'#df8178',wickUpColor:'#9dc7b3',wickDownColor:'#dcaaa6',borderVisible:false,priceLineVisible:false,lastValueVisible:true,autoscaleInfoProvider:()=>({priceRange:{minValue:4068,maxValue:4228}})});
   candles.setData(sample.bars);
   flowLine=chart.addSeries(L.LineSeries,{lineWidth:2,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false,visible:false});flowLine.setData(sample.flow.map(({time,value,color})=>({time,value,color})));
   slowLine=chart.addSeries(L.LineSeries,{lineWidth:1,color:'#65a9cf',priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false,visible:false});slowLine.setData(sample.flow.map(({time,slow})=>({time,value:slow})));
   markers=L.createSeriesMarkers(candles,[],{autoScale:false});
   tunnelLines=TUNNEL_LEVELS.map((price,index)=>candles.createPriceLine({price,color:index<4?'#c57772':index===4?'#ddbd63':'#6ca787',lineWidth:1,lineStyle:L.LineStyle.Solid,lineVisible:false,axisLabelVisible:false,title:index<4?'U'+(4-index):index===4?'Weekly':'L'+(index-4)}));
   overlay=new DemoOverlay(sample);candles.attachPrimitive(overlay);
   chart.subscribeCrosshairMove(param=>{const bar=param.seriesData.get(candles);if(!bar||bar.open==null)return;if(layers.has('flow'))readTrend(indexByTime.get(param.time));q('[data-ohlc]').textContent=`O ${bar.open.toFixed(2)}  H ${bar.high.toFixed(2)}  L ${bar.low.toFixed(2)}  C ${bar.close.toFixed(2)}`});
   phase='ready';host.tabIndex=0;q('[data-lock]').hidden=true;q('[data-static]').hidden=true;q('[data-watermark]').hidden=false;q('[data-guide-dock]').hidden=false;q('[data-enable]').disabled=false;controls(true);
   q('[data-cookie-state]').textContent='On';q('.demo-cookie-switch').setAttribute('aria-checked','true');reset();showStep(0,inView&&!document.hidden);pendingStart=!inView;if(moveFocus)host.focus({preventScroll:true});
  }catch(error){
   if(token!==generation)return;chart?.remove();chart=null;host.replaceChildren();phase='error';controls(false);
   q('[data-lock]').hidden=false;q('[data-guide-dock]').hidden=true;q('[data-lock-title]').textContent='The chart could not load.';q('[data-lock-message]').textContent='Try again to load the chart. You can still turn off its cookie below.';
   q('[data-enable]').disabled=false;q('[data-enable]').textContent='Try loading the demo again';q('[data-cookie-state]').textContent=hasDemoConsent()?'On':'Off';q('.demo-cookie-switch').setAttribute('aria-checked',String(hasDemoConsent()));announce('Chart unavailable. Retry loading the demo.');console.error('Suite demo failed to initialize:',error);
  }
 }
 function sync(event){if(!hasDemoConsent()){if(phase!=='locked')lock();return}if(phase==='locked'||(phase==='error'&&event?.type==='suiteconsentchange'))load()}
 q('[data-enable]').onclick=()=>{if(setDemoConsent(true,true)){if(phase==='error')load()}else lock('Your browser could not save the demo cookie. Allow cookies for this site, then try again.')};
 q('.demo-cookie-switch').onclick=()=>{const enable=!hasDemoConsent();if(!setDemoConsent(enable,enable)&&enable)lock('Your browser could not save the demo cookie. Allow cookies for this site, then try again.')};
 q('[data-play]').onclick=()=>{if(playing){pause();return}if(complete){reset();showStep(0,true)}else if(reducedMotion.matches){if(step<2)showStep(step+1);else finish()}else{playing=true;q('[data-tour-state]').textContent='Introducing';playLabel('Pause');schedule()}};
 q('[data-next]').onclick=()=>{if(!allowed())return;if(step<2)showStep(step+1,playing);else finish()};
 q('[data-dismiss]').onclick=()=>{pause();q('[data-speech]').hidden=true;q('[data-restore]').hidden=false;q('[data-restore]').focus({preventScroll:true})};
 q('[data-restore]').onclick=()=>{q('[data-speech]').hidden=false;q('[data-restore]').hidden=true;q('[data-play]').focus({preventScroll:true})};
 q('[data-reset]').onclick=()=>{pause();reset()};qa('[data-zoom]').forEach(b=>b.onclick=()=>zoom(b.dataset.zoom));
 for(const type of ['pointerdown','wheel'])host.addEventListener(type,()=>{if(phase==='ready')pause()},{passive:true});
 host.addEventListener('keydown',event=>{
  if(phase!=='ready'||!['+','=','-','0','ArrowLeft','ArrowRight'].includes(event.key))return;
  event.preventDefault();if(!allowed())return;pause();
  if(event.key==='+'||event.key==='=')zoom('in');else if(event.key==='-')zoom('out');else if(event.key==='0')reset();
  else{const range=chart.timeScale().getVisibleLogicalRange();if(range){const offset=(range.to-range.from)*.08*(event.key==='ArrowRight'?1:-1);chart.timeScale().setVisibleLogicalRange({from:range.from+offset,to:range.to+offset})}}
 });
 const observer=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;if(!inView){if(playing){pause();pendingStart=true}}else if(phase==='ready'&&pendingStart&&!document.hidden)showStep(Math.max(0,step),true)},{threshold:.35});observer.observe(q('.demo-plot-wrap'));
 window.addEventListener('suiteconsentchange',sync);window.addEventListener('focus',sync);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else sync()});
 document.addEventListener('reviewmode',()=>{if(document.documentElement.dataset.reviewEnhanced==='false')pause()});reducedMotion.addEventListener('change',()=>pause());
 if('cookieStore' in window)cookieStore.addEventListener('change',event=>{if([...event.changed,...event.deleted].some(cookie=>cookie.name===DEMO_COOKIE))sync()});
 const poll=setInterval(sync,1000);window.addEventListener('pagehide',event=>{pause();if(!event.persisted){clearInterval(poll);observer.disconnect();generation++;chart?.remove();chart=null}});window.addEventListener('pageshow',sync);sync();
}
