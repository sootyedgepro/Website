// Deliberately illustrative data. These are not the private SootyEdge algorithms.
export const LAYER_IDS = Object.freeze(['flow', 'zones', 'tunnels']);
export const TUNNEL_LEVELS = Object.freeze([4214, 4195, 4180, 4166, 4150, 4134, 4120, 4105, 4086]);
export const ACTION_ZONES = Object.freeze([
  Object.freeze({name:'Strong resistance', top:4218, bottom:4207, color:'#bac1ca', start:42}),
  Object.freeze({name:'Sell zone', top:4188, bottom:4179, color:'#dd8c83', start:42}),
  Object.freeze({name:'Buy zone', top:4111, bottom:4101, color:'#8bbba1', start:42}),
  Object.freeze({name:'Strong support', top:4088, bottom:4078, color:'#bac1ca', start:42})
]);
export const DEMO_STEPS = Object.freeze([
  {id:'flow', name:'Flow Tracker', title:'Start with direction.',
    text:'Read trend and momentum together before looking for an entry. The directional lines, cloud, and swing dots put that first question on the chart.',
    instruction:'Follow the colored line. Then compare price with the slower blue reference.',
    targetIndex:87, targetPrice:4135, takeaway:'Direction comes before execution.'},
  {id:'zones', name:'Action Zones', title:'Find the areas that matter.',
    text:'Add the buy and sell areas, then locate the wider support and resistance zones. These are places to reassess your plan as price approaches.',
    instruction:'Look at the shaded buy area. A zone marks context; it is not an instruction to enter.',
    targetIndex:91, targetPrice:4106, takeaway:'An area to evaluate, not a guaranteed reaction.'},
  {id:'tunnels', name:'Tunnel Bands', title:'Put the week in perspective.',
    text:'Bring in the central weekly reference and four levels on either side. The map stays fixed while you move through this example.',
    instruction:'Compare price with the gold reference and its neighboring levels. Use them to prepare scenarios and invalidation.',
    targetIndex:98, targetPrice:4150, takeaway:'Fixed references. Your judgment.'}
]);

export function layersThroughStep(index) {
  return LAYER_IDS.slice(0, Math.max(0, Math.min(3, index + 1)));
}

export function sampleMarket() {
  const anchors=[4165,4187,4176,4120,4142,4170,4152,4130,4107,4116,4140,4130];
  const bars=[]; let prior=4165;
  for(let i=0;i<120;i++) {
    const position=i/119*(anchors.length-1), left=Math.floor(position), fraction=position-left;
    const center=anchors[left]+((anchors[left+1]??anchors[left])-anchors[left])*fraction;
    const close=Number((center+Math.sin(i*1.9)*3.1+Math.cos(i*.67)*1.8).toFixed(2));
    const open=Number((prior+Math.sin(i*.9)*1.2).toFixed(2));
    bars.push({time:Date.UTC(2026,9,12)/1000+i*3600,open,close,
      high:Number((Math.max(open,close)+2.2+Math.abs(Math.sin(i*2.1))*3.8).toFixed(2)),
      low:Number((Math.min(open,close)-2.2-Math.abs(Math.cos(i*1.7))*3.5).toFixed(2))});
    prior=close;
  }
  let fast=bars[0].close,slow=fast;
  const flow=bars.map(bar=>{fast+=(bar.close-fast)*.3;slow+=(bar.close-slow)*.08;
    return {time:bar.time,value:fast,slow,color:fast>=slow?'#7bcfa0':'#ec8f84',upper:slow+10,lower:slow-10};});
  const markers=[];
  for(let i=8;i<bars.length-5;i+=12){const up=bars[i].close>flow[i].slow;markers.push({time:bars[i].time,position:up?'belowBar':'aboveBar',color:up?'#81d9a6':'#ee8a7e',shape:'circle',size:.65})}
  return {bars,flow,markers};
}
