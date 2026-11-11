import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist/client');

test('both experiences have separate built configuration and working nested assets',async()=>{
 for(const [page,title] of [['index.html','SootyEdge'],['travelinginprofit/index.html','Traveling in Profit'],['travelinginprofit/classroom/index.html','The classroom'],['travelinginprofit/privacy/index.html','Privacy']]){
  const html=await fs.readFile(path.join(dist,page),'utf8');
  assert.ok(html.match(/<title>(.*?)<\/title>/s)?.[1].includes(title),page+' title');
  assert.ok(!/https?:\/\/(localhost|127\.0\.0\.1)/.test(html),page+' has no localhost dependency');
  for(const match of html.matchAll(/(?:src|href)=["'](\/[^"'?#]+)(?:[?#][^"']*)?["']/g)){
   const url=match[1];
   if(!/\.(css|png|webp|jpe?g|avif|woff2?|pdf|ico|svg|m?js|mp4|webm|vtt)$/i.test(url))continue;
   await fs.access(path.join(dist,decodeURIComponent(url)));
  }
 }
 const suite=JSON.parse(await fs.readFile(path.join(dist,'review/review-config.json'),'utf8'));
 const funnel=JSON.parse(await fs.readFile(path.join(dist,'travelinginprofit/review/review-config.json'),'utf8'));
 assert.equal(suite.site,'sootyedge');assert.equal(funnel.site,'travelinginprofit');
 assert.equal(suite.sites.find(x=>x.name==='travelinginprofit').url,'/travelinginprofit/');
 assert.equal(funnel.sites.find(x=>x.name==='sootyedge').url,'/');
 await fs.access(path.join(dist,'travelinginprofit/review/funnel-ui.js'));
 await fs.access(path.join(dist,'travelinginprofit/review/funnel-ui.css'));
});

test('nested pages and classroom video serve without the original localhost app',async()=>{
 const server=spawn(process.execPath,['preview.mjs'],{cwd:root,env:{...process.env,PORT:'3119'},stdio:['ignore','pipe','pipe'],windowsHide:true});
 try{
  await Promise.race([once(server.stdout,'data'),once(server,'exit').then(()=>{throw new Error('Preview exited before listening')})]);
  for(const route of ['/','/travelinginprofit/','/travelinginprofit/classroom/','/travelinginprofit/privacy/']){
   const response=await fetch('http://127.0.0.1:3119'+route);
   assert.equal(response.status,200,route);assert.match(response.headers.get('content-type'),/text\/html/);
  }
  const video=await fetch('http://127.0.0.1:3119/travelinginprofit/media/classroom-preview.mp4',{headers:{Range:'bytes=0-127'}});
  assert.equal(video.status,206);assert.equal(video.headers.get('content-type'),'video/mp4');
  assert.equal((await video.arrayBuffer()).byteLength,128);
  const calendar=await fetch('http://127.0.0.1:3119/travelinginprofit/review/calendar.ics');
  assert.equal(calendar.status,200);assert.match(await calendar.text(),/BEGIN:VCALENDAR/);
 }finally{server.kill();await once(server,'exit');}
});

test('returning visitors load one version of the funnel enhancement graph',async()=>{
 const html=await fs.readFile(path.join(dist,'travelinginprofit/index.html'),'utf8');
 const revision=html.match(/review\.([0-9a-f]{12})\.js/)?.[1];
 assert.ok(revision,'the page must request a versioned enhancement entry point');
 assert.ok(html.includes('review.'+revision+'.css'));
 for(const file of ['review.'+revision+'.js','review.'+revision+'.css','funnel-ui.'+revision+'.js']){
  const text=await fs.readFile(path.join(dist,'travelinginprofit/review',file),'utf8');
  for(const match of text.matchAll(/["'](\.\/[^"'\s]+\.(?:css|m?js|json))["']/g)){
   assert.ok(match[1].includes('.'+revision+'.'),match[1]+' must share the page revision');
   await fs.access(path.resolve(dist,'travelinginprofit/review',match[1]));
  }
 }
});
