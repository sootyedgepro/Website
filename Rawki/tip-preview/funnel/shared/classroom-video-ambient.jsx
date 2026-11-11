import React,{useEffect,useRef} from 'react';
import './classroom-video-ambient.css';

const SAMPLE_WIDTH=48;
const SAMPLE_HEIGHT=28;
const FRAME_INTERVAL=125;

/**
 * Mount directly inside .classroom-experience, outside the player's filtered
 * Backlight wrapper. It samples the existing video; it never plays another one.
 */
export function ClassroomVideoAmbient({videoRef,playerRef,active=false,source='',windowOpen=true,quiet=false}){
  const layerRef=useRef(null),canvasRef=useRef(null);

  useEffect(()=>{
    const layer=layerRef.current,canvas=canvasRef.current;
    const video=videoRef.current,player=playerRef.current;
    if(!layer||!canvas)return;
    if(!active||!video||!player||!windowOpen||!source){layer.dataset.visible='false';return}

    // Read only this tiny canvas. A cross-origin recording can taint it without
    // affecting the displayed video or the ambient presentation canvas.
    const sampler=document.createElement('canvas');
    sampler.width=SAMPLE_WIDTH;sampler.height=SAMPLE_HEIGHT;
    const input=sampler.getContext('2d',{willReadFrequently:true});
    const output=canvas.getContext('2d');
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    const pixels=output?.createImageData(SAMPLE_WIDTH,SAMPLE_HEIGHT);
    const smoothed=new Float32Array(SAMPLE_WIDTH*SAMPLE_HEIGHT*3);
    let timer=0,layoutFrame=0,disposed=false,onScreen=false;
    let failed=!input||!output,hasFrame=false,lastTime=-1,lastSample=-Infinity;
    layer.dataset.mode='static';

    const isVisible=()=>active&&onScreen&&!document.hidden&&!document.fullscreenElement;
    const canSample=()=>!disposed&&isVisible()&&!quiet&&!motion.matches&&!failed;
    const stop=()=>{window.clearTimeout(timer);timer=0};

    function sample(){
      const now=performance.now();
      if(!canSample()||video.readyState<2||!video.videoWidth||!video.videoHeight||video.currentTime===lastTime||now-lastSample<FRAME_INTERVAL)return;
      lastSample=now;
      try{
        // Match the visible cover crop rather than projecting hidden letterbox
        // content from recordings with a different aspect ratio.
        const frameRatio=player.clientWidth/Math.max(1,player.clientHeight);
        const videoRatio=video.videoWidth/video.videoHeight;
        const cropWidth=videoRatio>frameRatio?video.videoHeight*frameRatio:video.videoWidth;
        const cropHeight=videoRatio>frameRatio?video.videoHeight:video.videoWidth/frameRatio;
        input.drawImage(video,(video.videoWidth-cropWidth)/2,(video.videoHeight-cropHeight)/2,cropWidth,cropHeight,0,0,SAMPLE_WIDTH,SAMPLE_HEIGHT);
        const frame=input.getImageData(0,0,SAMPLE_WIDTH,SAMPLE_HEIGHT).data;
        const blend=hasFrame?.28:1;
        let red=0,green=0,blue=0;
        for(let pixel=0;pixel<SAMPLE_WIDTH*SAMPLE_HEIGHT;pixel++){
          const rgba=pixel*4,rgb=pixel*3;
          for(let channel=0;channel<3;channel++){
            smoothed[rgb+channel]+=(frame[rgba+channel]-smoothed[rgb+channel])*blend;
            pixels.data[rgba+channel]=smoothed[rgb+channel];
          }
          pixels.data[rgba+3]=255;
          red+=smoothed[rgb];green+=smoothed[rgb+1];blue+=smoothed[rgb+2];
        }
        const count=SAMPLE_WIDTH*SAMPLE_HEIGHT;
        output.putImageData(pixels,0,0);
        layer.style.setProperty('--ambient-color',`${Math.round(red/count)} ${Math.round(green/count)} ${Math.round(blue/count)}`);
        layer.dataset.mode='sampled';
        hasFrame=true;lastTime=video.currentTime;
      }catch(error){
        // CORS restrictions disable readback only. Do not change crossOrigin,
        // reload the source, or surface an error over otherwise valid playback.
        if(error.name==='SecurityError'){
          failed=true;layer.dataset.mode='static';stop();
        }
      }
    }

    function schedule(){
      if(!timer&&canSample()&&!video.paused&&!video.ended){
        timer=window.setTimeout(()=>{timer=0;sample();schedule()},FRAME_INTERVAL);
      }
    }

    function sync(){
      if(disposed)return;
      layer.dataset.visible=isVisible()?'true':'false';
      layer.dataset.mode=quiet||motion.matches||failed||!hasFrame?'static':'sampled';
      if(!canSample()||video.paused||video.ended){stop();return}
      sample();schedule();
    }

    function measure(){
      layoutFrame=0;
      if(disposed)return;
      const rect=player.getBoundingClientRect();
      onScreen=rect.width>0&&rect.height>0&&rect.bottom>0&&rect.top<window.innerHeight&&rect.right>0&&rect.left<window.innerWidth;
      // This spill reaches well beyond the edge light, even on a narrow screen.
      const spreadX=Math.min(260,Math.max(110,rect.width*.3));
      const spreadY=Math.min(230,Math.max(110,rect.height*.48));
      const properties={
        '--ambient-left':`${rect.left-spreadX}px`,
        '--ambient-top':`${rect.top-spreadY}px`,
        '--ambient-width':`${rect.width+spreadX*2}px`,
        '--ambient-height':`${rect.height+spreadY*2}px`,
        '--ambient-center-x':`${rect.left+rect.width/2}px`,
        '--ambient-center-y':`${rect.top+rect.height/2}px`,
        '--ambient-player-width':`${rect.width}px`,
        '--ambient-player-height':`${rect.height}px`
      };
      for(const [name,value] of Object.entries(properties))layer.style.setProperty(name,value);
      sync();
    }

    const queueMeasure=()=>{if(!layoutFrame)layoutFrame=requestAnimationFrame(measure)};
    const resizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(queueMeasure):null;
    resizeObserver?.observe(player);
    const intersectionObserver=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
      onScreen=entries[0]?.isIntersecting??false;sync();
    }):null;
    intersectionObserver?.observe(player);
    const mediaEvents=['playing','pause','ended','loadeddata','seeked'];
    mediaEvents.forEach(name=>video.addEventListener(name,sync));
    document.addEventListener('visibilitychange',sync);
    document.addEventListener('fullscreenchange',queueMeasure);
    motion.addEventListener('change',sync);
    window.addEventListener('resize',queueMeasure);
    window.addEventListener('scroll',queueMeasure,{passive:true,capture:true});
    window.visualViewport?.addEventListener('resize',queueMeasure);
    measure();

    return()=>{
      disposed=true;stop();cancelAnimationFrame(layoutFrame);
      layer.dataset.visible='false';
      resizeObserver?.disconnect();intersectionObserver?.disconnect();
      mediaEvents.forEach(name=>video.removeEventListener(name,sync));
      document.removeEventListener('visibilitychange',sync);
      document.removeEventListener('fullscreenchange',queueMeasure);
      motion.removeEventListener('change',sync);
      window.removeEventListener('resize',queueMeasure);
      window.removeEventListener('scroll',queueMeasure,true);
      window.visualViewport?.removeEventListener('resize',queueMeasure);
    };
  },[videoRef,playerRef,active,source,windowOpen,quiet]);

  return <div ref={layerRef} className="classroom-video-ambient" data-active={active&&windowOpen&&!!source||undefined} data-quiet={quiet||undefined} aria-hidden="true">
    <div className="classroom-video-ambient__wash"/>
    <canvas ref={canvasRef} className="classroom-video-ambient__projection" width={SAMPLE_WIDTH} height={SAMPLE_HEIGHT}/>
  </div>;
}
