import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import SpotlightCard from '../../shared/vendor/react-bits/SpotlightCard.jsx';
import './funnel-editorial.css';
import {CandleAtmosphere} from './funnel-atmosphere.jsx';

function useQuietLight(){
  const [quiet,setQuiet]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.hidden||document.documentElement.dataset.motion==='paused');
  useEffect(()=>{
    const media=matchMedia('(prefers-reduced-motion: reduce)');
    let paused=document.documentElement.dataset.motion==='paused';
    const update=()=>setQuiet(media.matches||document.hidden||paused);
    const change=event=>{paused=!!event.detail?.paused;update()};
    media.addEventListener('change',update);document.addEventListener('visibilitychange',update);document.addEventListener('funnelmotionchange',change);
    return()=>{media.removeEventListener('change',update);document.removeEventListener('visibilitychange',update);document.removeEventListener('funnelmotionchange',change)};
  },[]);
  return quiet;
}

function ProcessDiagram({planned}){
  return <div className={'tip-process-diagram '+(planned?'is-planned':'is-reactive')} aria-hidden="true">
    <svg viewBox="0 0 360 90" fill="none">
      {planned?<><path className="tip-diagram-track" d="M42 45H318"/><path className="tip-diagram-direction" d="m126 40 5 5-5 5m102-10 5 5-5 5"/>{[42,180,318].map((x,index)=><g key={x}><circle cx={x} cy="45" r="21" className="tip-diagram-node"/><text x={x} y="50" textAnchor="middle">{String(index+1).padStart(2,'0')}</text></g>)}</>:<><path className="tip-diagram-track" d="M22 62C80-10 108 96 174 45S264 2 338 55M35 30C105 95 110-2 186 39S270 92 325 25"/>{[[35,30],[92,39],[174,45],[245,43],[325,25]].map(([x,y],index)=><circle key={index} cx={x} cy={y} r={index===2?8:5} className="tip-diagram-node"/>)}</>}
    </svg>
    {planned&&<div className="tip-diagram-labels"><span>Read</span><span>Map</span><span>Decide</span></div>}
  </div>;
}

function Comparison({items}){
  const quiet=useQuietLight();
  return <div className="comparison tip-editorial-comparison">{items.map((item,index)=><article key={index}>
    <SpotlightCard className={'tip-comparison-card '+(item.planned?'is-planned':'is-reactive')} spotlightColor={item.planned?'#59bfff':'#c8afa0'} intensity={quiet?0:.16} spotlightSize={280} borderGlow={quiet?0:.45} proximity={36} smoothing={quiet?0:.35} ambient={false} flare={false} grain={quiet?0:.045} role="group" aria-label={item.label} tabIndex={0}>
      <p className="comparison-label">{item.label}</p>
      <h3 dangerouslySetInnerHTML={{__html:item.heading}}/>
      <ProcessDiagram planned={item.planned}/>
      <ul>{item.bullets.map(text=><li key={text}>{text}</li>)}</ul>
    </SpotlightCard>
  </article>)}</div>;
}

const CHARTS=[
  {src:'/travelinginprofit/charts/sooty-flow-tracker.webp',name:'Flow Tracker',alt:'Original historical XAUUSD chart showing the SootyEdge Flow Tracker'},
  {src:'/travelinginprofit/charts/sooty-action-zones.png',name:'Action Zones',alt:'Original historical XAUUSD chart showing SootyEdge Action Zones'},
  {src:'/travelinginprofit/charts/sooty-tunnel-bands.webp',name:'Tunnel Bands',alt:'Original historical XAUUSD chart showing SootyEdge Tunnel Bands'},
  {src:'/travelinginprofit/charts/sooty-flow-tracker.webp',name:'Chart preparation',alt:'Original Flow Tracker chart used to review the preparation process'}
];

function PlanShowcase({steps}){
  const [active,setActive]=useState(0),dialog=useRef(null),buttons=useRef([]);
  const chart=CHARTS[active]||CHARTS[0];
  function navigate(event,index){
    let next;
    if(event.key==='ArrowDown'||event.key==='ArrowRight')next=(index+1)%steps.length;
    else if(event.key==='ArrowUp'||event.key==='ArrowLeft')next=(index+steps.length-1)%steps.length;
    else if(event.key==='Home')next=0;
    else if(event.key==='End')next=steps.length-1;
    if(next===undefined)return;
    event.preventDefault();setActive(next);buttons.current[next]?.focus();
  }
  return <div className="tip-plan-workspace">
    <figure id="tip-plan-chart" className="tip-plan-chart" aria-labelledby="tip-plan-chart-caption">
      <div className="tip-plan-chart-bar"><span><i aria-hidden="true"/>SOOTYEDGE</span><span>{chart.name}</span><button type="button" onClick={()=>dialog.current?.showModal()} aria-label={'Enlarge '+chart.name+' chart'}>Expand <span aria-hidden="true">↗</span></button></div>
      <button type="button" className="tip-plan-image" onClick={()=>dialog.current?.showModal()} aria-label={'View the original '+chart.name+' chart at full size'}>
        <img src={chart.src} alt={chart.alt} width="1440" height="836" loading="lazy"/>
        <span className="tip-plan-image-affordance">View original chart <span aria-hidden="true">↗</span></span>
      </button>
      <figcaption id="tip-plan-chart-caption"><span aria-live="polite">{String(active+1).padStart(2,'0')} / {chart.name}</span><span>Historical chart example</span></figcaption>
    </figure>
    <ol className="tip-plan-steps" aria-label="Four parts of the preparation">
      {steps.map((step,index)=><li key={step.title}><button ref={element=>{buttons.current[index]=element}} type="button" aria-pressed={index===active} aria-controls="tip-plan-chart" onClick={()=>setActive(index)} onFocus={()=>setActive(index)} onKeyDown={event=>navigate(event,index)}>
        <span className="tip-plan-step-number" aria-hidden="true">{step.number}</span><span className="tip-plan-step-copy"><strong>{step.title}</strong><span>{step.description}</span></span><span className="tip-plan-step-arrow" aria-hidden="true">↗</span>
      </button></li>)}
    </ol>
    <dialog ref={dialog} className="tip-plan-image-dialog" aria-label={chart.name+' original chart'} onClick={event=>{if(event.target===event.currentTarget)dialog.current?.close()}}>
      <div className="tip-plan-dialog-head"><span>{chart.name} · Historical example</span><button type="button" onClick={()=>dialog.current?.close()} autoFocus>Close <span aria-hidden="true">×</span></button></div>
      <img src={chart.src} alt={chart.alt}/>
    </dialog>
  </div>;
}

export function mountFunnelEditorial(){
  const comparison=document.querySelector('.comparison'),plan=document.querySelector('#trading-plan .plan-showcase-grid'),finale=document.querySelector('#class-takeaways');
  if((!comparison&&!plan&&!finale)||document.body.dataset.editorialMounted)return()=>{};
  document.body.dataset.editorialMounted='true';document.body.classList.add('tip-editorial-enhanced');
  const cleanup=[];
  if(finale){
    const background=document.createElement('div');background.className='tip-candle-mount';finale.prepend(background);const root=createRoot(background);root.render(<CandleAtmosphere/>);cleanup.push(()=>{root.unmount();background.remove()});
  }
  function replace(node,element,className){
    const host=document.createElement('div');host.className=className;node.replaceWith(host);
    const root=createRoot(host);flushSync(()=>root.render(element));
    cleanup.push(()=>{root.unmount();host.replaceWith(node)});
  }
  if(comparison){
    const items=[...comparison.querySelectorAll('article')].map(article=>({planned:article.classList.contains('planned'),label:article.querySelector('.comparison-label')?.textContent||'',heading:article.querySelector('h3')?.innerHTML||'',bullets:[...article.querySelectorAll('li')].map(li=>li.textContent)}));
    if(items.length)replace(comparison,<Comparison items={items}/>,'tip-comparison-mount');
  }
  if(plan){
    const steps=[...plan.querySelectorAll('.plan-benefits li')].map((li,index)=>({number:li.querySelector('.plan-number')?.textContent||String(index+1).padStart(2,'0'),title:li.querySelector('h3')?.textContent||'',description:li.querySelector('p')?.textContent||''}));
    if(steps.length)replace(plan,<PlanShowcase steps={steps}/>,'tip-plan-mount');
  }
  return()=>{cleanup.reverse().forEach(dispose=>dispose());delete document.body.dataset.editorialMounted;document.body.classList.remove('tip-editorial-enhanced')};
}
