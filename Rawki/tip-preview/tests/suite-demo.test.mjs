import {test} from 'node:test';
import assert from 'node:assert/strict';
import {consentAllowed} from '../shared/consent.mjs';
import {sampleMarket,aggregateBars,TUNNEL_LEVELS,ACTION_ZONES,DEMO_STEPS,layersThroughStep} from '../shared/demo-data.mjs';

test('the demo fails closed when its exact preference cookie is absent or blocked',()=>{
  assert.equal(consentAllowed(''),false);
  assert.equal(consentAllowed('analytics=enabled; sooty_demo_consent=off'),false);
  assert.equal(consentAllowed('not_sooty_demo_consent=enabled'),false);
  assert.equal(consentAllowed('other=1; sooty_demo_consent=enabled'),true);
  assert.equal(consentAllowed('sooty_demo_consent=enabled',false),false);
});

test('each guided chapter adds one layer while retaining the earlier layers',()=>{
  assert.deepEqual(layersThroughStep(-1),[]);
  for(let index=0;index<DEMO_STEPS.length;index++){
    assert.deepEqual(layersThroughStep(index),DEMO_STEPS.slice(0,index+1).map(step=>step.id));
  }
});

test('four-hour candles preserve the original open, extrema and final close',()=>{
  const hourly=sampleMarket().bars;
  const grouped=aggregateBars(hourly,4);
  assert.equal(grouped.length,30);
  for(let i=0;i<grouped.length;i++){
    const source=hourly.slice(i*4,i*4+4),bar=grouped[i];
    assert.equal(bar.time,source[0].time);
    assert.equal(bar.open,source[0].open);
    assert.equal(bar.close,source[3].close);
    assert.equal(bar.high,Math.max(...source.map(b=>b.high)));
    assert.equal(bar.low,Math.min(...source.map(b=>b.low)));
  }
  assert.deepEqual(sampleMarket('240').bars,grouped);
  assert.equal(sampleMarket('240').flow.length,grouped.length);
});

test('sample bars and all guide targets stay valid within one fixed weekly map',()=>{
  const {bars,flow,markers}=sampleMarket();
  assert.equal(flow.length,bars.length);
  assert.ok(bars.every((bar,i)=>bar.low<=Math.min(bar.open,bar.close)&&bar.high>=Math.max(bar.open,bar.close)&&(i===0||bar.time-bars[i-1].time===3600)));
  assert.ok(markers.every(marker=>bars.some(bar=>bar.time===marker.time)));
  assert.ok(DEMO_STEPS.every(step=>bars[step.targetIndex]));
  assert.equal(TUNNEL_LEVELS.length,9);
  assert.equal(TUNNEL_LEVELS[4],DEMO_STEPS[2].targetPrice);
  assert.ok(TUNNEL_LEVELS.every((price,i)=>i===0||price<TUNNEL_LEVELS[i-1]));
  assert.ok(ACTION_ZONES.some(zone=>zone.bottom<DEMO_STEPS[1].targetPrice&&zone.top>DEMO_STEPS[1].targetPrice));
});
