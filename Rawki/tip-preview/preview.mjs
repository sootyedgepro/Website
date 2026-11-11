import http from 'node:http';
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {relay} from './worker/index.mjs';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'dist/client');
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.woff':'font/woff','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.pdf':'application/pdf'};
Object.assign(mime,{'.mp4':'video/mp4','.webm':'video/webm','.vtt':'text/vtt; charset=utf-8','.ics':'text/calendar; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.avif':'image/avif'});
const port=Number(process.env.PORT||3002);
http.createServer(async(req,res)=>{
 if(req.url.split('?')[0]==='/api/streamline/events'){
  try{
   const chunks=[];let total=0;for await(const chunk of req){total+=chunk.length;if(total>16000){res.writeHead(413);res.end();return}chunks.push(chunk)}
   const request=new Request('http://'+req.headers.host+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
   const response=await relay(request,process.env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());
  }catch{res.writeHead(500);res.end('Request unavailable')}
  return;
 }
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return}
 try{
  let url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(url==='/api/review-config')url='/review/review-config.json';
  let file=path.resolve(root,'.'+url);
  if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);res.end();return}
  if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');
  if(/\.(mp4|webm)$/i.test(file)){
   const stat=await fs.stat(file);let start=0,end=stat.size-1;res.setHeader('Accept-Ranges','bytes');
   if(req.headers.range){
    const range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if(!range||(!range[1]&&!range[2])){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});res.end();return}
    if(range[1]){start=Number(range[1]);end=range[2]?Math.min(Number(range[2]),end):end}else start=Math.max(0,stat.size-Number(range[2]));
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});res.end();return}
    res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${stat.size}`);
   }
   res.setHeader('Content-Length',end-start+1);
   if(req.method==='HEAD'){res.end();return}
   const stream=createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);return;
  }
  res.end(req.method==='HEAD'?undefined:await fs.readFile(file));
 }catch{res.writeHead(404);res.end('Page unavailable')}
}).listen(port,'127.0.0.1',()=>console.log('SootyEdge Sites preview: http://localhost:'+port));
