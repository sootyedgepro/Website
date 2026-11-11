import React,{Component,useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import GhostFibers from './vendor/react-bits/GhostFibers.jsx';
import Counter from './vendor/react-bits/Counter.jsx';
import StarBorder from './vendor/react-bits/StarBorder.jsx';
import SpecularButton from './vendor/react-bits/SpecularButton.jsx';
import AnimatedList from './vendor/react-bits/AnimatedList.jsx';
import Carousel from './vendor/react-bits/Carousel.jsx';
import DriftWall from './vendor/react-bits/DriftWall.jsx';
import {CLASS_EVENT,countdown,eventStatus} from './models.mjs';
import './funnel-motion.css';

function useQuietMotion(){
  const [quiet,setQuiet]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.hidden||document.documentElement.dataset.motion==='paused');
  useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)');let manuallyPaused=document.documentElement.dataset.motion==='paused';const update=()=>setQuiet(media.matches||document.hidden||manuallyPaused);const changed=event=>{manuallyPaused=!!event.detail?.paused;update()};media.addEventListener('change',update);document.addEventListener('visibilitychange',update);document.addEventListener('funnelmotionchange',changed);return()=>{media.removeEventListener('change',update);document.removeEventListener('visibilitychange',update);document.removeEventListener('funnelmotionchange',changed)}},[]);
  return quiet;
}
function HeroFibers(){const quiet=useQuietMotion();return <GhostFibers glowColor="#2276fa" lineColor="#ecfdf5" secondaryColor="#0ab5ff" gradient="depth" layers={2} waves={1.5} twist={.25} volume={1.3} threads={64} fiberStyle="lines" foldGlow={2.7} sparkle={.2} particles={1.85} depthOfField={2} focusDepth={-.3} rotation={19} flow={-.2} glow={1.05} vignette={.2} mouseStrength={1.75} grain={.07} paused={quiet} mouseInteraction={!quiet} pulseOnClick={!quiet} intro={!quiet} dpr={1.25}/>}

function EventCounter({getEvent}){
  const [parts,setParts]=useState(()=>countdown(getEvent())),ref=useRef(null),visible=useRef(true),quiet=useQuietMotion();
  useEffect(()=>{let current=getEvent();const update=event=>{current=event.detail?.event||getEvent();if(visible.current)setParts(countdown(current))};const observer=new IntersectionObserver(entries=>{visible.current=entries.some(item=>item.isIntersecting);if(visible.current)setParts(countdown(current))});observer.observe(ref.current);document.addEventListener('reviewevent',update);return()=>{observer.disconnect();document.removeEventListener('reviewevent',update)}},[getEvent]);
  return <dl ref={ref} className="countdown-units tip-counter-units" aria-label="Time until the scheduled class">{Object.entries(parts).map(([key,value])=><div key={key}><dt>{{days:'Days',hours:'Hours',minutes:'Mins',seconds:'Secs'}[key]}</dt><dd>{quiet?<span className="tip-counter-static">{String(value).padStart(2,'0')}</span>:<Counter value={value} minDigits={2} fontSize="clamp(30px, 4.2vw, 48px)" fontWeight={600} textColor="inherit" duration={.48} bounce={.12} stagger={.025} intro={false} motionBlur={false}/>}</dd></div>)}</dl>;
}

function SeatCta({attributes,content,specular,getEvent}){
  const quiet=useQuietMotion(),[ended,setEnded]=useState(()=>eventStatus(getEvent())==='ended');
  useEffect(()=>{const update=event=>setEnded((event.detail?.status||eventStatus(getEvent()))==='ended');document.addEventListener('reviewevent',update);return()=>document.removeEventListener('reviewevent',update)},[getEvent]);
  const children=content.map((item,index)=>React.createElement(item.tag,{key:index,className:item.className},item.tag==='strong'&&ended?'VIEW CLASS STATUS':item.text));
  const star={color:'#fff1b0',trailColor:'#d7aa31',duration:12,thickness:1.3,radius:10,trailLength:.18,stars:1,glow:.4,hover:'brighten',paused:quiet,clickPulse:false};
  const className=(attributes.className||'')+' tip-rb-seat';
  if(specular)return <StarBorder {...star} as="div" className="tip-specular-frame" backgroundColor="transparent" borderColor="#e8c361"><SpecularButton as="a" {...attributes} className={className+' tip-specular-seat'} baseColor="#cda644" textColor="#272013" lineColor="#fff1b0" tint="#f4cd57" tintOpacity={.16} radius={10} size="lg" followMouse={!quiet} intensity={.7} idleIntensity={.25} glow={.4} proximity={160} speed={.14}>{children}</SpecularButton></StarBorder>;
  return <StarBorder {...star} {...attributes} as="a" className={className} backgroundColor="#f3cf5e" textColor="#272013" borderColor="#f6df91">{children}</StarBorder>;
}

function Benefits({items}){const quiet=useQuietMotion(),ref=useRef(null);useEffect(()=>{ref.current?.querySelector('[role=listbox]')?.setAttribute('aria-label','What you will learn in the class')},[]);return <div ref={ref} className="tip-benefits-motion"><p className="tip-motion-eyebrow">WHAT YOU'LL TAKE AWAY</p><AnimatedList items={items} frame={false} animation={quiet?'none':'fade'} width={300} gap={6} maxHeight={260} displayScrollbar={false} fadeSize={40} radius={10} animateOnce theme="dark" accentColor="#0ab5ff" renderItem={(item,index)=><><span className="tip-benefit-number">{String(index+1).padStart(2,'0')}</span><span className="tip-benefit-copy">{item}</span></>}/><p className="tip-list-hint">Scroll or use the arrow keys to explore.</p></div>}

function FaqCarousel({items}){
  const ref=useRef(null),[width,setWidth]=useState(720),[current,setCurrent]=useState(0),quiet=useQuietMotion();
  useEffect(()=>{const observer=new ResizeObserver(entries=>setWidth(entries[0].contentRect.width));observer.observe(ref.current);return()=>observer.disconnect()},[]);
  const cards=items.map((item,index)=><article className="tip-faq-answer" key={index}><p className="tip-motion-eyebrow">QUESTION {String(index+1).padStart(2,'0')} / {String(items.length).padStart(2,'0')}</p><h3>{item.question}</h3><div className="tip-faq-answer-body" role="region" aria-label={item.question+' answer'} tabIndex={index===current?0:-1} dangerouslySetInnerHTML={{__html:item.answer}}/></article>);
  return <div className="tip-faq-carousel" ref={ref}><Carousel items={cards} baseWidth="100%" aspectRatio={width/(width<560?380:350)} frame={false} effect={quiet?'fade':'slide'} indicator="bars" arrows autoplay={false} loop={false} gap={24} radius={18} theme="light" onChange={setCurrent}/><p className="tip-faq-position">{current+1} of {items.length} · Swipe, use the arrows, or press ← / →</p></div>;
}

class EffectBoundary extends Component{state={failed:false};static getDerivedStateFromError(){return{failed:true}}render(){return this.state.failed?this.props.fallback:this.props.children}}
function PhotoGrid({items}){return <div className="tip-travel-grid" role="region" aria-label="Zi's travel photographs" tabIndex={0}>{items.map(item=><figure key={item.src}><a href={item.src} target="_blank" rel="noopener" aria-label={'View '+item.title+' photograph'}><img src={item.src} alt={item.alt} loading="lazy"/></a><figcaption>{item.title}</figcaption></figure>)}</div>}
function TravelCarousel({items}){
  const quiet=useQuietMotion(),ref=useRef(null),[width,setWidth]=useState(700);
  const photos=useMemo(()=>items.map(item=>({image:item.src,title:item.alt||item.title,href:item.src})),[items]);
  useEffect(()=>{const observer=new ResizeObserver(([entry])=>setWidth(entry.contentRect.width));observer.observe(ref.current);return()=>observer.disconnect()},[]);
  const narrow=width<430,columns=narrow?3:width<580?4:5;
  return <div ref={ref} className="tip-travel-motion" role="region" aria-label="Zi's travel photographs">{quiet?<PhotoGrid items={items}/>:<EffectBoundary fallback={<PhotoGrid items={items}/>}><div className="tip-drift-stage"><DriftWall items={photos} columns={columns} tileWidth={narrow?116:144} tileHeight={narrow?177:220} gap={6} radius={9} tilt={-6} turn={narrow?-20:-30} roll={2} perspective={950} depth={150} speed={18} direction="down" variance={.3} parallax={.7} lift={32} fade={.6} dim={1} overlayColor="#000000" pauseOnHover={false}/></div></EffectBoundary>}</div>;
}
function attributesOf(anchor){const result={};for(const attribute of anchor.attributes){if(attribute.name==='class')result.className=attribute.value;else if(attribute.name!=='style'&&!attribute.name.startsWith('on'))result[attribute.name]=attribute.value}return result}

export function mountFunnelMotion({getEvent=()=>CLASS_EVENT}={}){
  const hero=document.querySelector('#opening');if(!hero||hero.dataset.motionMounted)return()=>{};hero.dataset.motionMounted='true';document.body.classList.add('tip-motion-enhanced');document.documentElement.classList.add('tip-motion-root');
  const dispose=[];
  function replace(node,component,className){const host=document.createElement('div');host.className=className;node.replaceWith(host);const root=createRoot(host);flushSync(()=>root.render(component));dispose.push(()=>{root.unmount();host.replaceWith(node)});return host}
  const background=document.createElement('div');background.className='tip-hero-fibers';background.setAttribute('aria-hidden','true');hero.prepend(background);const heroRoot=createRoot(background);heroRoot.render(<HeroFibers/>);dispose.push(()=>{heroRoot.unmount();background.remove()});
  const originalCountdown=hero.querySelector('.countdown-units');if(originalCountdown)replace(originalCountdown,<EventCounter getEvent={getEvent}/>,'tip-counter-mount');
  document.querySelectorAll('a.seat-button').forEach(anchor=>{const content=[...anchor.children].map(child=>({tag:child.tagName.toLowerCase(),className:child.className||undefined,text:child.textContent}));if(!content.length)content.push({tag:'strong',text:anchor.textContent});const specular=!!anchor.closest('#class-takeaways');replace(anchor,<SeatCta attributes={attributesOf(anchor)} content={content} specular={specular} getEvent={getEvent}/>,'tip-seat-mount'+(specular?' tip-seat-mount--specular':''))});
  const benefits=document.querySelector('#class-takeaways .finale-benefits');if(benefits)replace(benefits,<Benefits items={[...benefits.querySelectorAll('li')].map(item=>item.textContent.trim())}/>,'tip-benefits-mount');
  const faq=document.querySelector('#faq .faq-list');if(faq){const items=[...faq.querySelectorAll('details')].map(item=>({question:item.querySelector('summary')?.textContent||'',answer:[...item.children].filter(child=>child.tagName!=='SUMMARY').map(child=>child.outerHTML).join('')}));replace(faq,<FaqCarousel items={items}/>,'tip-faq-mount')}
  const travel=document.querySelector('.travel-reel');if(travel){const seen=new Set(),items=[];travel.querySelectorAll('.reel-card').forEach(card=>{const image=card.querySelector('img'),src=image?.getAttribute('src');if(!src||seen.has(src))return;seen.add(src);items.push({src,alt:image.alt,title:card.querySelector('figcaption')?.textContent||image.alt})});replace(travel,<TravelCarousel items={items}/>,'tip-travel-mount')}
  const cards=[...hero.querySelectorAll('.stage-card')],reduced=matchMedia('(prefers-reduced-motion: reduce)');let inView=true,manuallyPaused=document.documentElement.dataset.motion==='paused';const animations=cards.map((card,index)=>card.animate([{translate:'0 0'},{translate:'0 '+(index%2?7:-9)+'px'},{translate:'0 0'}],{duration:5200+index*450,iterations:Infinity,easing:'ease-in-out',delay:index*350}));
  function updateFloat(){const pause=reduced.matches||!inView||document.hidden||manuallyPaused;animations.forEach(animation=>pause?animation.pause():animation.play());if(reduced.matches)animations.forEach(animation=>animation.currentTime=0)}const change=event=>{manuallyPaused=!!event.detail?.paused;updateFloat()};const observer=new IntersectionObserver(entries=>{inView=entries.some(entry=>entry.isIntersecting);updateFloat()});observer.observe(hero);reduced.addEventListener('change',updateFloat);document.addEventListener('visibilitychange',updateFloat);document.addEventListener('funnelmotionchange',change);updateFloat();
  dispose.push(()=>{observer.disconnect();reduced.removeEventListener('change',updateFloat);document.removeEventListener('visibilitychange',updateFloat);document.removeEventListener('funnelmotionchange',change);animations.forEach(animation=>animation.cancel())});
  return()=>{dispose.reverse().forEach(cleanup=>cleanup());delete hero.dataset.motionMounted;document.body.classList.remove('tip-motion-enhanced');document.documentElement.classList.remove('tip-motion-root')};
}
