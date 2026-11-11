import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {createHash} from 'node:crypto';
const root=path.dirname(fileURLToPath(import.meta.url));
const output=path.resolve(root,'dist');
if(output!==path.join(root,'dist')||!output.startsWith(root+path.sep))throw new Error('Build output must stay inside the project');
// Only generated output is replaced; all original assets remain in public/.
await fs.rm(output,{recursive:true,force:true});
const dist=path.join(output,'client');
await fs.mkdir(dist,{recursive:true});
await fs.cp(path.join(root,'public'),dist,{recursive:true});
await fs.cp(path.join(root,'shared'),path.join(dist,'review'),{recursive:true});
await build({entryPoints:[path.join(root,'shared/ui.jsx')],outfile:path.join(dist,'review/ui.js'),bundle:true,format:'esm',jsx:'automatic',minify:true,legalComments:'linked',define:{'process.env.NODE_ENV':'"production"'}});
const funnelDist=path.join(dist,'travelinginprofit');
await fs.mkdir(funnelDist,{recursive:true});
await fs.cp(path.join(root,'funnel/public'),funnelDist,{recursive:true});
await fs.cp(path.join(root,'funnel/shared'),path.join(funnelDist,'review'),{recursive:true});
await build({entryPoints:[path.join(root,'funnel/shared/funnel-ui.jsx')],outfile:path.join(funnelDist,'review/funnel-ui.js'),bundle:true,format:'esm',jsx:'automatic',minify:true,legalComments:'linked',define:{'process.env.NODE_ENV':'"production"'}});
await fs.mkdir(path.join(dist,'tracking'),{recursive:true});
await build({entryPoints:[path.join(root,'tracking-entry.mjs')],outfile:path.join(dist,'tracking/client.js'),bundle:true,format:'esm',minify:true});
await fs.copyFile(path.join(root,'tracking.css'),path.join(dist,'tracking/client.css'));
await fs.mkdir(path.join(output,'server'),{recursive:true});
await build({entryPoints:[path.join(root,'worker/index.mjs')],outfile:path.join(output,'server/index.js'),bundle:true,format:'esm',platform:'neutral',target:'es2022'});
// Route the CRM subrequest through the public Sites gateway, including its
// service authentication, rather than bypassing same-zone Workers.
await fs.writeFile(path.join(output,'server/wrangler.json'),JSON.stringify({
 main:'index.js',
 compatibility_date:'2026-05-15',
 compatibility_flags:['global_fetch_strictly_public'],
 assets:{directory:'../client',binding:'ASSETS'},
 no_bundle:true
},null,2)+'\n');
await fs.mkdir(path.join(output,'.openai'),{recursive:true});
await fs.copyFile(path.join(root,'.openai/hosting.json'),path.join(output,'.openai/hosting.json'));
async function walk(dir){let files=[];for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);files.push(...entry.isDirectory()?await walk(file):[file])}return files}
const files=await walk(dist);
// Version the complete enhancement graph so returning visitors cannot mix
// a new page with an earlier cached stylesheet or animation bundle.
const previousVersions=files.filter(file=>file.startsWith(path.join(funnelDist,'review')+path.sep)&&/\.[0-9a-f]{12}\.(?:css|m?js|json)$/.test(file));
for(const file of previousVersions)await fs.unlink(file);
const reviewFiles=files.filter(file=>file.startsWith(path.join(funnelDist,'review')+path.sep)&&/\.(?:css|m?js|json)$/.test(file)&&!previousVersions.includes(file)).sort();
const revisionHash=createHash('sha256');
for(const file of reviewFiles){revisionHash.update(path.relative(funnelDist,file));revisionHash.update(await fs.readFile(file));}
const revision=revisionHash.digest('hex').slice(0,12);
const versionedPaths=new Map();
for(const file of reviewFiles){
 const extension=path.extname(file);
 versionedPaths.set(file,file.slice(0,-extension.length)+'.'+revision+extension);
}
function versionReferences(text,from){
 return text.replace(/(["'])([^"'\s]+\.(?:css|m?js|json))\1/g,(original,quote,url)=>{
  if(/^(?:[a-z]+:|\/\/)/i.test(url))return original;
  const target=url.startsWith('/')?path.join(dist,url):path.resolve(path.dirname(from),url);
  const replacement=versionedPaths.get(target);
  if(!replacement)return original;
  const next=url.startsWith('/')?'/'+path.relative(dist,replacement).split(path.sep).join('/'):'./'+path.relative(path.dirname(from),replacement).split(path.sep).join('/');
  return quote+next+quote;
 });
}
for(const file of reviewFiles){
 await fs.writeFile(versionedPaths.get(file),versionReferences(await fs.readFile(file,'utf8'),file));
}
for(const file of files.filter(f=>f.endsWith('.html'))){
 let html=await fs.readFile(file,'utf8');
 html=html.replace('</head>','<link rel="stylesheet" href="/tracking/client.css"/><script type="module" src="/tracking/client.js"></script></head>');
 html=html.replace(/<link[^>]*rel="canonical"[^>]*\/>/g,'');
 if(!file.startsWith(funnelDist+path.sep))html=html.replace(/<title>.*?<\/title>/,'<title>SootyEdge — Owner Preview</title>');
 if(file.startsWith(funnelDist+path.sep))html=versionReferences(html,file);
 await fs.writeFile(file,html);
 for(const match of html.matchAll(/(?:src|href)=["'](\/[^"'?#]+)(?:[?#][^"']*)?["']/g)){
  const url=match[1];if(!/\.(css|png|webp|jpe?g|avif|woff2?|pdf|ico|svg|m?js|mp4|webm|vtt)$/i.test(url))continue;
  await fs.access(path.join(dist,decodeURIComponent(url)));
 }
}
console.log('Built SootyEdge + Traveling in Profit Worker: '+files.filter(f=>f.endsWith('.html')).length+' pages in dist/client, collector relay in dist/server.');
