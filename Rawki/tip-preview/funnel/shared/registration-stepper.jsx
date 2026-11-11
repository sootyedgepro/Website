import React, {useEffect, useId, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import Stepper, {Step} from './vendor/react-bits/Stepper.jsx';
import {CLASS_EVENT,eventTime,validEmail} from './models.mjs';
import {availableTicketEvents} from './registration-storage.mjs';
import {useTicketRegistration,editTicketDetails,setTicketStep,setTicketEvent,
  preparePersonalTicket,tearPersonalTicket,configureRegistrationDelivery} from './registration-ticket.jsx';
import './registration-stepper.css';

function RegistrationStepper({getScenario}){
  const id=useId(),root=useRef(null),pendingCompletionFocus=useRef(false);
  const values=useTicketRegistration(),{step,event,torn}=values;
  const [dates,setDates]=useState(()=>availableTicketEvents());
  const [error,setError]=useState('');

  useEffect(()=>{
    if(step!==3)return;
    const refresh=()=>{if(!document.hidden)setDates(availableTicketEvents())};
    refresh();
    document.addEventListener('visibilitychange',refresh);
    return()=>document.removeEventListener('visibilitychange',refresh);
  },[step]);

  useEffect(()=>{
    const reserve=root.current?.closest('#reserve');
    const dialog=root.current?.closest('dialog');
    if(torn&&dialog?.open){
      dialog.close();
      const destination=document.querySelector('#reserve');
      const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      destination?.scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'});
      if(pendingCompletionFocus.current){
        pendingCompletionFocus.current=false;
        const focusTimer=setTimeout(()=>destination?.querySelector('.tip-ticket-keepsake a')?.focus({preventScroll:true}),450);
        return()=>clearTimeout(focusTimer);
      }
    }
    if(!reserve)return;
    const card=root.current.closest('.registration-card'),layout=reserve.querySelector('.registration-inner');
    reserve.toggleAttribute('data-ticket-complete',torn);
    layout?.classList.toggle('is-ticket-complete',torn);
    if(!card)return;
    let timer;
    if(torn){
      // The footer button is removed as soon as the ticket completes. Capture
      // the activation intent rather than checking focus after it has vanished.
      const transferFocus=pendingCompletionFocus.current||card.contains(document.activeElement);
      pendingCompletionFocus.current=false;
      card.dataset.state='leaving';
      timer=setTimeout(()=>{card.hidden=true;if(transferFocus)reserve.querySelector('.tip-ticket-keepsake a')?.focus({preventScroll:true})},450);
    }else{card.hidden=false;delete card.dataset.state}
    return()=>clearTimeout(timer);
  },[torn]);

  const change=(key,value)=>{editTicketDetails({[key]:value});setError('')};
  function validate(){
    const fields=[...root.current.querySelectorAll('.stepper__pane:not(.stepper__pane--leaving) input[required]')];
    const invalid=fields.find(field=>!field.checkValidity());
    if(!values.firstName.trim()||!validEmail(values.email)||!values.consent||invalid){
      setError('Enter your first name and a valid email, then accept the event contact notice.');
      invalid?.reportValidity();invalid?.focus();return false;
    }
    setError('');return true;
  }
  function next(click){
    if(step===2&&!validate())click.preventDefault();
    if(step===3){
      click.preventDefault();
      if(!event){setError('Choose a class date to add it to your ticket.');root.current.querySelector('input[type=radio]')?.focus();return}
      if(getScenario()==='failure'){setError('Your ticket could not be prepared. Your details are still here; please try again.');return}
      if(!preparePersonalTicket())setError('Check your details and class date before continuing.');
      else setError('');
    }
    if(step===4){
      click.preventDefault();
      pendingCompletionFocus.current=true;
      if(!tearPersonalTicket()){
        pendingCompletionFocus.current=false;
        setError('Please check your details and class date before collecting your stub.');
      }
    }
  }
  const notices=values.disclosures.length?values.disclosures:[
    {text:'Set aside 55 minutes for trend context, key areas, and the preparation behind each decision.'},
    {text:'Optional SootyEdge software and private instruction will be presented. You do not have to buy anything to attend.',offer:true}
  ];
  return <div className="tip-registration-stepper" ref={root} onKeyDown={key=>{
    if(key.key==='Enter'&&key.target.matches('input:not([type=checkbox]):not([type=radio])')){key.preventDefault();if(step===2&&validate())setTicketStep(3)}
  }}>
    <Stepper step={step} onStepChange={nextStep=>{setError('');setTicketStep(nextStep)}}
      indicator="bars" theme="dark" accentColor="#a0e8e9" frame={false} radius={14} width="100%"
      style={{'--stepper-ink':'#e0f5fa','--stepper-muted':'#7c9dac','--stepper-faint':'#517282','--stepper-well':'#061724','--stepper-track':'#6d9baa38','--stepper-tile':'linear-gradient(140deg,#19384b,#122e40)','--stepper-tile-edge':'#71d7e22a','--stepper-tile-highlight':'#c3f8ff12','--stepper-ring':'#91e9ef','--stepper-solid-ink':'#072733'}}
      disableStepIndicators transition="fade" showFooter={!torn}
      nextButtonText={step===1?'Get my ticket':step===2?'Choose a date':'Continue'}
      completeButtonText={values.saving?'Saving…':'Collect my stub'} nextButtonProps={{onClick:next,disabled:values.saving}}>
      <Step title="Welcome">
        <p className="tip-step-eyebrow">TRAVELING IN PROFIT WITH ZI MORRIS</p>
        <h3 className="tip-step-welcome-title">Save your<br/>free seat.</h3>
        <p className="tip-step-intro">See the decisions behind the chart. Ask Zi live.</p>
        <div className="tip-step-benefit"><span aria-hidden="true">✦</span><p>Free private Inner Circle community access is included with your registration.</p></div>
      </Step>
      <Step title="Your details">
        <p className="tip-step-caption">02 / YOUR DETAILS</p>
        <h4>Make the ticket yours.</h4>
        <div className="tip-step-fields">
          <label htmlFor={id+'-name'}>First name<input id={id+'-name'} name="firstName" autoComplete="given-name" maxLength={80} required value={values.firstName} onChange={e=>change('firstName',e.target.value)} placeholder="Your first name"/></label>
          <label htmlFor={id+'-email'}>Email address<input id={id+'-email'} name="email" type="email" autoComplete="email" maxLength={254} required value={values.email} onChange={e=>change('email',e.target.value)} placeholder="you@example.com"/></label>
        </div>
        <label className="tip-step-check"><input type="checkbox" name="consent" required checked={values.consent} onChange={e=>change('consent',e.target.checked)}/><span>I agree to the <a href="/travelinginprofit/privacy/">privacy notice</a> and event-related contact about this class.</span></label>
        <label className="tip-step-check"><input type="checkbox" name="weeklyInvitations" checked={values.weeklyInvitations} onChange={e=>change('weeklyInvitations',e.target.checked)}/><span>Invite me to future classes, too. <small>Optional</small></span></label>
      </Step>
      <Step title="Choose your class">
        <p className="tip-step-caption">03 / YOUR CLASS</p>
        <h4>Make time for your next step.</h4>
        <p className="tip-step-intro tip-step-intro--small">55 minutes with Zi. Choose your Saturday.</p>
        <fieldset className="tip-step-dates"><legend className="sr-only">Available class dates, Eastern time</legend>{dates.map(date=><label className="tip-step-date-option" key={date.startsAt}>
          <input type="radio" name={id+'-class-date'} checked={event?.startsAt===date.startsAt} onChange={()=>{setTicketEvent(date);setError('')}}/>
          <span><strong>{new Intl.DateTimeFormat('en-US',{timeZone:date.timeZone,weekday:'short',month:'short',day:'numeric',year:'numeric'}).format(new Date(date.startsAt))}</strong><small>{eventTime(date,date.timeZone)} · Online</small></span>
          <span className="tip-date-check" aria-hidden="true">✓</span>
        </label>)}</fieldset>
      </Step>
      <Step title="Tear & save">
        <p className="tip-step-caption">04 / YOUR PERSONAL TICKET</p>
        <h4>Now collect your stub and we'll see you in class!</h4>
        <p className="tip-step-tear-copy">Tear off your stub and hold on to it.<span>Your personal ticket and calendar reminder are ready to save.</span></p>
        <div className="tip-step-disclosures">{notices.map((notice,index)=><p key={index} className={notice.offer?'is-offer':undefined}>{notice.text}</p>)}</div>
      </Step>
    </Stepper>
    {!torn&&(error||values.error)&&<p className="tip-step-error" role="alert">{error||values.error}</p>}
  </div>;
}

// Email delivery remains optional; the ticket works without a configured provider.
export function mountRegistrationSteppers({getEvent=()=>CLASS_EVENT,getScenario=()=> 'success',deliveryAdapter}={}){
  if(deliveryAdapter!==undefined)configureRegistrationDelivery(deliveryAdapter);
  const disposers=[];
  document.querySelectorAll('.registration-form').forEach(form=>{
    const host=document.createElement('div');host.className='registration-stepper-mount';form.replaceWith(host);
    const parent=host.parentElement;
    const hiddenSiblings=[...parent.children].filter(element=>element!==host&&element.matches('p,h2,h3,.registration-community-benefit,.form-help'))
      .map(element=>({element,hidden:element.hidden}));
    hiddenSiblings.forEach(({element})=>{element.hidden=true});
    parent.setAttribute('data-compact-stepper','');
    const root=createRoot(host);flushSync(()=>root.render(<RegistrationStepper getScenario={getScenario}/>));
    disposers.push(()=>{root.unmount();host.replaceWith(form);hiddenSiblings.forEach(({element,hidden})=>{element.hidden=hidden});parent.removeAttribute('data-compact-stepper')});
  });
  return()=>disposers.forEach(dispose=>dispose());
}
