import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import WakeSlider from './vendor/react-bits/WakeSlider.jsx';
import PromptBar from './vendor/react-bits/PromptBar.jsx';
import LightRays from './vendor/react-bits/LightRays.jsx';
import {Backlight} from './vendor/magic-ui/Backlight.jsx';
import {useClassroomLightRim} from './classroom-light-rim.jsx';
import {ClassroomVideoAmbient} from './classroom-video-ambient.jsx';
import ClassroomEndDialog from './classroom-end-dialog.jsx';
import ClassroomYouTubePlayer from './classroom-youtube-player.jsx';
import {ClassroomRoomAtmosphere} from './classroom-room-atmosphere.jsx';
import {CLASS_EVENT,eventDate,eventTime} from './models.mjs';
import {getSavedRegistrationEvent} from './registration-storage.mjs';
import {classroomSchedule,livePlaybackBounds,clampLiveSeek,countdownParts,resolveClassroomEvent} from './classroom-schedule.mjs';
import {useClassroomClock} from './use-classroom-clock.jsx';
import './event-preview.css';
import {trackEvent} from '../../tracking-client.mjs';

const TEST_CLIP='https://www.youtube.com/watch?v=dnfD5fO2PrE';
const YOUTUBE_ID='dnfD5fO2PrE';
const POSTER='/travelinginprofit/charts/sooty-flow-tracker.webp';
const CHAT=[
  {time:0,name:'Class guide',initials:'TIP',text:'Welcome. Start with the trend, then map the areas to watch.'},
  {time:4,name:'Example question',initials:'?',text:'What does each layer on the chart tell us?'},
  {time:9,name:'Class guide',initials:'TIP',text:'Flow Tracker shows direction. Action Zones identify reaction areas. Tunnel Bands add the weekly reference levels.'},
  {time:15,name:'Example question',initials:'?',text:'Can we look at a setup where the decision is to wait?'},
  {time:23,name:'Class guide',initials:'TIP',text:'Waiting is part of the preparation. The chart gives context; the trade decision still needs a plan.'},
  {time:65,name:'Example question',initials:'?',text:'What would make you wait instead of entering here?'},
  {time:120,name:'Class guide',initials:'TIP',text:'Keep the bigger picture in view. A level is an area to observe, not a reason to enter on its own.'},
  {time:185,name:'Example question',initials:'?',text:'How do you put the trend and the weekly levels together?'},
  {time:260,name:'Class guide',initials:'TIP',text:'Write down the conditions you need before considering an entry.'}
];
const EMPTY=[];
function useQuiet(){
  const [quiet,setQuiet]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.hidden);
  useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)');let paused=document.documentElement.dataset.motion==='paused';const update=()=>setQuiet(media.matches||document.hidden||paused);const toggle=e=>{paused=!!e.detail?.paused;update()};media.addEventListener('change',update);document.addEventListener('visibilitychange',update);document.addEventListener('funnelmotionchange',toggle);return()=>{media.removeEventListener('change',update);document.removeEventListener('visibilitychange',update);document.removeEventListener('funnelmotionchange',toggle)}},[]);
  return quiet;
}
function VolumeIcon({muted}){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/>{muted?<path d="m16 9 5 6m0-6-5 6"/>:<><path d="M15 8a6 6 0 0 1 0 8"/><path d="M18 5a10 10 0 0 1 0 14"/></>}</svg>}
function EventPreview({suiteUrl,recordingSrc,ownerPreview,scheduledEvent,scheduleUrl}){
  const video=useRef(null),frame=useRef(null),chat=useRef(null),picker=useRef(null),objectUrl=useRef(null),log=useRef(null),stickToBottom=useRef(true);
  const initial=useRef(resolveClassroomEvent(scheduledEvent,getSavedRegistrationEvent(),CLASS_EVENT));
  const {event,now,clockNow}=useClassroomClock(initial.current,scheduleUrl);
  const [localSource,setLocalSource]=useState(''),[fileName,setFileName]=useState('');
  const source=localSource||event.recordingSrc||recordingSrc||TEST_CLIP,isYouTube=source===TEST_CLIP;
  const [volume,setVolume]=useState(35),[muted,setMuted]=useState(true),[playing,setPlaying]=useState(false),[screenLit,setScreenLit]=useState(false);
  const [elapsed,setElapsed]=useState(0),[duration,setDuration]=useState(NaN),[ended,setEnded]=useState(false),[error,setError]=useState('');
  const [messages,setMessages]=useState([]),[announcement,setAnnouncement]=useState(''),[fullscreen,setFullscreen]=useState(false),[ready,setReady]=useState(false);
  const [endInvitation,setEndInvitation]=useState(false),[aspect,setAspect]=useState(1.6);
  const followLive=useRef(true),joined=useRef(false),autoAttempted=useRef(false),lastCorrection=useRef(0);
  const trackedVideo=useRef(new Set());
  const quiet=useQuiet(),schedule=classroomSchedule(event,now);
  const bounds=livePlaybackBounds(event,now,duration>0?duration:undefined);
  const waiting=schedule.phase==='upcoming',completed=bounds.phase==='ended'||ended;
  const windowOpen=bounds.canPlay&&!ended;
  const {canvasRef:rimCanvas,onLightFrame}=useClassroomLightRim(frame,chat);
  // Always derive the ceiling at the instant of the operation, not a render's timestamp.
  const liveBounds=()=>livePlaybackBounds(event,clockNow(),duration>0?duration:undefined);
  const getMaxTime=()=>liveBounds().liveEdge;
  const visibleChat=waiting?EMPTY:CHAT.filter(message=>message.time<=schedule.position);

  useEffect(()=>{trackedVideo.current=new Set()},[event.startsAt,source]);
  useEffect(()=>{
    const report=(key,type,progress)=>{if(trackedVideo.current.has(key))return;trackedVideo.current.add(key);void trackEvent(type,{provider:isYouTube?'youtube':'video',eventStart:event.startsAt,duration:Number.isFinite(duration)?duration:0,...(progress!==undefined?{progress}:{})})};
    if(playing)report('started','video_started');
    if(playing&&duration>0)for(const mark of [25,50,75])if(elapsed/duration*100>=mark)report('progress'+mark,'video_progress',mark);
    if(completed&&trackedVideo.current.has('started'))report('completed','video_completed',100);
  },[playing,elapsed,duration,completed,event.startsAt,isYouTube]);

  useEffect(()=>{
    joined.current=false;followLive.current=true;autoAttempted.current=false;
    setEnded(false);setEndInvitation(false);setElapsed(0);setPlaying(false);setScreenLit(false);setError('');
    video.current?.pause();setMessages([]);
  },[event.startsAt,source]);
  useEffect(()=>{setDuration(NaN);setReady(false);setAspect(1.6)},[source]);
  useEffect(()=>{
    if(!playing){setScreenLit(false);return}
    // The house lights finish their fade before the screen becomes a light source.
    const timer=setTimeout(()=>setScreenLit(true),1450);return()=>clearTimeout(timer);
  },[playing]);
  useEffect(()=>{
    if(completed){video.current?.pause();setPlaying(false);if(document.fullscreenElement)document.exitFullscreen().catch(()=>{})}
    setEndInvitation(completed);
  },[completed]);
  useEffect(()=>{
    const full=()=>setFullscreen(document.fullscreenElement===frame.current);
    document.addEventListener('fullscreenchange',full);
    return()=>{document.removeEventListener('fullscreenchange',full);if(objectUrl.current)URL.revokeObjectURL(objectUrl.current)};
  },[]);
  useEffect(()=>{if(video.current){video.current.volume=volume/100;video.current.muted=muted}},[volume,muted,source,ready]);
  useEffect(()=>{
    const player=video.current;if(!player||!ready||player.readyState<1)return;
    if(!windowOpen){player.pause();return}
    if(!autoAttempted.current){
      autoAttempted.current=true;joined.current=true;followLive.current=true;
      player.currentTime=getMaxTime();player.muted=true;setMuted(true);
      player.play().catch(failure=>{if(failure?.name!=='AbortError')setError('The class is ready. Press play to join.')});
    }
  },[windowOpen,ready,event.startsAt]);
  useEffect(()=>{
    const player=video.current;if(!player||!ready||!windowOpen||player.paused)return;
    player.playbackRate=1;
    const edge=getMaxTime(),current=player.currentTime;
    if(current>edge+.25)player.currentTime=edge;
    // Buffering can put a live follower behind; a deliberate rewind never gets corrected.
    else if(followLive.current&&edge-current>3&&clockNow()-lastCorrection.current>3000){
      lastCorrection.current=clockNow();player.currentTime=edge;
    }
  },[now,windowOpen,ready]);
  useEffect(()=>{if(stickToBottom.current&&log.current)log.current.scrollTop=log.current.scrollHeight},[visibleChat.length,messages.length]);

  function metadata(){
    const player=video.current;if(!player)return;
    if(Number.isFinite(player.duration)&&player.duration>0)setDuration(player.duration);
    if(!isYouTube&&player.videoWidth&&player.videoHeight)setAspect(player.videoWidth/player.videoHeight);
    player.playbackRate=1;setReady(true);setError('');
  }
  function preventSeek(){
    const player=video.current;if(!player)return;
    const edge=getMaxTime();if(player.currentTime>edge+.1)player.currentTime=edge;
  }
  function onProgress(){preventSeek();setElapsed(video.current?.currentTime||0)}
  function onPlay(){
    if(!liveBounds().canPlay){video.current?.pause();return}
    setPlaying(true);setError('');
  }
  function onPause(){followLive.current=false;setPlaying(false)}
  async function startPlayer(){
    const player=video.current;if(!player||!liveBounds().canPlay)return;
    if(!joined.current){player.currentTime=getMaxTime();followLive.current=true;joined.current=true}
    try{await player.play();setError('')}catch(failure){if(failure?.name!=='AbortError')setError(failure?.message||'Press play to join the class.')}
  }
  function togglePlay(){
    const player=video.current;if(!player)return;
    if(!player.paused){followLive.current=false;player.pause()}else startPlayer();
  }
  function rewind(){
    const player=video.current;if(!player||!windowOpen)return;
    joined.current=true;followLive.current=false;
    player.currentTime=clampLiveSeek(player.currentTime-15,getMaxTime());setElapsed(player.currentTime);
  }
  function backToLive(){
    const player=video.current;if(!player||!windowOpen)return;
    joined.current=true;followLive.current=true;player.currentTime=getMaxTime();setElapsed(player.currentTime);startPlayer();
  }
  async function toggleFullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await frame.current?.requestFullscreen()}catch{setError('Full screen is unavailable in this browser.')}}
  function selectFile(e){
    const file=e.target.files?.[0];if(!file)return;
    if(!file.type.startsWith('video/')&&!/\.(mp4|webm|mov|m4v|ogv)$/i.test(file.name)){setError('Choose a supported video file.');e.target.value='';return}
    video.current?.pause();if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);objectUrl.current=URL.createObjectURL(file);
    setLocalSource(objectUrl.current);setFileName(file.name);
  }
  function resetClip(){video.current?.pause();if(objectUrl.current){URL.revokeObjectURL(objectUrl.current);objectUrl.current=null}setLocalSource('');setFileName('');if(picker.current)picker.current.value=''}
  function addMessage(text){const value=text.trim().slice(0,500);if(!value)return;stickToBottom.current=true;setMessages(old=>[...old,{id:crypto.randomUUID(),name:'You',initials:'YOU',text:value}].slice(-30));setAnnouncement('Message added to your local classroom preview.')}
  const behind=Math.max(0,Math.floor(bounds.liveEdge-elapsed));
  return <div className="classroom-experience" data-phase={completed?'ended':schedule.phase} data-playing={playing||undefined} data-screen-lit={screenLit||undefined} data-quiet={quiet||undefined}>
    <div className="classroom-light-field" aria-hidden="true"><LightRays raysOrigin="bottom-center" raysColor="#eab308" raysSpeed={quiet?0:.8} lightSpread={.5} rayDensity={1.7} glow={.18} intensity={.65} noiseAmount={.14} fadeDistance={.8} haze={.22} rayLength={1.8} raySharpness={.4} followMouse={!quiet} cursorShadow={!quiet} clickPulse={false} intro={!quiet} maxDevicePixelRatio={1.5} onLightFrame={onLightFrame}/></div>
    <ClassroomVideoAmbient videoRef={video} playerRef={frame} active={screenLit} source={source} windowOpen={!isYouTube} quiet={quiet}/>
    <ClassroomRoomAtmosphere playing={playing} quiet={quiet}/>
    <canvas ref={rimCanvas} className="classroom-light-rim" aria-hidden="true"/>
    <div className="classroom-shell">
      <Backlight className="classroom-video-light" style={{'--classroom-video-ratio':aspect}} active={screenLit} blur={24} spread={isYouTube?120:0}>
        <section ref={frame} className="classroom-player" aria-label="Class video" data-playing={playing||undefined}>
          {isYouTube?<ClassroomYouTubePlayer playerRef={video} videoId={YOUTUBE_ID} initialVolume={volume/100} initialMuted={muted} getMaxTime={getMaxTime} onReady={metadata} onPlay={onPlay} onPause={onPause} onEnded={()=>{setPlaying(false);setEnded(true)}} onTimeUpdate={onProgress} onError={failure=>setError(failure.message)}/>:<video ref={video} src={source} crossOrigin={source.startsWith('blob:')?undefined:'anonymous'} playsInline preload="metadata" controlsList="nodownload noplaybackrate" disablePictureInPicture poster={POSTER} aria-label="Scheduled prerecorded class" onPlay={onPlay} onPause={onPause} onEnded={()=>{setPlaying(false);setEnded(true)}} onLoadedMetadata={metadata} onSeeking={preventSeek} onTimeUpdate={onProgress} onRateChange={()=>{if(video.current?.playbackRate!==1)video.current.playbackRate=1}} onError={()=>setError('The recording could not load. Please check back shortly.')} onContextMenu={e=>e.preventDefault()}/>}
          {waiting&&<div className="classroom-waiting-screen">
            <span className="classroom-waiting-orbit" aria-hidden="true"/>
            <p className="classroom-kicker">TRAVELING IN PROFIT · WITH ZI MORRIS</p>
            <h1>Your seat is ready.</h1><p className="classroom-waiting-subtitle">Settle in. The class starts together.</p>
            <dl className="classroom-countdown" aria-label="Time until the scheduled class">{Object.entries(countdownParts(schedule.remaining)).map(([name,value])=><div key={name}><dd>{String(value).padStart(2,'0')}</dd><dt>{name}</dt></div>)}</dl>
            <p className="classroom-start-date">{eventDate(event,event.timeZone)} · {eventTime(event,event.timeZone)}</p>
            <span className="classroom-waiting-status"><i/>Waiting for the broadcast</span>
          </div>}
          {completed&&<div className="classroom-video-cover" data-waiting><h2>Thanks for joining.</h2><button className="classroom-ended-action" onClick={()=>setEndInvitation(true)}>Explore the tools from the class ↗</button></div>}
          {windowOpen&&!playing&&!error&&<button type="button" className="classroom-join" onClick={startPlayer} aria-label="Join the live class"><span aria-hidden="true">▶</span><small>{joined.current?'Resume class':'Join the class'}</small></button>}
          {windowOpen&&<div className="classroom-controls">
            <button type="button" className="classroom-control-button" onClick={togglePlay} aria-label={playing?'Pause video':'Play video'} title={playing?'Pause':'Play'}><span aria-hidden="true">{playing?'Ⅱ':'▶'}</span></button>
            <button type="button" className="classroom-control-button classroom-rewind" onClick={rewind} aria-label="Rewind 15 seconds" title="Rewind 15 seconds">↶<small>15</small></button>
            <div className="classroom-volume"><button type="button" className="classroom-control-button" onClick={()=>setMuted(value=>!value)} aria-label={muted?'Unmute video':'Mute video'} aria-pressed={muted}><VolumeIcon muted={muted||volume===0}/></button><WakeSlider value={muted?0:volume} onChange={next=>{setVolume(next);setMuted(false)}} min={0} max={100} step={1} bars={24} gap={3} height={30} restHeight={7} fillColor="#ebcf82" trackColor="#ffffff35" crestColor="#fff8df" showValue={false} ariaLabel="Video volume"/></div>
            <span className="classroom-control-spacer"/>
            <button type="button" className="classroom-live-button" onClick={backToLive} data-live={behind<4||undefined} aria-label={behind<4?'At live broadcast position':'Catch up to the live broadcast'}><i/>{behind<4?'LIVE':'Back to live'}{behind>=4&&<small>{Math.floor(behind/60)}:{String(behind%60).padStart(2,'0')} behind</small>}</button>
            {document.fullscreenEnabled&&<button type="button" className="classroom-control-button" onClick={toggleFullscreen} aria-label={fullscreen?'Exit full screen':'Full screen'} title="Full screen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg></button>}
          </div>}
          {error&&!waiting&&!completed&&<p className="classroom-player-error" role="alert">{error}</p>}
        </section>
      </Backlight>
      <section ref={chat} className="classroom-chat classroom-window" aria-labelledby="classroom-chat-title">
        <header><h2 id="classroom-chat-title">Class conversation</h2><details className="classroom-info"><summary aria-label="About this classroom and preview settings" title="Classroom information">i</summary><div className="classroom-info-popover"><strong>About this classroom</strong><p>The class uses a scheduled recording. Rewind to revisit a moment or return to the live position. The conversation keeps following the class.</p><p>Conversation messages are simulated. Your messages stay in this browser and are not sent to Zi or other attendees.</p>{ownerPreview&&<><p>{isYouTube?'Preview video selected for this classroom.':`Local video: ${fileName}. It stays on your device.`}</p><div className="classroom-preview-settings"><strong>Preview settings</strong><button type="button" onClick={()=>picker.current?.click()}>{isYouTube?'Try your recording':'Change recording'}</button>{!isYouTube&&<button type="button" onClick={resetClip}>Use selected YouTube video</button>}<input ref={picker} type="file" accept="video/*,.mp4,.webm,.mov,.m4v" onChange={selectFile} hidden aria-label="Select a local recording"/></div></>}</div></details></header>
        <div ref={log} className="classroom-chat-messages" role="log" aria-live="polite" aria-relevant="additions" aria-label="Classroom conversation preview" onScroll={()=>{const box=log.current;stickToBottom.current=box.scrollHeight-box.scrollTop-box.clientHeight<45}}>
          {waiting&&<div className="classroom-chat-waiting"><span>YOU’RE EARLY. YOU’RE READY.</span><p>The conversation starts with the class.</p></div>}
          {[...visibleChat,...messages].map(message=><article className="classroom-chat-message" key={message.id||message.time}><span aria-hidden="true" className="classroom-avatar">{message.initials}</span><div><header><strong>{message.name}</strong>{message.id&&<span>Now</span>}</header><p>{message.text}</p></div></article>)}
        </div>
        <div className="classroom-chat-compose"><PromptBar placeholder="Type something to Zi." inputAriaLabel="Message for the classroom preview" maxLength={500} sources={EMPTY} commands={EMPTY} models={EMPTY} efforts={EMPTY} onSend={addMessage} background="#071019" color="#ffffff" menuBackground="#0d1b27" sparkColor="#2276fa" sparkBoost={.8} morphDuration={180} pressScale={.93} tilt={4} maxRows={4} width={600} radius={13}/></div><span className="classroom-sr-only" role="status">{announcement}</span>
      </section>
    </div>
    <ClassroomEndDialog open={endInvitation} onClose={()=>setEndInvitation(false)} suiteUrl={suiteUrl}/>
  </div>;
}
export function mountEventPreview(element=document.querySelector('[data-event-preview]')){
  if(!element)return()=>{};const root=createRoot(element),suiteUrl=element.dataset.suiteUrl||new URL('/#suite-demo',location.origin).href;
  const ownerPreview=new URLSearchParams(location.search).get('preview')==='1';
  const scheduledEvent=element.dataset.eventStart?{id:'tip-classroom-'+element.dataset.eventStart.slice(0,10),startsAt:element.dataset.eventStart,timeZone:element.dataset.eventTimezone||CLASS_EVENT.timeZone}:null;
  const scheduleUrl=new URL('/travelinginprofit/classroom/schedule.json',location.origin).href;
  root.render(<EventPreview suiteUrl={suiteUrl} recordingSrc={element.dataset.recordingSrc||TEST_CLIP} ownerPreview={ownerPreview} scheduledEvent={scheduledEvent} scheduleUrl={scheduleUrl}/>);return()=>root.unmount();
}
