import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import SpecularButton from './vendor/react-bits/SpecularButton.jsx';
import GlassSurface from './vendor/react-bits/GlassSurface.jsx';
import './guide-glass.css';

// This island owns only the decorative rim. Guide copy and controls remain
// native DOM owned by suite-demo, so its focus and playback state are preserved.
function GuideLight({surface}){
  const [quiet,setQuiet]=useState(()=>matchMedia('(prefers-reduced-motion: reduce), (hover: none)').matches);
  const [radius,setRadius]=useState(()=>parseFloat(getComputedStyle(surface).borderTopLeftRadius)||12);
  useEffect(()=>{
    const media=matchMedia('(prefers-reduced-motion: reduce), (hover: none)');
    const update=()=>setQuiet(media.matches);
    const resize=new ResizeObserver(()=>setRadius(parseFloat(getComputedStyle(surface).borderTopLeftRadius)||12));
    resize.observe(surface);media.addEventListener('change',update);
    return()=>{resize.disconnect();media.removeEventListener('change',update)};
  },[surface]);
  return <><GlassSurface className="demo-glass-surface" width="100%" height="100%"
    borderRadius={radius} distortionScale={-90} displace={1.5} backgroundOpacity={0.14}
    redOffset={0} greenOffset={2} blueOffset={4} saturation={1.1} refraction={!quiet}/>
    {!quiet&&<SpecularButton as="div" className="demo-specular-surface"
    radius={radius} tintOpacity={0} lineColor="#fff6df" baseColor="#8190a8"
    intensity={1} idleIntensity={0.35} shineSize={10} shineFade={34}
    thickness={1.2} glow={0.65} followMouse proximity={250} autoAnimate={false}
    aria-hidden="true">{null}</SpecularButton>}</>;
}

export function mountGuideLight(element){
  const root=createRoot(element);
  root.render(<GuideLight surface={element.parentElement}/>);
  return()=>root.unmount();
}
