// Magic UI Backlight — https://magicui.design/docs/components/backlight
// MIT, Copyright (c) Magic UI. JavaScript adaptation: TypeScript types removed.
import React, { useEffect, useId, useRef } from 'react';

export function Backlight({ blur = 20, spread = 0, active = true, children, className, style }) {
  const id = useId();
  const root=useRef(null),roomBlur=useRef(null);
  const edge=useRef(null),room=useRef(null),level=useRef(active?1:0);
  const initialLevel=useRef(active?1:0);
  useEffect(()=>{
    const fit=()=>roomBlur.current?.setAttribute('stdDeviation',String(Math.min(spread,(root.current?.clientHeight||600)*.18)));
    const observer=new ResizeObserver(fit);if(root.current)observer.observe(root.current);fit();
    return()=>observer.disconnect();
  },[spread]);
  useEffect(()=>{
    let raf=0,last=performance.now();
    const target=active?1:0;
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){
      level.current=target;edge.current?.setAttribute('slope',String(target*.7));room.current?.setAttribute('slope',String(target*.4));return;
    }
    const tick=now=>{
      const dt=Math.min(100,now-last);last=now;
      level.current+=(target-level.current)*(1-Math.exp(-dt/(active?650:100)));
      if(Math.abs(level.current-target)<.002)level.current=target;
      edge.current?.setAttribute('slope',String(level.current*.7));
      room.current?.setAttribute('slope',String(level.current*.4));
      if(level.current!==target)raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);
  },[active]);

  return (
    <div ref={root} className={className} style={style}>
      <svg width="0" height="0" aria-hidden="true">
        <filter id={id} y="-50%" x="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blurred" />
          <feColorMatrix type="saturate" in="blurred" values="2.3" result="edgeColor" />
          <feComponentTransfer in="edgeColor" result="edgeLight"><feFuncA ref={edge} type="linear" slope={String(initialLevel.current*.7)}/></feComponentTransfer>
          {spread>0&&<>
            <feGaussianBlur ref={roomBlur} in="SourceGraphic" stdDeviation={spread} result="roomBlur" />
            <feColorMatrix type="saturate" in="roomBlur" values="2.1" result="roomColor" />
            <feComponentTransfer in="roomColor" result="roomLight"><feFuncA ref={room} type="linear" slope={String(initialLevel.current*.4)} /></feComponentTransfer>
          </>}
          <feMerge>{spread>0&&<feMergeNode in="roomLight" />}<feMergeNode in="edgeLight" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </svg>
      <div style={{ filter: `url(#${id})` }}>{children}</div>
    </div>
  );
}
