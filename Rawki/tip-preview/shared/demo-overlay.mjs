import {ACTION_ZONES} from './demo-data.mjs';

// A native Lightweight Charts series primitive keeps regions attached to the scales
// during pan, zoom, resize and high-DPI rendering.
export class DemoOverlay {
  constructor(sample) {
    this.sample=sample;this.layers=new Set();
    this.views=[{zOrder:()=> 'bottom',renderer:()=>({draw:target=>this.draw(target)})}];
  }
  attached({chart,series,requestUpdate}){this.chart=chart;this.series=series;this.requestUpdate=requestUpdate}
  detached(){this.chart=null;this.series=null;this.requestUpdate=null}
  paneViews(){return this.views}
  setLayers(layers){this.layers=new Set(layers);this.requestUpdate?.()}
  draw(target){
    if(!this.chart||!this.series)return;
    target.useMediaCoordinateSpace(({context:ctx,mediaSize})=>{
      const x=index=>this.chart.timeScale().logicalToCoordinate(index);
      const y=price=>this.series.priceToCoordinate(price);
      ctx.save();
      if(this.layers.has('flow')){
        for(let i=1;i<this.sample.flow.length;i++){
          const a=this.sample.flow[i-1],b=this.sample.flow[i];
          const xa=x(i-1),xb=x(i);if(xa==null||xb==null)continue;
          const highA=y(a.upper),highB=y(b.upper),lowA=y(a.lower),lowB=y(b.lower);
          if([highA,highB,lowA,lowB].some(v=>v==null))continue;
          ctx.fillStyle=b.value>=b.slow?'#158e3340':'#be193b38';
          ctx.beginPath();ctx.moveTo(xa,highA);ctx.lineTo(xb+.5,highB);ctx.lineTo(xb+.5,lowB);ctx.lineTo(xa,lowA);ctx.closePath();ctx.fill();
        }
      }
      if(this.layers.has('zones')){
        for(const zone of ACTION_ZONES){
          const start=x(Math.round(zone.start*this.sample.bars.length/120)),end=Math.min(mediaSize.width,x(this.sample.bars.length+5)??mediaSize.width);
          const top=y(zone.top),bottom=y(zone.bottom);if(start==null||top==null||bottom==null)continue;
          ctx.fillStyle=zone.color+'1e';ctx.fillRect(start,top,end-start,bottom-top);
          ctx.strokeStyle=zone.color+'60';ctx.lineWidth=1;ctx.strokeRect(start,top,end-start,bottom-top);
          ctx.fillStyle=zone.color;ctx.font='11px Arial, sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';
          if(end-Math.max(0,start)>100)ctx.fillText(zone.name,Math.max(12,start+12),(top+bottom)/2);
        }
      }
      ctx.restore();
    });
  }
}
