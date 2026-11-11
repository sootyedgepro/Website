const TYPES = new Set(['page_view','cta_click','registration_started','registration_completed','classroom_entered','video_started','video_progress','video_completed','checkout_clicked','lead_magnet_requested','support_requested']);
const OPERATIONAL = new Set(['registration_completed','lead_magnet_requested','support_requested']);
const ID = /^[a-zA-Z0-9_-]{6,100}$/;
const MAX_BYTES = 16000;
const reply = (status, value) => Response.json(value, {status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const short = (value, length=160) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,length) : undefined;

function relayErrorDetails(error,env,event){
  let message=typeof error?.message==='string'?error.message:'Upstream request failed';
  for(const value of [env.INGEST_SECRET,env.CRM_SITES_AUTH,env.CRM_COLLECTOR_URL,event.contact?.email,event.contact?.name,event.metadata?.message]){
    if(typeof value==='string'&&value)message=message.split(value).join('[redacted]');
  }
  message=message.replace(/\{[\s\S]*\}/g,'[redacted body]').replace(/https?:\/\/\S+/gi,'[url]').replace(/[^\s@]+@[^\s@]+/g,'[email]').replace(/(?:OAI-Sites-Authorization|Authorization|Bearer)\s*[:=]?\s*[^\s,;]+/gi,'[redacted header]').replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,180);
  return {name:String(error?.name||'Error').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,40),message};
}

export function validateEvent(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid event');
  if (!TYPES.has(input.type) || !['sootyedge','travelinginprofit'].includes(input.site)) throw new Error('Invalid event type');
  for (const field of ['eventId','visitorId','sessionId']) if (!ID.test(input[field] || '')) throw new Error('Invalid identifier');
  if (typeof input.path !== 'string' || !input.path.startsWith('/') || input.path.startsWith('//')) throw new Error('Invalid path');
  const path = input.path.split(/[?#]/)[0].slice(0,500);
  if (path.startsWith('/api') || (input.site === 'travelinginprofit') !== /^\/travelinginprofit(?:\/|$)/.test(path)) throw new Error('Invalid site path');
  if (!Number.isFinite(Date.parse(input.timestamp))) throw new Error('Invalid timestamp');
  const event = {eventId:input.eventId,visitorId:input.visitorId,sessionId:input.sessionId,site:input.site,type:input.type,path,timestamp:input.timestamp,analyticsConsent:input.analyticsConsent===true};
  const operational = OPERATIONAL.has(input.type);
  if (operational) {
    const c = input.contact;
    if (!c || c.consent !== true || typeof c.name !== 'string' || !c.name.trim() || c.name.length > 100 || typeof c.email !== 'string' || c.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) throw new Error('Contact consent required');
    event.contact = {name:c.name.trim(),email:c.email.trim().toLowerCase(),consent:true,marketingConsent:c.marketingConsent === true};
  } else if (input.analyticsConsent !== true || input.contact) throw new Error('Analytics consent required');
  if (input.analyticsConsent === true) {
    if (input.referrer) {try {event.referrer = new URL(input.referrer.includes('://') ? input.referrer : 'https://'+input.referrer).hostname;} catch {}}
    if (input.utm && typeof input.utm === 'object') {
      event.utm = {};
      for (const key of ['source','medium','campaign','content','term']) {
        const value = short(input.utm[key],120);
        if (value && /^[a-zA-Z0-9 _.,:+/-]{1,120}$/.test(value) && !/@/.test(value)) event.utm[key] = value;
      }
    }
  }
  event.metadata = {};
  for (const key of ['label','target','sessionStart','eventStart','ticketId','form','asset','provider','category','policyVersion','consentAt','legalBasis']) {
    let value = short(input.metadata?.[key]);
    if (value && key === 'target') value = value.split(/[?#]/)[0];
    if (value) event.metadata[key] = value;
  }
  if(input.type==='support_requested'&&typeof input.metadata?.message==='string')event.metadata.message=input.metadata.message.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g,'').slice(0,7500);
  for (const key of ['progress','duration']) {
    const value = input.metadata?.[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 86400) event.metadata[key] = value;
  }
  return event;
}

export async function relay(request, env, fetcher=fetch) {
  const origin = new URL(request.url).origin;
  if (request.method !== 'POST') return reply(405,{error:'Method not allowed'});
  if (request.headers.get('Origin') !== origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') return reply(403,{error:'Same-origin request required'});
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') || '')) return reply(415,{error:'JSON required'});
  if (Number(request.headers.get('Content-Length')) > MAX_BYTES) return reply(413,{error:'Request too large'});
  let event;
  try {
    const reader=request.body?.getReader();if(!reader) return reply(400,{error:'Missing event'});
    const chunks=[];let total=0;
    while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_BYTES){await reader.cancel();return reply(413,{error:'Request too large'})}chunks.push(value)}
    const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
    event=validateEvent(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {return reply(400,{error:'Invalid event or consent'});}
  let collector;
  try {collector=new URL(env.CRM_COLLECTOR_URL);if(collector.protocol!=='https:'||collector.username||collector.password)throw new Error();} catch {return reply(503,{error:'Registration service is unavailable. Please try again shortly.'});}
  if (!env.INGEST_SECRET || !env.CRM_SITES_AUTH) return reply(503,{error:'Registration service is unavailable. Please try again shortly.'});
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
  try {
    const response=await fetcher(collector.href,{method:'POST',redirect:'manual',signal:controller.signal,headers:{'Content-Type':'application/json','Authorization':'Bearer '+env.INGEST_SECRET,'OAI-Sites-Authorization':'Bearer '+env.CRM_SITES_AUTH},body:JSON.stringify(event)});
    if(!response.ok){console.warn('StreamLine relay upstream status',response.status);return reply(response.status===429?429:502,{error:'Your request was not saved. Please try again.'});}
    const result=await response.json();
    if(result?.data?.accepted!==true || result.data.eventId!==event.eventId) return reply(502,{error:'Your request was not confirmed. Please try again.'});
    return reply(200,{data:{accepted:true,duplicate:result.data.duplicate===true,eventId:event.eventId}});
  } catch(error){console.warn('StreamLine relay fetch failed',relayErrorDetails(error,env,event));return reply(502,{error:'Your request was not saved. Please try again.'});}
  finally {clearTimeout(timer);}
}

export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    if(url.pathname==='/api/streamline/events')return relay(request,env);
    if(url.pathname==='/api/review-config') {url.pathname='/review/review-config.json';return env.ASSETS.fetch(new Request(url,request));}
    if(url.pathname.startsWith('/api/'))return reply(404,{error:'Not found'});
    if(!['GET','HEAD'].includes(request.method))return reply(405,{error:'Method not allowed'});
    return env.ASSETS.fetch(request);
  }
};
