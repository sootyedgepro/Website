import React from 'react';
import {createRoot} from 'react-dom/client';
import AnimatedContent from './vendor/react-bits/AnimatedContent.jsx';
import './suite-guidance.css';

const Arrow=()=> <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10h13m-5-5 5 5-5 5"/></svg>;

function SuiteIntroduction(){
  return <section className="suite-welcome" aria-labelledby="suite-welcome-title">
    <div className="suite-welcome-heading">
      <p className="suite-guidance-eyebrow">The SootyEdge Trading Suite</p>
      <h1 id="suite-welcome-title">Understand your chart<br/><em>before your next trade.</em></h1>
      <p className="suite-welcome-fit">For traders who know basic charts and want a more structured preparation routine.</p>
    </div>
    <div className="suite-welcome-copy">
      <p>Three TradingView indicators bring trend and momentum, reaction zones, and fixed weekly levels into the same view.</p>
      <p>Start with the short chart guide below. Watch the tools appear, then drag or zoom to see how they work together.</p>
      <div className="suite-welcome-actions"><a className="suite-guidance-primary" href="#suite-demo">Explore the chart <Arrow/></a><a className="suite-guidance-link" href="#suite-getting-started">What comes with the suite <span aria-hidden="true">↓</span></a></div>
    </div>
    <div className="suite-welcome-facts" aria-label="Suite essentials"><span>Made for TradingView</span><span>All three indicators included</span><span>One-time software purchase</span></div>
  </section>;
}

function SuiteGettingStarted({classUrl}){
  return <section className="suite-start" id="suite-getting-started" aria-labelledby="suite-start-title">
    <AnimatedContent distance={18} duration={0.55} threshold={0.06} once className="suite-start-reveal">
      <div className="suite-start-intro">
        <div><p className="suite-guidance-eyebrow">From this demo to your chart</p><h2 id="suite-start-title">The tools are included.<br/><em>So is help getting started.</em></h2></div>
        <p>Your personal license gives you access to Flow Tracker, Action Zones and Tunnel Bands in your own TradingView account. Setup documentation and technical support are included.</p>
      </div>
      <ol className="suite-start-steps">
        <li><span className="suite-step-number" aria-hidden="true">01</span><h3>Get the complete suite.</h3><p>One purchase covers all three private indicators for lifetime personal use under the software license.</p></li>
        <li><span className="suite-step-number" aria-hidden="true">02</span><h3>Send your TradingView username.</h3><p>Access is granted within one business day after verified payment and receipt of your exact username.</p></li>
        <li><span className="suite-step-number" aria-hidden="true">03</span><h3>Add the tools to your chart.</h3><p>Follow the setup documentation, add the private indicators, and build your preparation routine. Technical support is there if you need it.</p></li>
      </ol>
      <div className="suite-start-choice">
        <div><strong>Want to see Zi use them first?</strong><p>Explore the class and the preparation behind the software before deciding.</p></div>
        <a className="suite-guidance-link" href={classUrl}>See the free class <Arrow/></a>
      </div>
      <p className="suite-start-platform">You’ll need a TradingView account. Separate platform fees may apply. The indicators support analysis; you decide when to trade and how much to risk.</p>
    </AnimatedContent>
  </section>;
}

function mount(element,content){
  if(!element)return()=>{};
  const root=createRoot(element);root.render(content);return()=>root.unmount();
}
export function mountSuiteIntroduction(element){return mount(element,<SuiteIntroduction/>)}
export function mountSuiteGettingStarted(element,classUrl='https://travelinginprofit.com/'){return mount(element,<SuiteGettingStarted classUrl={classUrl}/>)}
