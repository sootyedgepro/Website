import React,{useEffect,useRef,useState} from 'react';
import DarkVeil from './vendor/react-bits/DarkVeil.jsx';
import Aurora from './vendor/react-bits/Aurora.jsx';
import './funnel-atmosphere.css';

function useMotionSurface(){
  const ref=useRef(null),[active,setActive]=useState(false);
  useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)');let visible=false,paused=document.documentElement.dataset.motion==='paused';const update=()=>setActive(visible&&!document.hidden&&!media.matches&&!paused);const change=e=>{paused=!!e.detail?.paused;update()};const observer=new IntersectionObserver(entries=>{visible=entries.some(e=>e.isIntersecting);update()},{rootMargin:'120px'});observer.observe(ref.current);media.addEventListener('change',update);document.addEventListener('visibilitychange',update);document.addEventListener('funnelmotionchange',change);return()=>{observer.disconnect();media.removeEventListener('change',update);document.removeEventListener('visibilitychange',update);document.removeEventListener('funnelmotionchange',change)}},[]);
  return [ref,active];
}

export function SectionBackground({type}){
  const [ref,active]=useMotionSurface();
  return <div ref={ref} className={'tip-atmosphere tip-atmosphere--'+type}>
    {active&&(type==='journey'?<DarkVeil color="#f97316" mouseStrength={.15} speed={1.05} intro={false} dpr={1.25}/>:<Aurora colorStops={['#2276fa','#10b981','#0ab5ff']} amplitude={1.25} blend={.65} speed={.65} height={.85} scale={.9} layers={3} glow={.6} brightness={.8} direction="bottom" mouseInteraction={false} intro={false} opacity={.85} dpr={1.25}/>)}
  </div>;
}

// Ambient OHLC bars: each body and wick shares the same price scale, with no
// price line or connecting path. This is decorative motion, never a data feed.
export function CandleAtmosphere(){
  const canvas=useRef(null),[ref,active]=useMotionSurface();
  useEffect(()=>{const surface=canvas.current,ctx=surface.getContext('2d');if(!ctx)return;let raf=0,width=1,height=1,last=0,clock=0;const ratio=Math.min(devicePixelRatio||1,1.5);
    const random=i=>{const value=Math.sin(i*127.1+311.7)*43758.5453;return value-Math.floor(value)};
    const prices=[100];
    const close=i=>{while(prices.length<=i){const n=prices.length;prices.push(prices[n-1]+(random(n)-.5)*3.8+Math.sin(n*.11)*.55+(100-prices[n-1])*.025)}return prices[i]};
    const draw=()=>{ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);const spacing=width<600?18:23,count=Math.ceil(width/spacing)+3,offset=clock*.27,first=Math.floor(offset),shift=(offset-first)*spacing;const scale=height*.011,base=height*.59;
      for(let n=0;n<count;n++){const index=first+n,open=close(index),target=close(index+1),end=n===count-2?open+(target-open)*(.6+.35*Math.sin(clock*.3)):target;const high=Math.max(open,end)+.15+random(index+91)*.8,low=Math.min(open,end)-.15-random(index+217)*.8,x=n*spacing-shift;const y=value=>base-(value-100)*scale;ctx.fillStyle=end>=open?'rgba(64,180,158,.36)':'rgba(197,99,113,.3)';ctx.fillRect(Math.round(x),y(high),1,Math.max(1,(high-low)*scale));ctx.fillRect(Math.round(x-spacing*.2),Math.min(y(open),y(end)),Math.max(5,spacing*.44),Math.max(2,Math.abs(end-open)*scale));}
    };
    const frame=now=>{const dt=last?Math.min(.05,(now-last)/1000):0;last=now;clock+=dt;draw();if(active)raf=requestAnimationFrame(frame)};
    const measure=()=>{width=ref.current.clientWidth;height=ref.current.clientHeight;surface.width=Math.round(width*ratio);surface.height=Math.round(height*ratio);draw()};const observer=new ResizeObserver(measure);observer.observe(ref.current);measure();if(active)raf=requestAnimationFrame(frame);return()=>{observer.disconnect();cancelAnimationFrame(raf)};
  },[active]);
  return <div className="tip-candle-atmosphere" ref={ref} aria-hidden="true"><canvas ref={canvas}/></div>;
}
