import test from 'node:test';
import assert from 'node:assert/strict';
import {analyticsAllowed,setAnalyticsPreference,trackEvent,captureLead,mountTrafficPreferences,openAnalyticsPreferences} from '../tracking-client.mjs';
const store=()=>{const map=new Map();return {getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)}};
function setup(){
 globalThis.localStorage=store();globalThis.sessionStorage=store();
 Object.defineProperty(globalThis,'navigator',{value:{globalPrivacyControl:false},configurable:true});
 globalThis.location={pathname:'/travelinginprofit/',search:'?utm_source=class-newsletter&email=private@example.test'};
 globalThis.document={referrer:'https://source.example/path?email=private@example.test'};
 globalThis.window={dispatchEvent:()=>{}};
 const sent=[];globalThis.fetch=async(url,init)=>{const body=JSON.parse(init.body);sent.push({url,body});return Response.json({data:{accepted:true,eventId:body.eventId}})};return sent;
}
test('analytics off by default sends nothing; opt-in shares random ID across both routes; opt-out clears it',async()=>{
 const sent=setup();assert.equal(analyticsAllowed(),false);await trackEvent('page_view');assert.equal(sent.length,0);assert.equal(localStorage.getItem('streamline.visitor.v1'),null);
 setAnalyticsPreference(true);await trackEvent('page_view');location.pathname='/software';await trackEvent('page_view');
 assert.equal(sent[0].body.visitorId,sent.at(-1).body.visitorId);assert.equal(sent.at(-1).body.site,'sootyedge');assert.equal(sent[0].body.referrer,'source.example');assert.deepEqual(sent[0].body.utm,{source:'class-newsletter'});
 assert.ok(!JSON.stringify(sent).includes('private@example.test'));
 const count=sent.length;setAnalyticsPreference(false);await trackEvent('cta_click');assert.equal(sent.length,count);assert.equal(localStorage.getItem('streamline.visitor.v1'),null);
});
test('operational capture does not require analytics and keeps marketing consent separate',async()=>{
 const sent=setup();await captureLead('registration_completed',{name:'Test',email:'test@example.test',consent:true,eventId:'registration_ticket123',metadata:{ticketId:'ticket123'}});
 assert.equal(sent.length,1);assert.equal(sent[0].body.analyticsConsent,false);assert.equal(sent[0].body.visitorId,'registration_ticket123');assert.equal(sent[0].body.utm,undefined);assert.equal(sent[0].body.contact.marketingConsent,false);assert.equal(localStorage.getItem('streamline.visitor.v1'),null);
 await assert.rejects(()=>captureLead('registration_completed',{name:'Test',email:'test@example.test',consent:false}));
});
test('global privacy control disables optional analytics; capture never reports unconfirmed success',async()=>{
 const sent=setup();navigator.globalPrivacyControl=true;setAnalyticsPreference(true);await trackEvent('page_view');assert.equal(sent.length,0);
 globalThis.fetch=async()=>Response.json({data:{accepted:false}},{status:503});
 await assert.rejects(()=>captureLead('lead_magnet_requested',{name:'Test',email:'test@example.test',consent:true}));
});
test('traffic preferences move from the hidden baseline into the hydrated footer and remain available when review mode changes',()=>{
 const elements=[];
 const make=tag=>{const element={tag,dataset:{},children:[],hidden:false,parentElement:null,append(child){if(child.parentElement)child.parentElement.children=child.parentElement.children.filter(item=>item!==child);child.parentElement=this;this.children.push(child)},closest(selector){for(let item=this;item;item=item.parentElement){if(selector==='[hidden]'&&item.hidden)return item;if(selector==='.streamline-privacy-link'&&item.className==='streamline-privacy-link')return item}return null}};elements.push(element);return element};
 const body=make('body'),baseline=make('div'),original=make('footer');body.append(baseline);baseline.append(original);
 const doc={body,createElement:make,querySelectorAll:tag=>elements.filter(item=>item.tag===tag),querySelector:()=>elements.find(item=>Object.hasOwn(item.dataset,'streamlinePrivacy'))};
 mountTrafficPreferences(doc);const control=doc.querySelector(),row=control.parentElement;assert.equal(row.parentElement,original);
 const refined=make('div'),hydrated=make('footer');body.append(refined);refined.append(hydrated);baseline.hidden=true;
 mountTrafficPreferences(doc);assert.equal(row.parentElement,hydrated);assert.equal(control.closest('[hidden]'),null);assert.equal(control.onclick,openAnalyticsPreferences);
 baseline.hidden=false;refined.hidden=true;mountTrafficPreferences(doc);assert.equal(row.parentElement,original);assert.equal(elements.filter(item=>Object.hasOwn(item.dataset,'streamlinePrivacy')).length,1);
});
