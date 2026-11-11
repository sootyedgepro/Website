// Official TradingView widget. Its iframe owns market data and chart tools.
// The sample SootyEdge layers are never rendered over this market chart.
export const TRADINGVIEW_CONFIG = Object.freeze({
 autosize:true,symbol:'FX:XAUUSD',interval:'60',timezone:'Etc/UTC',
 theme:'dark',style:'1',locale:'en',allow_symbol_change:true,
 hide_top_toolbar:false,hide_side_toolbar:false,hide_legend:false,hide_volume:true,
 withdateranges:true,save_image:false,backgroundColor:'rgba(7, 15, 41, 1)',
 gridColor:'rgba(0, 0, 0, 0)',studies:[],compareSymbols:[],watchlist:[],
 calendar:false,details:false,hotlist:false
});
export function mountTradingViewWidget(host,status,allowed){
 if(!allowed())return ()=>{};
 let disposed=false;
 const container=document.createElement('div');container.className='tradingview-widget-container';
 const canvas=document.createElement('div');canvas.className='tradingview-widget-container__widget';
 container.append(canvas);host.replaceChildren(container);
 status.hidden=false;status.textContent='Connecting to TradingView…';
 const fallback=()=>{
  if(disposed||!allowed())return;
  status.hidden=false;status.replaceChildren(document.createTextNode('TradingView is taking longer to load. '));
  const link=document.createElement('a');link.href='https://www.tradingview.com/symbols/XAUUSD/?exchange=FX';link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open the market chart';status.append(link);
 };
 const timeout=setTimeout(fallback,18000);
 const observer=new MutationObserver(()=>{
  const iframe=container.querySelector('iframe');
  if(iframe){iframe.title='TradingView market chart';iframe.addEventListener('load',()=>{if(!disposed&&allowed()){clearTimeout(timeout);status.hidden=true}},{once:true});observer.disconnect()}
 });
 observer.observe(container,{childList:true,subtree:true});
 const script=document.createElement('script');script.src='https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';script.type='text/javascript';script.async=true;script.textContent=JSON.stringify(TRADINGVIEW_CONFIG);script.onerror=fallback;container.append(script);
 return ()=>{disposed=true;clearTimeout(timeout);observer.disconnect();script.onerror=null;host.replaceChildren();status.hidden=true;status.replaceChildren()};
}
