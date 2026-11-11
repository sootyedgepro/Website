import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createPortal, flushSync} from 'react-dom';
import CardSwap, {Card} from './vendor/react-bits/CardSwap.jsx';
import Waves from './vendor/react-bits/Waves.jsx';
import './member-results-source.css';

// Keep the original evidence and its existing full-size image-viewer handlers.
function OriginalContent({nodes, className, style}) {
  const container = useRef(null);
  useLayoutEffect(() => { container.current.replaceChildren(...nodes); }, [nodes]);
  return <div ref={container} className={className} style={style}/>;
}

// Presentation-only trims, measured against the original screenshots. The right
// bounds include all post text, trades and reactions; the viewer uses the full file.
const IMAGE_FRAMES = {
  'mike.webp': {width: 756, height: 762, right: 500},
  'cultracurrency.webp': {width: 768, height: 810, right: 574},
  'bobby.webp': {width: 724, height: 802, right: 424},
  'lt.webp': {width: 1166, height: 372, right: 1166},
  'chris-gray.webp': {width: 758, height: 650, right: 674},
  'chris-silver.jpg': {width: 1320, height: 1960, right: 1320}
};

function MemberWindow({member}) {
  return <>
    <OriginalContent nodes={member.header} className="member-window-header"/>
    <div className="member-window-body">
      <OriginalContent nodes={member.image} className="member-window-image"
        style={member.frame ? {
          '--member-image-ratio': member.frame.right / member.frame.height,
          '--member-image-width': `${member.frame.width / member.frame.right * 100}%`
        } : undefined}/>
      <OriginalContent nodes={member.details} className="member-window-details"/>
    </div>
  </>;
}

function MemberDeck({members, wavesHost}) {
  const wrapper = useRef(null);
  const deck = useRef(null);
  const [available, setAvailable] = useState(960);
  const [active, setActive] = useState(0);
  const [quiet, setQuiet] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const measure = new ResizeObserver(([entry]) => setAvailable(entry.contentRect.width));
    measure.observe(wrapper.current);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setQuiet(media.matches); setActive(0); };
    media.addEventListener('change', update);
    return () => { measure.disconnect(); media.removeEventListener('change', update); };
  }, []);
  const compact = available < 650;
  const cardWidth = Math.max(220, Math.min(640, available - (compact ? 28 : 104)));
  const cardHeight = compact ? 294 : 350;
  const verticalDistance = compact ? 34 : 45;
  const stagePadding = compact ? 8 : 14;
  // Reserve the raised back windows plus breathing room above/below the stack.
  // No negative margin or transform is used to pull it into the heading.
  const stageHeight = cardHeight + verticalDistance * 2 + stagePadding * 2 + 32;
  const move = direction => {
    if (quiet) setActive(value => (value + direction + members.length) % members.length);
    else if (direction > 0) deck.current?.next();
    else deck.current?.prev();
  };
  return <div ref={wrapper} className={`member-deck ${compact ? 'member-deck--compact' : ''}`}>
    {createPortal(<Waves key={quiet ? 'static' : 'motion'} lineColor="#262626" backgroundColor="transparent" spacing={4}
      amplitude={35} speed={0.65} twist={1.3} mouseRadius={60} mouseInteraction={false}
      clickRipple={false} intro={false} paused={quiet} dpr={1}/>, wavesHost)}
    <p id="member-deck-help" className="member-deck-sr">{quiet
      ? 'Use the previous and next buttons, or the left and right arrow keys, to browse all six member screenshots.'
      : 'Select a window behind the front card, swipe or drag a card, or use the left and right arrow keys to browse all six member screenshots.'}</p>
    <div className="member-deck-stage" style={{height: quiet ? cardHeight : stageHeight}}
      aria-label="Member screenshots"
      aria-describedby="member-deck-help"
      onKeyDownCapture={event => {
        if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        // A slide becoming inert must never retain keyboard focus.
        event.currentTarget.querySelector('.card-swap, .member-window--static')?.focus();
        move(['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1);
      }}>
      {quiet ? <div className="member-window member-window--static" role="group" tabIndex={0}
        aria-label={`${members[active].name}, ${active + 1} of ${members.length}`}>
        <MemberWindow member={members[active]}/>
        <div className="member-quiet-navigation">
          <button type="button" aria-label="Previous member screenshot" onClick={() => move(-1)}>←</button>
          <button type="button" aria-label="Next member screenshot" onClick={() => move(1)}>→</button>
        </div>
      </div> : <CardSwap ref={deck} width={cardWidth} height={cardHeight}
        cardDistance={compact ? 10 : 32} verticalDistance={verticalDistance} depth={compact ? 16 : 25}
        visibleCards={3} skewAmount={0} bounce={0.18} speed={1.15} parallax={0}
        hoverSpread={0} dim={0.12} cardRadius={12} stagePadding={stagePadding} intro={false}
        autoplay={false} draggable dragBoundary="#clients" onChange={setActive}
        className="member-card-swap">
        {members.map((member, index) => <Card key={member.name} className="member-window"
          inert={index !== active} aria-hidden={index !== active} role="group"
          aria-roledescription="slide" aria-label={`${member.name}, ${index + 1} of ${members.length}`}>
          <MemberWindow member={member}/>
        </Card>)}
      </CardSwap>}
    </div>
    <p className="member-deck-sr" aria-live="polite" aria-atomic="true">{members[active].name}, screenshot {active + 1} of {members.length}</p>
  </div>;
}

export function mountMemberResults() {
  const grid = document.querySelector('#clients .member-results-grid');
  if (!grid || grid.dataset.cardSwapMounted) return;
  const original = [...grid.childNodes];
  const members = [...grid.querySelectorAll(':scope > .member-result')].map(article => {
    const nodes = [...article.childNodes];
    const header = article.querySelector('.member-result-header');
    const image = article.querySelector('figure');
    const filename = image.querySelector('img')?.getAttribute('src')?.split('/').pop();
    return {article, nodes, name: article.querySelector('h3').textContent.trim(), frame: IMAGE_FRAMES[filename],
      header: [header], image: [image],
      details: nodes.filter(node => node !== header && node !== image)};
  });
  if (!members.length) return;
  const section = grid.closest('#clients');
  const wavesHost = document.createElement('div');
  wavesHost.className = 'member-waves-background';
  wavesHost.setAttribute('aria-hidden', 'true');
  section.classList.add('member-results-waves-section');
  section.prepend(wavesHost);
  const host = document.createElement('div');
  host.className = 'member-deck-react';
  grid.dataset.cardSwapMounted = 'true';
  grid.classList.add('member-results-deck');
  grid.replaceChildren(host);
  const root = createRoot(host);
  flushSync(() => root.render(<MemberDeck members={members} wavesHost={wavesHost}/>));
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    root.unmount();
    wavesHost.remove();
    section.classList.remove('member-results-waves-section');
    members.forEach(member => member.article.replaceChildren(...member.nodes));
    grid.replaceChildren(...original);
    grid.classList.remove('member-results-deck');
    delete grid.dataset.cardSwapMounted;
  }, {once: true});
}
