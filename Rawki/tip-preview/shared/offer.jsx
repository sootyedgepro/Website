import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import TiltedCard from './vendor/react-bits/TiltedCard.jsx';
import './offer-source.css';

function useQuietEffects(){
  const [quiet,setQuiet]=useState(()=>matchMedia('(prefers-reduced-motion: reduce), (hover: none)').matches);
  useEffect(()=>{
    const media=matchMedia('(prefers-reduced-motion: reduce), (hover: none)');
    const update=()=>setQuiet(media.matches);
    update();media.addEventListener('change',update);
    return()=>media.removeEventListener('change',update);
  },[]);
  return quiet;
}
const Arrow=()=> <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10h13m-5-5 5 5-5 5"/></svg>;

function LicenseFace({openPurchase}){
  return <div className="offer-pass">
    <div className="offer-pass-top"><span>SootyEdge</span><span>Personal software license</span></div>
    <img className="offer-pass-mark" src="/sootyedge-icon.png" width="174" height="200" alt="" aria-hidden="true"/>
    <div className="offer-pass-price">
      <h3>Trading Suite</h3>
      <p className="offer-amount"><span>$</span>2,500</p>
      <p className="offer-payment">One payment. Lifetime personal access.</p>
    </div>
    <div className="offer-pass-bottom">
      <span className="offer-pass-term">No recurring software fee</span>
      <button type="button" className="offer-buy" onClick={openPurchase}><span>Get the suite</span><Arrow/></button>
    </div>
  </div>;
}

function Offer({openPurchase}){
  const quiet=useQuietEffects();
  const face=<LicenseFace openPurchase={openPurchase}/>;
  return <div className="offer-content">
    <div className="offer-heading">
      <p className="offer-eyebrow">The complete trading suite</p>
      <h2 id="suite-offer-title">SootyEdge,<br/><em>on your chart.</em></h2>
      <p className="offer-heading-copy">A personal license for your TradingView account.</p>
    </div>
    <div className="offer-card-stage">
      {quiet?<div className="offer-license-static">{face}</div>:
        <TiltedCard className="offer-license-card"
          containerWidth="100%" containerHeight="var(--offer-card-height)"
          imageWidth="100%" imageHeight="var(--offer-card-height)"
          rotateAmplitude={5} scaleOnHover={1.015} radius={20}
          glare={0.22} glareColor="#f1d99d" shadow={0.6} parallax={0.3}
          showTooltip={false} gyroscope={false} floating={false} intro={false}
          flipOnClick={false} smoothness={0.5}>{face}</TiltedCard>}
    </div>
    <div className="offer-details">
      <p className="offer-inclusion-line"><span>All three indicators</span><span>Setup documentation</span><span>Technical support</span></p>
      <p className="offer-activation-note">Access within one business day after verified payment and receipt of your TradingView username.</p>
      <div className="offer-policy"><a href="/refunds">Seven-day refund policy <span aria-hidden="true">↗</span></a><a href="/license">License terms <span aria-hidden="true">↗</span></a></div>
      <p className="offer-platform-note">TradingView is required and may have separate platform fees. Software supports analysis; it does not execute trades.</p>
    </div>
  </div>;
}
export function mountOffer(element,openPurchase){
  if(!element)return()=>{};
  element.classList.add('suite-purchase');
  element.setAttribute('aria-labelledby','suite-offer-title');
  const root=createRoot(element);
  root.render(<Offer openPurchase={openPurchase}/>);
  return()=>root.unmount();
}
