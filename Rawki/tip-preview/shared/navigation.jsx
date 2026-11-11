import React from 'react';
import {createRoot} from 'react-dom/client';
import CardNav from './vendor/react-bits/CardNav.jsx';
import './navigation.css';

export function mountNavigation(element,classUrl){
  const items=[
    {label:'The suite',description:'Explore the tools on one chart.',bgColor:'#172334',links:[
      {label:'Interactive chart',href:'#suite-demo'},
      {label:'Software details',href:'/software'},
      {label:'Real chart walkthrough',href:'/walkthrough'},
      {label:'Lifetime access',href:'#suite-offer'}
    ]},
    {label:'Learn with Zi',description:'See the preparation behind the trade.',bgColor:'#202723',links:[
      {label:'Free live class',href:classUrl},
      {label:'Preparation checklist',href:'/free-checklist'}
    ]},
    {label:'Support',description:'Setup, access and the details.',bgColor:'#27251f',links:[
      {label:'Get help',href:'/support'},
      {label:'License',href:'/license'},
      {label:'Refund policy',href:'/refunds'}
    ]}
  ];
  const root=createRoot(element);
  root.render(<CardNav
    logo={<span className="sooty-nav-brand"><span>Sooty</span><img src="/sootyedge-icon.png" alt="" width="40" height="46"/><span>Edge</span></span>}
    logoAlt="SootyEdge home" logoHref="/" items={items}
    cta={{label:'Get the suite',href:'#suite-offer'}}
    cardEffect="rise" openOn="click" theme="dark" surface="glass"
    maxWidth={1232} cardHeight={150} stagger={0.07} bounce={0.08}
    accentColor="#d9bc77" intro={false} ariaLabel="Main navigation"
    className="sooty-card-nav"
    style={{'--cn-panel':'rgba(17,25,38,.88)','--cn-radius':'14px','--cn-logo':'46px','--cn-text':'#eeeae0','--cn-muted':'#a5afbd','--cn-shadow':'0 15px 35px -20px #000b'}}
  />);
  return()=>root.unmount();
}
