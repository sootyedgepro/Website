import {useCallback,useEffect,useRef} from 'react';

const clamp=(n,min=0,max=1)=>Math.min(max,Math.max(min,n));
const smooth=(a,b,n)=>{const t=clamp((n-a)/(b-a));return t*t*(3-2*t)};
// Keep these aims aligned with classroom-room-atmosphere.jsx. The larger side
// cones now light their own side of the room instead of stacking in the center.
const EXTRA_LIGHTS=[[-.04,1.04,.36,.25,.62,24],[.10,1.10,.49,.18,.42,44],[1.04,1.06,.68,.26,.62,24]];

function sideBeam(x,y,nx,ny,source,width,height,time){
  const [ox,oy,ax,ay,strength,focus]=source,sx=ox*width,sy=oy*height;
  const dx=x-sx,dy=y-sy,reach=Math.max(1,Math.hypot(dx,dy));
  const tx=ax*width-sx,ty=ay*height-sy,target=Math.hypot(tx,ty);
  const align=Math.max(0,(dx*tx+dy*ty)/(reach*target));
  const incidence=Math.max(0,(-dx*nx-dy*ny)/reach);
  return Math.pow(align,focus)*incidence*clamp(1-reach/(Math.hypot(width,height)*1.5))*(.8+.06*Math.sin(time*.24+ox*3))*strength;
}

// Match the LightRays angular bands and cursor occlusion using the uniforms
// from its current frame. No GPU readback or independent animation loop.
function irradiance(x,y,nx,ny,s){
  const dx=x-s.sourceX,dy=y-s.sourceY,distance=Math.max(1,Math.hypot(dx,dy));
  const cosine=(dx*s.dirX+dy*s.dirY)/distance;
  const angle=cosine+s.distortion*Math.sin(s.time*2+distance*.02)*.2;
  const depth=distance/s.reach;
  const envelope=Math.pow(Math.max(0,angle),1/s.spread)*clamp(1-distance/(s.reach*s.length))*clamp(1-distance/(s.reach*s.fade),.5,1);
  const edge=.5+(.08-.5)*s.sharpness;
  const shape=v=>v+(smooth(.62-edge,.62+edge,v)-v)*s.sharpness;
  const a=clamp(.75+.15*Math.sin(angle*36.2214*s.density+s.time*1.5)+.2*Math.cos(-angle*21.11349*s.density+s.time*1.5));
  const b=clamp(.75+.15*Math.sin(angle*22.3991*s.density+s.time*1.1)+.2*Math.cos(-angle*18.0234*s.density+s.time*1.1));
  let rays=envelope*(.5*shape(a)+.4*shape(b));
  const sx=s.shadowX-s.sourceX,sy=s.shadowY-s.sourceY,sd=Math.max(1,Math.hypot(sx,sy));
  const along=(dx*sx+dy*sy)/(sd*sd),side=Math.abs(dx*sy-dy*sx)/sd,trail=Math.max(0,along-1);
  const width=Math.max(.1,16*along+.22*trail*sd);
  const shadow=(1-smooth(width*.3,width*1.6,side))*smooth(.97,1.25,along)*Math.exp(-trail*1.1);
  rays*=1-s.shadowPresence*.62*shadow;
  const source=Math.exp(-depth*depth*9)*.9+Math.exp(-depth*3.2)*.25;
  const glow=s.glow*source*smooth(-.2,.6,cosine);
  const reveal=s.intensity*s.introOpacity*(1-smooth(s.introDepth-.35,s.introDepth,depth))*s.opacity;
  // Only an edge facing the source catches the light; the upper rim stays dark.
  const incidence=Math.max(0,(-dx*nx-dy*ny)/distance);
  return clamp((rays+glow)*reveal*incidence*1.8);
}

export function useClassroomLightRim(playerRef,chatRef){
  const canvasRef=useRef(null),lastFrame=useRef(null),paintRef=useRef(null);
  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas)return;
    const context=canvas.getContext('2d');
    if(!context)return;
    let queued=0,lastPaint=-Infinity;
    const paint=()=>{
      if(document.hidden)return;
      const s=lastFrame.current;if(!s)return;
      lastPaint=performance.now();
      const width=window.innerWidth,height=window.innerHeight,scale=Math.min(devicePixelRatio||1,width<=600?1:1.25,Math.sqrt(2200000/(width*height)));
      if(canvas.width!==Math.round(width*scale)||canvas.height!==Math.round(height*scale)){
        canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
      }
      context.setTransform(scale,0,0,scale,0,0);context.clearRect(0,0,width,height);
      if(document.fullscreenElement)return;
      const color=s.color.map(c=>Math.round(c*255));
      const rgba=amount=>`rgba(${color[0]},${color[1]},${color[2]},${amount.toFixed(3)})`;
      const point=(x,y,nx,ny)=>clamp(irradiance(x,y,nx,ny,s)*.7+EXTRA_LIGHTS.reduce((value,light)=>value+sideBeam(x,y,nx,ny,light,width,height,s.time),0));
      for(const target of [playerRef.current,chatRef.current]){
        if(!target)continue;
        const r=target.getBoundingClientRect();
        if(r.bottom<0||r.top>height||!r.width||!r.height)continue;
        const radius=Math.min(parseFloat(getComputedStyle(target).borderTopLeftRadius)||18,r.height/2);
        const x=r.left+.5,y=r.top+.5,right=r.right-.5,bottom=r.bottom-.5;
        // Light also lands on the glass face, gently washing inward from the
        // source-facing edges rather than existing solely behind the windows.
        context.save();context.shadowBlur=0;
        context.beginPath();context.roundRect(x,y,r.width-1,r.height-1,radius);context.clip();
        for(const [index,source] of [[s.sourceX/width,s.sourceY/height],...EXTRA_LIGHTS].entries()){
          const [ox,oy]=source;
          const lx=clamp(ox*width,x,right),ly=clamp(oy*height,y,bottom);
          const nx=lx===x?-1:lx===right?1:0,ny=ly===bottom?1:ly===y?-1:0;
          const normal=Math.max(1,Math.hypot(nx,ny));
          // Each reflection uses only its own source's energy. Squashing the
          // falloff keeps the warm bleed along the lower glass and side edges.
          const energy=index===0?irradiance(lx,ly,nx/normal,ny/normal,s):sideBeam(lx,ly,nx/normal,ny/normal,source,width,height,s.time);
          const peak=index===0?.008+energy*.035:.014+energy*.13;
          const extent=Math.min(460,Math.max(r.width*.4,r.height*.64));
          context.save();context.translate(lx,ly);context.scale(1,.64);
          const wash=context.createRadialGradient(0,0,0,0,0,extent);
          wash.addColorStop(0,rgba(peak));
          wash.addColorStop(.28,rgba(peak*.37));
          wash.addColorStop(1,rgba(0));
          context.fillStyle=wash;context.fillRect(x-lx,(y-ly)/.64,r.width,r.height/.64);
          context.restore();
        }
        context.restore();
        const segments=[
          [x+radius,y,right-radius,y,0,-1],
          [right,y+radius,right,bottom-radius,1,0],
          [right-radius,bottom,x+radius,bottom,0,1],
          [x,bottom-radius,x,y+radius,-1,0]
        ];
        context.lineWidth=1.1;
        for(const [ax,ay,bx,by,nx,ny] of segments){
          const gradient=context.createLinearGradient(ax,ay,bx,by);
          let strongest=0;
          for(let i=0;i<=20;i++){
            const t=i/20,amount=point(ax+(bx-ax)*t,ay+(by-ay)*t,nx,ny);
            strongest=Math.max(strongest,amount);
            gradient.addColorStop(t,rgba(amount*.84));
          }
          context.strokeStyle=gradient;context.shadowColor=rgba(strongest*.72);context.shadowBlur=11;
          context.beginPath();context.moveTo(ax,ay);context.lineTo(bx,by);context.stroke();
        }
        for(const [cx,cy,start] of [[right-radius,y+radius,-Math.PI/2],[right-radius,bottom-radius,0],[x+radius,bottom-radius,Math.PI/2],[x+radius,y+radius,Math.PI]]){
          const angle=start+Math.PI/4,nx=Math.cos(angle),ny=Math.sin(angle);
          const amount=point(cx+nx*radius,cy+ny*radius,nx,ny);
          context.strokeStyle=rgba(amount*.84);context.shadowColor=rgba(amount*.72);context.shadowBlur=11;
          context.beginPath();context.arc(cx,cy,radius,start,start+Math.PI/2);context.stroke();
        }
      }
    };
    const refresh=()=>{if(!queued)queued=requestAnimationFrame(()=>{queued=0;paint()})};
    paintRef.current=()=>{if(performance.now()-lastPaint>=(window.innerWidth<=600?50:1000/30))paint()};paint();
    window.addEventListener('scroll',refresh,{passive:true});window.addEventListener('resize',refresh);document.addEventListener('fullscreenchange',refresh);
    return()=>{paintRef.current=null;cancelAnimationFrame(queued);window.removeEventListener('scroll',refresh);window.removeEventListener('resize',refresh);document.removeEventListener('fullscreenchange',refresh)};
  },[playerRef,chatRef]);
  const onLightFrame=useCallback(frame=>{lastFrame.current=frame;paintRef.current?.()},[]);
  return {canvasRef,onLightFrame};
}
