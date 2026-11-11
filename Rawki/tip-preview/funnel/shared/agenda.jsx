import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import FlowingMenu from './vendor/react-bits/FlowingMenu.jsx';
import './agenda.css';

const destinations = ['#journey', '#method', '#tools', '#reserve'];
const images = ['/travelinginprofit/photos/travel-maldives-working.webp', '/travelinginprofit/photos/trading-plan-concept.webp',
  '/travelinginprofit/charts/sooty-flow-tracker.webp', '/travelinginprofit/photos/zi-portrait.webp'];

export function mountAgenda() {
  const original = document.querySelector('#agenda .agenda-list');
  if (!original || document.querySelector('#agenda .agenda-react')) return;
  const items = [...original.querySelectorAll(':scope > li')].map((row, index) => {
    const title = index === 0 ? 'From the 9 to 5, to Traveling the world' : row.querySelector('h3').textContent;
    const description = row.querySelector('p').textContent;
    const time = row.querySelector(':scope > span').textContent;
    return {
      text: <span className="agenda-flow-topic">
        <span className="agenda-flow-sr-time">{time}. </span>
        <strong>{title}</strong><span className="agenda-flow-description">{description}</span>
      </span>,
      meta: time, marquee: title, description, coverImage: images[index],
      coverPosition: index === 3 ? 'center 34%' : 'center', link: destinations[index]
    };
  });
  const host = document.createElement('div');
  host.className = 'agenda-react';
  original.replaceWith(host);
  const measureWidth = () => host.style.setProperty('--agenda-viewport-width', `${document.documentElement.clientWidth}px`);
  measureWidth();
  window.addEventListener('resize', measureWidth, {passive: true});
  const root = createRoot(host);
  flushSync(() => root.render(<FlowingMenu items={items} className="agenda-flowing-menu"
    ariaLabel="Class agenda — explore each topic" align="left" showArrow
    textColor="#162f45" bgColor="transparent" marqueeBgColor="#092232" marqueeTextColor="#fff"
    borderColor="#b6d3e9" speed={42} followCursor={0.16} duration={0.58}
    stretch={0} magnet={0} bandInset={0} bandRadius={0} carryContent={false} revealFrom="center"
    intro={false} imageShape="rounded"/>));
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    root.unmount();
    window.removeEventListener('resize', measureWidth);
    host.replaceWith(original);
  }, {once: true});
}
