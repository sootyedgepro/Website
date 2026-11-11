import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import SideRays from './vendor/react-bits/SideRays.jsx';
import './suite-atmosphere.css';

function SuiteAtmosphere(){
  const [quiet,setQuiet]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [compact,setCompact]=useState(()=>window.matchMedia('(max-width: 700px)').matches);
  useEffect(()=>{
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    const screen=window.matchMedia('(max-width: 700px)');
    const update=()=>{setQuiet(motion.matches);setCompact(screen.matches)};
    motion.addEventListener('change',update);screen.addEventListener('change',update);
    return()=>{motion.removeEventListener('change',update);screen.removeEventListener('change',update)};
  },[]);
  return <SideRays key={quiet?'still':'moving'} rayColor1="#e7be66" rayColor2="#6b9dbe"
    blend={0.2} origin="top-right" speed={quiet?0:0.85} intensity={compact?2.5:3.4} spread={4}
    density={6} sharpness={0.65} falloff={1.3} glow={0.65} dust={0.12}
    opacity={compact?0.72:0.85} followMouse={!quiet&&!compact} mouseInfluence={0.25}
    intro={!quiet} maxDevicePixelRatio={compact?1:1.5}/>;
}

export function mountSuiteAtmosphere(site){
  if(!site||site.querySelector('.suite-atmosphere'))return()=>{};
  const host=document.createElement('div');host.className='suite-atmosphere';host.setAttribute('aria-hidden','true');
  site.prepend(host);const root=createRoot(host);root.render(<SuiteAtmosphere/>);
  return()=>{root.unmount();host.remove()};
}
