import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {transform} from 'esbuild';

const source=await fs.readFile(new URL('../funnel/shared/classroom-youtube-player.jsx',import.meta.url),'utf8');
const {code}=await transform(source,{loader:'jsx',format:'cjs'});

async function mount({getMaxTime=()=>Infinity}={}){
  let effect,player,observer,clock=0,nextTimer=0;
  const timers=new Map(),events=[];
  const host={clientWidth:1120,clientHeight:700,children:[],append(node){this.children.push(node)},replaceChildren(){this.children=[]}};
  const react={createElement(type,props){props.ref.current=host;return {type,props}},useRef(current){return {current}},useEffect(fn){effect=fn}};
  class Player{
    constructor(iframe,options){this.iframe=iframe;this.events=options.events;this.state=5;this.time=0;this.duration=300;this.rate=1;this.actions=[];player=this}
    getDuration(){return this.duration}getCurrentTime(){return this.time}getPlayerState(){return this.state}getPlaybackRate(){return this.rate}
    setPlaybackRate(value){this.rate=value;this.actions.push(['rate',value])}
    setVolume(value){this.actions.push(['volume',value])}mute(){this.actions.push(['mute'])}unMute(){this.actions.push(['unmute'])}
    seekTo(value){this.time=value;this.actions.push(['seek',value])}playVideo(){this.actions.push(['play'])}pauseVideo(){this.state=2;this.actions.push(['pause'])}
    destroy(){this.destroyed=true}
  }
  class ResizeObserver{
    constructor(callback){this.callback=callback;observer=this}observe(){}disconnect(){this.disconnected=true}
  }
  const window={
    YT:{Player},location:{origin:'https://classroom.example'},
    setTimeout(fn,ms){const id=++nextTimer;timers.set(id,{fn,ms,interval:false});return id},clearTimeout(id){timers.delete(id)},
    setInterval(fn,ms){const id=++nextTimer;timers.set(id,{fn,ms,interval:true});return id},clearInterval(id){timers.delete(id)}
  };
  const context={module:{exports:{}},require(name){assert.equal(name,'react');return react},window,document:{hidden:false,createElement(){return {style:{}}}},URLSearchParams,DOMException,ResizeObserver,performance:{now:()=>clock}};
  vm.runInNewContext(code,context);
  const ref={current:null};
  const props={playerRef:ref,videoId:'dnfD5fO2PrE',getMaxTime,initialVolume:.35};
  for(const name of ['onReady','onPlay','onPause','onEnded','onSeeking','onSeeked','onTimeUpdate'])props[name]=()=>events.push(name);
  props.onError=error=>events.push(error.code);
  context.module.exports.default(props);
  const cleanup=effect();await Promise.resolve();
  player.events.onReady({target:player});
  return {ref,player,host,observer,events,timers,cleanup,
    tick(ms=250){clock+=ms;for(const timer of timers.values())if(timer.interval)timer.fn()},
    state(value){player.state=value;player.events.onStateChange({data:value})}
  };
}

test('YouTube viewport covers the 16:10 classroom without stretching and cleans up on unmount',async()=>{
  const view=await mount();
  const iframe=view.host.children[0],width=parseFloat(iframe.style.width),height=parseFloat(iframe.style.height);
  assert.ok(Math.abs(width/height-16/9)<.00001);
  assert.equal(height,707);
  assert.ok(width>view.host.clientWidth);
  assert.equal(iframe.title,'YouTube classroom preview video');
  assert.match(iframe.src,/controls=0/);
  view.host.clientWidth=640;view.host.clientHeight=400;view.observer.callback();
  assert.equal(parseFloat(iframe.style.height),404);
  view.cleanup();
  assert.equal(view.observer.disconnected,true);
  assert.equal(view.player.destroyed,true);
  assert.equal(view.ref.current,null);
  assert.equal(view.timers.size,0);
  assert.equal(view.host.children.length,0);
});

test('live boundary clamps forward seeks and advances without pulling a rewound viewer forward',async()=>{
  let liveEdge=100;
  const view=await mount({getMaxTime:()=>liveEdge});
  view.ref.current.currentTime=250;
  assert.equal(view.ref.current.currentTime,100);
  assert.equal(view.player.actions.some(action=>action[0]==='seek'),false,'cued seek cannot autoplay');
  const started=view.ref.current.play();view.state(1);await started;
  assert.equal(view.player.time,100);
  view.tick();
  view.ref.current.currentTime=40;view.tick();
  const seeks=view.player.actions.filter(action=>action[0]==='seek').length;
  liveEdge=120;view.player.time=40.25;view.tick();view.player.time=40.5;view.tick();
  assert.equal(view.ref.current.currentTime,40.5);
  assert.equal(view.player.actions.filter(action=>action[0]==='seek').length,seeks,'a moving edge must not undo rewind');
  view.ref.current.currentTime=500;
  assert.equal(view.player.time,120,'setter must read the current edge, not its mount-time value');
  view.tick();
  view.player.time=260;view.tick();
  assert.equal(view.player.time,120,'iframe-originated forward seeks must also be corrected');
  view.cleanup();
});

test('a provider seek to the future end is corrected without ending the class or resuming a paused viewer',async()=>{
  const view=await mount({getMaxTime:()=>100});
  view.state(2);view.player.time=300;view.state(0);
  assert.equal(view.player.time,100);
  assert.equal(view.ref.current.paused,true);
  assert.equal(view.player.actions.at(-1)[0],'pause');
  assert.equal(view.events.includes('onEnded'),false);
  view.tick();
  view.player.time=30;view.tick();
  assert.equal(view.ref.current.currentTime,30);
  assert.ok(view.events.includes('onSeeked'));
  view.cleanup();
});

test('YouTube rate changes and ref assignments keep playback at 1x; restricted embeds report their error',async()=>{
  const view=await mount();
  view.player.rate=2;view.player.events.onPlaybackRateChange({data:2});
  assert.equal(view.player.rate,1);
  view.player.rate=.5;view.ref.current.playbackRate=2;
  assert.equal(view.player.rate,1);
  assert.equal(view.ref.current.playbackRate,1);
  view.player.rate=1.5;view.tick();
  assert.equal(view.player.rate,1);
  assert.ok([...view.timers.values()].some(timer=>timer.interval&&timer.ms===250));
  view.player.events.onError({data:101});
  await assert.rejects(view.ref.current.play(),/disabled playback/);
  assert.equal(view.events.at(-1),101);
  view.cleanup();
});
