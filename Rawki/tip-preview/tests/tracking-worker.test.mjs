import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{relay,validateEvent} from '../worker/index.mjs';
import fs from 'node:fs/promises';
const origin='https://sootyedge-interactive-suite.rawki.chatgpt.site';
const env={CRM_COLLECTOR_URL:'https://crm.example/api/collect',CRM_SITES_AUTH:'private-site-token',INGEST_SECRET:'ingest-only-secret'};
const base=()=>({eventId:'event_123456',visitorId:'visitor_123456',sessionId:'session_123456',site:'travelinginprofit',type:'page_view',path:'/travelinginprofit/',timestamp:new Date().toISOString(),analyticsConsent:true});
const request=(body,headers={})=>new Request(origin+'/api/streamline/events',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)});

test('anonymous collection requires analytics consent and cannot attach contacts',()=>{
 assert.throws(()=>validateEvent({...base(),analyticsConsent:false}));
 assert.throws(()=>validateEvent({...base(),contact:{email:'test@example.test'}}));
 assert.throws(()=>validateEvent({...base(),site:'sootyedge'}));
 assert.throws(()=>validateEvent({...base(),path:'/api/private'}));
 const result=validateEvent({...base(),path:'/travelinginprofit/?email=private@example.test',referrer:'https://example.com/path?email=private@example.test',utm:{source:'newsletter',unknown:'private',term:'person@example.test'},metadata:{target:'/offer?email=private@example.test',email:'private@example.test'}});
 assert.equal(result.path,'/travelinginprofit/');assert.equal(result.referrer,'example.com');assert.deepEqual(result.utm,{source:'newsletter'});assert.deepEqual(result.metadata,{target:'/offer'});
});
test('explicit operational consent can save contact without analytics identifiers or attribution',()=>{
 const event={...base(),type:'registration_completed',analyticsConsent:false,contact:{name:'Test Person',email:'TEST@example.test',consent:true,marketingConsent:false},utm:{source:'secret'},referrer:'example.com'};
 const result=validateEvent(event);assert.equal(result.analyticsConsent,false);assert.equal(result.contact.email,'test@example.test');assert.equal(result.contact.marketingConsent,false);assert.equal(result.utm,undefined);assert.equal(result.referrer,undefined);
 assert.throws(()=>validateEvent({...event,contact:{...event.contact,consent:false}}));
 const support=validateEvent({...event,type:'support_requested',metadata:{category:'Setup',message:'Device: Laptop\nIssue: Missing indicator\nAlready tried: Refresh'}});
 assert.match(support.metadata.message,/\nIssue:/);
});
test('relay rejects cross-origin, non-JSON and oversized bodies before calling upstream',async()=>{
 let calls=0;const fetcher=async()=>{calls++;throw new Error('must not call')};
 assert.equal((await relay(request(base(),{Origin:'https://evil.example'}),env,fetcher)).status,403);
 assert.equal((await relay(request(base(),{'Content-Type':'text/plain'}),env,fetcher)).status,415);
 assert.equal((await relay(request('x'.repeat(16001)),env,fetcher)).status,413);
 assert.equal((await relay(request('not json'),env,fetcher)).status,400);
 assert.equal(calls,0);
});
test('upstream accepts confirmed event only, secrets stay exclusively in server headers',async()=>{
 let sent;
 const response=await relay(request(base()),env,async(url,init)=>{sent={url,init};return Response.json({data:{accepted:true,eventId:base().eventId,duplicate:false}})});
 assert.equal(response.status,200);assert.equal(sent.url,env.CRM_COLLECTOR_URL);assert.equal(sent.init.redirect,'manual');
 assert.equal(sent.init.headers.Authorization,'Bearer '+env.INGEST_SECRET);
 assert.equal(sent.init.headers['OAI-Sites-Authorization'],'Bearer '+env.CRM_SITES_AUTH);
 assert.equal(JSON.parse(sent.init.body).analyticsConsent,true);
 const text=await response.text();assert.ok(!text.includes(env.INGEST_SECRET));assert.ok(!text.includes(env.CRM_SITES_AUTH));
 assert.equal((await relay(request(base()),{},async()=>{throw new Error('not reached')})).status,503);
 assert.equal((await relay(request(base()),env,async()=>Response.json({error:env.INGEST_SECRET},{status:401}))).status,502);
 assert.equal((await relay(request(base()),env,async()=>Response.json({data:{accepted:true,eventId:'wrong_id'}}))).status,502);
});
test('Worker preserves asset requests and review config; unknown APIs fail closed',async()=>{
 const requests=[],bindings={ASSETS:{fetch:async req=>{requests.push(req);return new Response('asset')}}};
 for(const path of ['/','/software','/walkthrough','/travelinginprofit/classroom/','/travelinginprofit/media/classroom-preview.mp4'])assert.equal(await (await worker.fetch(new Request(origin+path),bindings)).text(),'asset');
 assert.equal(requests.length,5);
 await worker.fetch(new Request(origin+'/api/review-config'),bindings);assert.equal(new URL(requests[5].url).pathname,'/review/review-config.json');
 assert.equal((await worker.fetch(new Request(origin+'/api/checkout'),bindings)).status,404);
});
test('collector redirects fail closed without following or exposing destination and credentials',async()=>{
 const calls=[];
 const response=await relay(request(base()),env,async(url,init)=>{
  calls.push({url,init});
  assert.equal(init.redirect,'manual');
  return new Response('Do not forward credentials',{status:307,headers:{Location:'https://other.example/private?token='+env.INGEST_SECRET}});
 });
 assert.equal(calls.length,1);assert.equal(calls[0].url,env.CRM_COLLECTOR_URL);assert.equal(response.status,502);
 assert.equal(response.headers.get('Location'),null);
 const text=await response.text();for(const value of ['other.example',env.INGEST_SECRET,env.CRM_SITES_AUTH,'Do not forward credentials'])assert.ok(!text.includes(value));
});
test('relay diagnostics contain only status or sanitized bounded error details',async()=>{
 const messages=[],originalWarn=console.warn;console.warn=(...args)=>messages.push(args);
 try{
  await relay(request(base()),env,async()=>new Response('private upstream response',{status:401}));
  assert.deepEqual(messages[0],['StreamLine relay upstream status',401]);
  const contact={name:'Private Person',email:'private@example.test',consent:true};
  await relay(request({...base(),type:'support_requested',contact,metadata:{message:'Private support content'}}),env,async()=>{throw new TypeError(`Network failure ${env.CRM_COLLECTOR_URL} ${env.INGEST_SECRET} ${env.CRM_SITES_AUTH} Private Person private@example.test Private support content\n{"headers":"secret"}`)});
  const log=JSON.stringify(messages[1]);for(const value of [...Object.values(env),'Private Person','private@example.test','Private support content','secret'])assert.ok(!log.includes(value));
  assert.equal(messages[1][1].name,'TypeError');assert.ok(messages[1][1].message.length<=180);
 }finally{console.warn=originalWarn}
});
test('Worker artifact preserves Site identity and includes both asset trees',async()=>{
 const manifest=JSON.parse(await fs.readFile(new URL('../dist/.openai/hosting.json',import.meta.url)));
 assert.equal(manifest.project_id,'appgprj_6aeec42757648191824f2017fdb3695c');assert.equal(manifest.static,undefined);
 for(const path of ['dist/server/index.js','dist/client/index.html','dist/client/travelinginprofit/index.html','dist/client/tracking/client.js'])await fs.access(new URL('../'+path,import.meta.url));
 const entry=await fs.readFile(new URL('../dist/server/index.js',import.meta.url),'utf8');assert.match(entry,/ASSETS\.fetch/);
});
