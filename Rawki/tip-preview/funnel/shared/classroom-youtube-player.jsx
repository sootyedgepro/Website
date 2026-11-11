import React,{useEffect,useRef} from 'react';

let iframeApiPromise;

// Keep the shared API script alive when a classroom unmounts. Another player
// may still use it, including React's development mount/cleanup/mount cycle.
function loadIframeApi(){
  if(window.YT?.Player)return Promise.resolve(window.YT);
  if(iframeApiPromise)return iframeApiPromise;
  iframeApiPromise=new Promise((resolve,reject)=>{
    const previousReady=window.onYouTubeIframeAPIReady;
    const existing=document.querySelector('script[src="https://www.youtube.com/iframe_api"],script[src="https://www.youtube.com/player_api"]');
    const script=existing||document.createElement('script');
    let settled=false;
    const cleanup=()=>{
      window.clearTimeout(timeout);
      script.removeEventListener('error',failed);
      if(window.onYouTubeIframeAPIReady===ready)window.onYouTubeIframeAPIReady=previousReady;
    };
    const finish=(error)=>{
      if(settled)return;
      settled=true;cleanup();
      if(error){if(!existing)script.remove();reject(error)}else resolve(window.YT);
    };
    const failed=()=>finish(new Error('The YouTube player could not load. Check your connection and try again.'));
    const ready=()=>{
      try{if(typeof previousReady==='function')previousReady()}finally{
        if(window.YT?.Player)finish();else failed();
      }
    };
    const timeout=window.setTimeout(failed,20000);
    window.onYouTubeIframeAPIReady=ready;
    script.addEventListener('error',failed,{once:true});
    if(!existing){script.src='https://www.youtube.com/iframe_api';script.async=true;document.head.append(script)}
  }).catch(error=>{iframeApiPromise=undefined;throw error});
  return iframeApiPromise;
}

function playbackError(code){
  const messages={
    2:'The YouTube video address is invalid.',
    5:'This YouTube video could not play in your browser. Try reloading the classroom.',
    100:'This YouTube video is unavailable or private.',
    101:'The video owner has disabled playback on other websites. Watch this video on YouTube.',
    150:'The video owner has disabled playback on other websites. Watch this video on YouTube.',
    153:'YouTube could not verify this embedded player. Open the classroom from its website and try again.'
  };
  const error=new Error(messages[code]||'The YouTube video could not load. Please try again later.');
  error.name='YouTubePlayerError';error.code=code;
  return error;
}

/**
 * An iframe controlled through YouTube's public API, with a video-like ref for
 * the classroom's existing controls. initialVolume uses the native 0–1 range.
 * onReady also fires when previously unavailable duration metadata arrives.
 */
export default function ClassroomYouTubePlayer({
  playerRef,videoId,initialVolume=.35,initialMuted=false,
  getMaxTime,onReady,onPlay,onPause,onEnded,onTimeUpdate,onSeeking,onSeeked,onError
}){
  const hostRef=useRef(null),callbacks=useRef(null);
  callbacks.current={getMaxTime,onReady,onPlay,onPause,onEnded,onTimeUpdate,onSeeking,onSeeked,onError,initialVolume,initialMuted};

  useEffect(()=>{
    const host=hostRef.current;
    if(!host)return;
    let player,disposed=false,ready=false,fatalError=null,paused=true;
    let volume=Math.max(0,Math.min(1,Number(callbacks.current.initialVolume)||0));
    let muted=!!callbacks.current.initialMuted,currentTime=0,duration=NaN,pendingSeek=null;
    let tickTimer=0,readyTimer=0,playTimer=0,pendingPlay=null;
    let resizeObserver=null,seekingTarget=null,seekingStartedAt=0;
    let lastObservedTime=null,lastObservedAt=0,lastEmittedTime=null;

    const emit=name=>{if(!disposed)callbacks.current[name]?.({target:adapter,currentTarget:adapter})};
    const maximumTime=()=>{
      const limit=callbacks.current.getMaxTime?.();
      return Math.min(Number.isFinite(limit)?Math.max(0,limit):Infinity,Number.isFinite(duration)?duration:Infinity);
    };
    const clampTime=value=>Math.min(Math.max(0,value),maximumTime());
    const keepNormalSpeed=()=>{
      if(ready&&!disposed&&player.getPlaybackRate()!==1)player.setPlaybackRate(1);
    };
    const seek=value=>{
      const target=clampTime(value);
      // Repeated boundary checks must not restart an in-flight seek.
      if(seekingTarget!==null&&Math.abs(seekingTarget-target)<.05&&performance.now()-seekingStartedAt<1000)return;
      currentTime=target;seekingTarget=target;seekingStartedAt=performance.now();
      // seekTo on a cued/ended player starts it. Defer that seek until play()
      // so scheduled metadata and replay preparation do not autoplay.
      const state=ready&&!disposed?player.getPlayerState():-1;
      const canSeek=ready&&!disposed&&(state===1||state===2||state===3);
      pendingSeek=canSeek?null:target;
      emit('onSeeking');
      if(canSeek)player.seekTo(target,true);
    };
    const enforceBoundary=observed=>{
      const maximum=maximumTime();
      if(observed<=maximum+.1)return false;
      if(seekingTarget===null||performance.now()-seekingStartedAt>=1000){
        const wasPaused=paused;
        seek(maximum);
        // An iframe interaction can jump to the video's end. Correct its
        // displayed frame immediately, preserving the previous pause state.
        if(pendingSeek!==null){
          player.seekTo(pendingSeek,true);pendingSeek=null;
          if(wasPaused)player.pauseVideo();
        }
      }
      currentTime=maximum;
      return true;
    };
    const settlePlay=error=>{
      window.clearTimeout(playTimer);playTimer=0;
      if(!pendingPlay)return;
      const pending=pendingPlay;pendingPlay=null;
      if(error)pending.reject(error);else pending.resolve();
    };
    const reportError=error=>{
      if(disposed)return;
      fatalError=error;paused=true;
      window.clearTimeout(readyTimer);window.clearInterval(tickTimer);
      settlePlay(error);emit('onPause');callbacks.current.onError?.(error);
    };
    const refreshMetadata=notify=>{
      if(!ready||disposed)return;
      const next=Number(player.getDuration());
      if(next>0&&Number.isFinite(next)&&next!==duration){
        const firstMetadata=!Number.isFinite(duration);
        duration=next;
        if(notify&&firstMetadata)emit('onReady');
      }
    };
    const tick=()=>{
      if(!ready||disposed||fatalError)return;
      refreshMetadata(true);keepNormalSpeed();
      const observed=Math.max(0,Number(player.getCurrentTime())||0),sampledAt=performance.now();
      if(enforceBoundary(observed)){
        // Enforce only the leading boundary. Viewers who rewind or pause keep
        // their position while the shared wall-clock edge continues forward.
      }else if(pendingSeek!==null){
        pendingSeek=clampTime(pendingSeek);currentTime=pendingSeek;seekingTarget=pendingSeek;
      }else if(seekingTarget!==null){
        // YouTube seeks to keyframes, so accept a nearby result or the final
        // position after settling instead of repeatedly seeking to an exact frame.
        if(Math.abs(observed-seekingTarget)<1||sampledAt-seekingStartedAt>=1500){
          currentTime=observed;seekingTarget=null;emit('onSeeked');
        }
      }else{
        currentTime=observed;
        const expected=lastObservedTime===null?observed:lastObservedTime+(paused?0:(sampledAt-lastObservedAt)/1000);
        if(Math.abs(observed-expected)>1.25){emit('onSeeking');emit('onSeeked')}
      }
      lastObservedTime=observed;lastObservedAt=sampledAt;
      if(!document.hidden&&(!paused||currentTime!==lastEmittedTime)){
        lastEmittedTime=currentTime;emit('onTimeUpdate');
      }
    };
    const adapter={
      get readyState(){return ready&&!fatalError?(Number.isFinite(duration)?4:1):0},
      get duration(){return duration},
      get currentTime(){
        return clampTime(pendingSeek??seekingTarget??(ready&&!disposed?Number(player.getCurrentTime())||0:currentTime));
      },
      set currentTime(value){
        const next=Number(value);if(!Number.isFinite(next))return;
        seek(next);
      },
      get seeking(){return seekingTarget!==null},
      get paused(){return paused},
      get playbackRate(){return 1},
      set playbackRate(_value){keepNormalSpeed()},
      get volume(){return volume},
      set volume(value){
        const next=Number(value);if(!Number.isFinite(next))return;
        volume=Math.max(0,Math.min(1,next));
        if(ready&&!disposed)player.setVolume(volume*100);
      },
      get muted(){return muted},
      set muted(value){
        muted=!!value;
        if(ready&&!disposed){if(muted)player.mute();else player.unMute()}
      },
      play(){
        if(disposed)return Promise.reject(new DOMException('The player was closed.','AbortError'));
        if(fatalError)return Promise.reject(fatalError);
        if(!ready)return Promise.reject(new Error('The YouTube player is still loading. Press play again in a moment.'));
        if(pendingPlay)return pendingPlay.promise;
        keepNormalSpeed();
        enforceBoundary(Number(player.getCurrentTime())||0);
        if(player.getPlayerState()===1)return Promise.resolve();
        const promise=new Promise((resolve,reject)=>{pendingPlay={resolve,reject}});
        pendingPlay.promise=promise;paused=false;
        playTimer=window.setTimeout(()=>{
          paused=true;player.pauseVideo();
          const error=new Error('Playback could not start. Press play to try again.');
          settlePlay(error);emit('onPause');callbacks.current.onError?.(error);
        },15000);
        try{
          if(pendingSeek!==null){
            currentTime=clampTime(pendingSeek);seekingTarget=currentTime;seekingStartedAt=performance.now();
            player.seekTo(currentTime,true);pendingSeek=null;
          }
          player.playVideo();
        }catch(error){paused=true;settlePlay(error)}
        return promise;
      },
      pause(){
        paused=true;
        settlePlay(new DOMException('Playback was paused.','AbortError'));
        if(ready&&!disposed)player.pauseVideo();
      }
    };
    playerRef.current=adapter;

    loadIframeApi().then(YT=>{
      if(disposed)return;
      if(!/^[A-Za-z0-9_-]{11}$/.test(videoId)){reportError(playbackError(2));return}
      const iframe=document.createElement('iframe');
      const params=new URLSearchParams({enablejsapi:'1',controls:'0',disablekb:'1',fs:'0',playsinline:'1',rel:'0',autoplay:'0',origin:window.location.origin});
      iframe.src=`https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params}`;
      iframe.title='YouTube classroom preview video';
      iframe.allow='autoplay; encrypted-media; fullscreen; picture-in-picture';
      iframe.allowFullscreen=true;
      iframe.referrerPolicy='strict-origin-when-cross-origin';
      iframe.style.cssText='display:block;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border:0;max-width:none;';
      host.append(iframe);
      const fitIframe=()=>{
        const width=host.clientWidth,height=host.clientHeight;
        if(!width||!height)return;
        // Keep YouTube's 16:9 viewport centered inside the recording's outer
        // frame. The slight overscan removes encoded edge pixels without
        // stretching the video or disabling the iframe's own interactions.
        iframe.style.width=`${Math.max(width,height*16/9)*1.01}px`;
        iframe.style.height=`${Math.max(height,width*9/16)*1.01}px`;
      };
      fitIframe();resizeObserver=new ResizeObserver(fitIframe);resizeObserver.observe(host);
      readyTimer=window.setTimeout(()=>reportError(new Error('The YouTube player did not respond. Check your connection and reload the classroom.')),25000);
      player=new YT.Player(iframe,{events:{
        onReady:event=>{
          if(disposed||fatalError)return;
          player=event.target;ready=true;window.clearTimeout(readyTimer);
          player.setVolume(volume*100);if(muted)player.mute();else player.unMute();
          keepNormalSpeed();
          refreshMetadata(false);emit('onReady');
          tickTimer=window.setInterval(tick,250);
        },
        onStateChange:event=>{
          if(disposed||fatalError)return;
          refreshMetadata(true);keepNormalSpeed();
          const corrected=ready&&enforceBoundary(Number(player.getCurrentTime())||0);
          if(event.data===1){paused=false;settlePlay();emit('onPlay')}
          else if(event.data===2){paused=true;emit('onPause')}
          else if(event.data===0&&!corrected){paused=true;settlePlay();emit('onTimeUpdate');emit('onEnded')}
        },
        onPlaybackRateChange:()=>{if(!disposed&&!fatalError)keepNormalSpeed()},
        onError:event=>reportError(playbackError(event.data)),
        onAutoplayBlocked:()=>{
          if(disposed||fatalError)return;
          paused=true;
          const error=new Error('Your browser blocked playback. Press play to try again.');
          settlePlay(error);emit('onPause');callbacks.current.onError?.(error);
        }
      }});
    }).catch(reportError);

    return()=>{
      disposed=true;ready=false;
      window.clearInterval(tickTimer);window.clearTimeout(readyTimer);
      resizeObserver?.disconnect();
      settlePlay(new DOMException('The player was closed.','AbortError'));
      if(playerRef.current===adapter)playerRef.current=null;
      try{player?.destroy()}finally{host.replaceChildren()}
    };
  },[playerRef,videoId]);

  return <div ref={hostRef} className="classroom-youtube-player" style={{position:'absolute',inset:0,width:'100%',height:'100%',overflow:'hidden',background:'#02070b'}}/>;
}
