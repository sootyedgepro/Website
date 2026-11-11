import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import Lanyard from './vendor/react-bits/Lanyard.jsx';
import {SectionBackground} from './funnel-atmosphere.jsx';
import {CLASS_EVENT, eventDate, eventTime} from './models.mjs';
import './funnel-lanyards.css';
import RegistrationTicket from './registration-ticket.jsx';

const PHOTO = '/travelinginprofit/photos/zi-autozone.webp';
const BADGE_REVERSE = '/travelinginprofit/photos/zi-badge-graffiti-back-v2.png';
const imageCache = new Map();
const loadImage = src => {
  if (!imageCache.has(src)) imageCache.set(src, new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  }));
  return imageCache.get(src);
};

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

function cutCornerFrame(ctx, x, y, width, height, cut) {
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x + width, y + height - cut);
  ctx.lineTo(x + width - cut, y + height);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x, y + cut);
  ctx.closePath();
}

// Presentation textures only: the original source file remains unchanged.
// Mirror this selfie on the canvas so the uniform logo and name badge read correctly.
async function storyTexture(photo) {
  const [portrait] = await Promise.all([loadImage(photo), document.fonts.ready]);
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 1440;
  const ctx = canvas.getContext('2d');
  const graphite = ctx.createLinearGradient(0, 0, 1024, 1440);
  graphite.addColorStop(0, '#292522'); graphite.addColorStop(.55, '#141413'); graphite.addColorStop(1, '#24201d');
  ctx.fillStyle = graphite; ctx.fillRect(0, 0, 1024, 1440);
  // Keep a quiet margin around the physical slot; typography starts below it.
  ctx.fillStyle = '#f47a32'; ctx.fillRect(72, 128, 54, 5);
  ctx.textAlign = 'left'; ctx.fillStyle = '#eaa878'; ctx.font = '600 25px Montserrat, sans-serif';
  ctx.fillText('THE CHAPTER', 72, 174);
  ctx.fillStyle = '#f5eee4'; ctx.font = '700 34px Montserrat, sans-serif';
  ctx.fillText('BEFORE TRADING', 72, 213);
  ctx.fillStyle = '#f47a32'; ctx.textAlign = 'right'; ctx.font = '700 72px Montserrat, sans-serif';
  ctx.fillText('01', 952, 213);

  // A portrait-shaped inset keeps the full face, uniform, and original name badge visible.
  const frame = {x: 180, y: 234, width: 664, height: 932};
  cutCornerFrame(ctx, frame.x + 14, frame.y + 14, frame.width, frame.height, 64);
  ctx.fillStyle = '#e86b2c'; ctx.fill();
  ctx.save(); cutCornerFrame(ctx, frame.x, frame.y, frame.width, frame.height, 64); ctx.clip();
  ctx.fillStyle = '#e8e2da'; ctx.fillRect(frame.x, frame.y, frame.width, frame.height);
  if (portrait) {
    // Fit the entire source inside the angled mat instead of cropping into the head or uniform.
    const scale = Math.min((frame.width - 24) / portrait.width, (frame.height - 24) / portrait.height);
    const width = portrait.width * scale, height = portrait.height * scale;
    ctx.translate(1024, 0); ctx.scale(-1, 1);
    ctx.drawImage(portrait, frame.x + (frame.width - width) / 2, frame.y + (frame.height - height) / 2, width, height);
  }
  ctx.restore();
  cutCornerFrame(ctx, frame.x, frame.y, frame.width, frame.height, 64);
  ctx.strokeStyle = '#f6e4cf'; ctx.lineWidth = 3; ctx.stroke();
  ctx.save(); ctx.translate(110, 1118); ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'left'; ctx.fillStyle = '#bd9c85'; ctx.font = '600 25px Montserrat, sans-serif';
  ctx.fillText('PART OF MY STORY', 0, 0); ctx.restore();
  ctx.strokeStyle = '#69432d'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(915, 256); ctx.lineTo(915, 1114); ctx.stroke();
  ctx.strokeStyle = '#ef7935'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(915, 256); ctx.lineTo(915, 358); ctx.stroke();
  ctx.textAlign = 'left'; ctx.fillStyle = '#f6eee4'; ctx.font = '700 80px Montserrat, sans-serif';
  ctx.fillText('ZI MORRIS', 72, 1262, 840);
  ctx.fillStyle = '#fb8b48'; ctx.font = '600 32px Montserrat, sans-serif'; ctx.fillText('AUTOZONE', 76, 1314);
  ctx.fillStyle = '#c8bcb1'; ctx.font = '500 30px Montserrat, sans-serif'; ctx.fillText('Parts Sales Manager', 76, 1362);
  ctx.strokeStyle = '#6b4935'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(72, 1400); ctx.lineTo(862, 1400); ctx.lineTo(952, 1310); ctx.stroke();
  ctx.strokeStyle = '#ef7935'; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(892, 1365); ctx.lineTo(952, 1305); ctx.stroke();
  return canvas.toDataURL('image/png');
}

async function storyReverse() {
  const artwork = await loadImage(BADGE_REVERSE);
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1440;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#24201e';ctx.fillRect(0,0,1024,1440);
  // The artwork owns the entire reverse: no safety frame or bars cover the tags.
  if (artwork) ctx.drawImage(artwork, 0, 0, 1024, 1440);
  else {
    ctx.textAlign='center';ctx.fillStyle='#fce8d5';ctx.font='700 150px Montserrat, sans-serif';ctx.fillText('9–5',512,400);
    ctx.fillStyle='#f58235';ctx.font='700 95px Montserrat, sans-serif';ctx.fillText('DREAM BIG',512,750,900);
    ctx.fillStyle='#fce8d5';ctx.font='600 55px Montserrat, sans-serif';ctx.fillText('RAWKI WAS HERE',512,1090,900);
  }
  return canvas.toDataURL('image/png');
}

function BadgeScene({front, back, label}) {
  const reduced = useReducedMotion();
  const controls = useRef(null);
  const [ready, setReady] = useState(false);
  const [reverse, setReverse] = useState(false);
  const [behind, setBehind] = useState(false);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const [narrow, setNarrow] = useState(() => window.innerWidth <= 700);
  const [inView, setInView] = useState(false);
  const host = useRef(null);
  const [frame, setFrame] = useState({width: null, left: 0, anchor: .215});
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {if (entries.some(entry => entry.isIntersecting)) setInView(true);}, {threshold:.28});
    observer.observe(host.current); return () => observer.disconnect();
  }, []);
  useEffect(()=>{const mq=matchMedia('(max-width:700px)'),update=()=>setNarrow(mq.matches);mq.addEventListener('change',update);return()=>mq.removeEventListener('change',update)},[]);
  useLayoutEffect(() => {
    const section=host.current?.closest('#journey'), grid=host.current?.closest('.story-grid');
    if(!section||!grid)return;
    const measure=()=>{
      const area=section.getBoundingClientRect(), content=grid.getBoundingClientRect();
      const width=section.clientWidth;
      if(!width)return;
      setFrame({width,left:area.left-content.left,anchor:narrow?.5:(content.left-area.left+content.width*.215)/width});
    };
    measure();const observer=new ResizeObserver(measure);observer.observe(section);observer.observe(grid);
    return()=>observer.disconnect();
  },[narrow]);
  const staticMode = reduced || !ready;
  const flipBadge = () => {if(controls.current&&!reduced)controls.current.flip();else setReverse(value=>!value);};
  return <div className="tip-badge-scene" ref={host} data-depth={behind?'behind':'front'}>
    <div className="tip-badge-stage" role="group" aria-label={label}
      style={{zIndex:behind&&!staticMode&&!keyboardFocused?0:3,width:frame.width||undefined,left:frame.left,'--journey-anchor':`${frame.anchor*100}%`}}>
      {staticMode && <div className="tip-badge-fallback"><span className="tip-badge-fallback-strap" aria-hidden="true"/><img src={reverse ? back : front} alt="" draggable="false"/></div>}
      {inView && !reduced && front && <Lanyard frontImage={front} backImage={back} controlsRef={controls} onReady={setReady}
        onDepthChange={setBehind} orientation="portrait" anchor={frame.anchor} interactionRoot="#journey"
        cardColor="#2c211c" imageFit="contain" size={narrow?.68:.6} strapLength={narrow?.25:.38}
        strapColor="#e76222" strapWidth={.52} metal="silver" finish="matte" cornerRadius={.15}
        breeze={.1} damping={.72} elasticity={.25} intro interactive/>}
      <button type="button" className="tip-badge-keyboard" onClick={flipBadge}
        onFocus={()=>setKeyboardFocused(true)} onBlur={()=>setKeyboardFocused(false)}
        aria-label="Flip Zi Morris’s badge" style={{pointerEvents:staticMode?'auto':'none'}}>
        <span className="tip-badge-sr">Tap to turn. Press Enter or Space to flip the badge.</span>
      </button>
    </div>
  </div>;
}

function JourneyBadge({photo}) {
  const [front, setFront] = useState(photo);
  const [back,setBack]=useState('');
  useEffect(() => {
    let active = true;
    Promise.all([storyReverse(), document.fonts.ready]).then(([texture]) => { if (active) setBack(texture); });
    return () => { active = false; };
  }, []);
  useEffect(() => {let active = true; storyTexture(photo).then(texture => {if (active) setFront(texture);}); return () => {active = false;};}, [photo]);
  return <BadgeScene front={front} back={back||front} label="Zi Morris in his AutoZone uniform, Parts Sales Manager. The reverse reads 9–5, part of my story, Dream Big, and Rawki was here in original graffiti artwork."/>;
}

export function mountFunnelLanyards() {
  const journey = document.querySelector('#journey');
  const reserve = document.querySelector('#reserve');
  for (const [section, type] of [[journey, 'journey'], [reserve, 'reserve']]) {
    if (!section || section.dataset.lanyardBackground) continue;
    section.dataset.lanyardBackground = type;
    const backdrop = document.createElement('div'); backdrop.className = 'tip-section-effect'; backdrop.setAttribute('aria-hidden', 'true'); section.prepend(backdrop);
    createRoot(backdrop).render(<SectionBackground type={type}/>);
  }
  const original = journey?.querySelector('.story-photo-autozone');
  if (original && !original.dataset.lanyardMounted) {
    const photo = original.querySelector('img')?.getAttribute('src') || PHOTO;
    original.dataset.lanyardMounted = 'true'; original.classList.add('tip-story-lanyard');
    original.replaceChildren();
    createRoot(original).render(<JourneyBadge photo={photo}/>);
  }
  const registration = reserve?.querySelector('.registration-copy');
  if (registration && !registration.dataset.ticketMounted) {
    registration.dataset.ticketMounted = 'true'; registration.classList.add('tip-ticket-registration');
    const children = [...registration.children];
    const heading = children.filter(node => node.matches('.eyebrow, h2'));
    registration.querySelectorAll('h2 br').forEach(node => node.replaceWith(document.createTextNode(' ')));
    const controls = children.filter(node => node.matches('.event-details, .review-local-time, a'));
    const disclosure = children.filter(node => !heading.includes(node) && !controls.includes(node));
    registration.querySelector('.event-details')?.classList.add('tip-ticket-event-source');
    registration.replaceChildren();
    createRoot(registration).render(<RegistrationTicket heading={heading} controls={controls} disclosure={disclosure}/>);
  }
}
