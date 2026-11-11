import React,{useEffect,useRef} from 'react';
import './classroom-end-dialog.css';

export default function ClassroomEndDialog({open,onClose,onReplay,suiteUrl}){
  const dialog=useRef(null);
  useEffect(()=>{
    const element=dialog.current;
    if(open&&!element.open)element.showModal();
    else if(!open&&element.open)element.close();
  },[open]);
  return <dialog ref={dialog} className="classroom-end-dialog" aria-labelledby="classroom-end-title" aria-describedby="classroom-end-description" onClose={onClose} onClick={event=>{if(event.target===event.currentTarget)onClose()}}>
    <div className="classroom-end-content">
      <button type="button" className="classroom-end-close" aria-label="Close class invitation" onClick={onClose}>×</button>
      <p className="classroom-kicker">THANK YOU FOR JOINING</p>
      <h2 id="classroom-end-title">The class has ended.</h2>
      <p id="classroom-end-description">Take a closer look at the tools behind the preparation.</p>
      <div className="classroom-end-suite"><span className="classroom-kicker">THE SOOTYEDGE TRADING SUITE</span><h3>Explore the chart for yourself.</h3><p>Try Flow Tracker, Action Zones and Tunnel Bands together in one interactive chart.</p></div>
      <a className="classroom-end-primary" href={suiteUrl}>Explore SootyEdge <span aria-hidden="true">↗</span></a>
      <div className="classroom-end-secondary"><button type="button" onClick={onClose}>Back to classroom</button>{onReplay&&<button type="button" onClick={onReplay}>Replay preview</button>}</div>
    </div>
  </dialog>;
}
