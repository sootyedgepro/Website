import React,{useEffect,useId,useState} from 'react';
import './classroom-room-atmosphere.css';

// Coordinates match the room's surface lighting: the left pair has separate
// origins and slightly different aim, rather than two copies of one beam.
const LIGHTS=[
  {source:[-40,1040],aim:[360,250],width:92,strength:.86},
  {source:[100,1100],aim:[490,180],width:44,strength:.62},
  {source:[1040,1060],aim:[680,260],width:90,strength:.86}
];

// Deterministic positions avoid a new dust arrangement on every play/pause.
// Irrational strides distribute the first 48 evenly too, for the mobile cap.
const fraction=value=>value-Math.floor(value);
const MOTES=Array.from({length:128},(_,index)=>{
  const x=3+fraction(index*.61803398875+.11)*94;
  const y=6+fraction(index*.754877666+.37)*94;
  const depth=fraction(index*.381966011+.2),duration=30+fraction(index*.27182818)*24;
  return {
    x,y,size:.9+depth*1.4+(index%5===0?.4:0),
    dx:(x<50?1:-1)*(15+depth*27),dy:-55-fraction(index*.43429448)*76,
    duration,delay:fraction(index*.414213562+.13)*duration,alpha:.42+depth*.58
  };
});

function beamPath({source:[sx,sy],aim:[tx,ty],width}){
  const dx=tx-sx,dy=ty-sy,length=Math.hypot(dx,dy);
  const nx=-dy/length,ny=dx/length;
  return `M ${sx} ${sy} L ${tx+nx*width} ${ty+ny*width} Q ${tx+dx*.09} ${ty+dy*.09} ${tx-nx*width} ${ty-ny*width} Z`;
}

/** Mount beside the light field, directly under .classroom-experience. */
export function ClassroomRoomAtmosphere({playing=false,quiet=false}){
  const id=`classroom-room-${useId().replace(/[^a-zA-Z0-9_-]/g,'')}`;
  const [hidden,setHidden]=useState(()=>typeof document!=='undefined'&&document.hidden);
  useEffect(()=>{
    const update=()=>setHidden(document.hidden);
    document.addEventListener('visibilitychange',update);
    return()=>document.removeEventListener('visibilitychange',update);
  },[]);
  const paused=quiet||hidden;

  return <>
    <div className="classroom-room-lights" data-playing={playing||undefined} data-paused={paused||undefined} aria-hidden="true">
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" focusable="false">
        <defs>
          <filter id={`${id}-soft`} x="-40%" y="-20%" width="180%" height="150%"><feGaussianBlur stdDeviation="9"/></filter>
          <filter id={`${id}-bloom`} x="-100%" y="-150%" width="300%" height="400%"><feGaussianBlur stdDeviation="32"/></filter>
          {LIGHTS.map((light,index)=><linearGradient key={index} id={`${id}-${index}`} gradientUnits="userSpaceOnUse" x1={light.source[0]} y1={light.source[1]} x2={light.aim[0]} y2={light.aim[1]}>
            <stop offset="0" stopColor="#ffe8af" stopOpacity=".46"/>
            <stop offset=".18" stopColor="#f6d183" stopOpacity=".30"/>
            <stop offset=".49" stopColor="#e5b652" stopOpacity=".12"/>
            <stop offset=".78" stopColor="#dfad44" stopOpacity=".025"/>
            <stop offset="1" stopColor="#dfad44" stopOpacity="0"/>
          </linearGradient>)}
        </defs>
        <g filter={`url(#${id}-soft)`}>
          {LIGHTS.map((light,index)=><path key={index} d={beamPath(light)} fill={`url(#${id}-${index})`} opacity={light.strength}/>)}
        </g>
        <g filter={`url(#${id}-bloom)`} fill="#edca79">
          <ellipse cx="8" cy="1018" rx="140" ry="44" opacity=".28"/>
          <ellipse cx="116" cy="1060" rx="84" ry="47" opacity=".20"/>
          <ellipse cx="1000" cy="1020" rx="135" ry="44" opacity=".27"/>
        </g>
      </svg>
    </div>
    <div className="classroom-room-dust" data-playing={playing||undefined} data-paused={paused||undefined} aria-hidden="true">
      {MOTES.map(({x,y,size,dx,dy,duration,delay,alpha},index)=><i key={index} style={{left:`${x}%`,top:`${y}%`,width:`${size}px`,height:`${size}px`,'--dust-x':`${dx}px`,'--dust-y':`${dy}px`,'--dust-duration':`${duration}s`,'--dust-delay':`${-delay}s`,'--dust-alpha':alpha}}/>)}
    </div>
  </>;
}
