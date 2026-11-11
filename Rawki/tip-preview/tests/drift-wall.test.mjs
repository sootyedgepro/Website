import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceDriftOffset, fitDriftPlane, projectedWallEdge, repeatCountForViewport } from '../funnel/shared/vendor/react-bits/drift-wall-layout.mjs';

const options = (width, height) => {
  const narrow = width < 430;
  return { width, height, columns: narrow ? 3 : width < 580 ? 4 : 5, tileWidth: narrow ? 116 : 144,
    tileHeight: narrow ? 177 : 220, gap: 6, tilt: -6, turn: narrow ? -20 : -30,
    roll: 2, perspective: 950, depth: 150, parallax: .7, lift: 32 };
};

test('unequal columns cover the entire visible plane throughout repeated forward and reverse laps', () => {
  for (const [width, height] of [[320,480],[390,480],[540,560],[760,640]]) {
    const settings = options(width,height), layout = fitDriftPlane(settings), unit = settings.tileHeight + settings.gap;
    // 28 photos create unequal columns. Include a one-photo column to cover
    // the short-track failure as well as the production five/six-photo tracks.
    for (const count of [1, 5, 6, 9, 10]) {
      const cycle = count * unit, copies = repeatCountForViewport(layout.planeHeight,cycle);
      for (const speed of [-23.4,18,20.2]) {
        let offset = cycle * .97, crossed = 0;
        for (let frame = 0; frame < 60 * 600; frame++) {
          const before = offset;
          offset = advanceDriftOffset(offset,speed/60,cycle);
          if (Math.abs(offset-before)>cycle/2) crossed++;
          assert.ok(offset>=0 && offset<cycle);
          assert.ok(-offset<=0, 'first repetition begins above the visible plane');
          assert.ok(copies*cycle-offset>=layout.planeHeight, 'last repetition continues below the visible plane');
        }
        assert.ok(crossed>=1,'simulation must exercise a full cycle');
      }
    }
  }
});

test('a modulo wrap preserves the same photograph at a viewport position in either direction', () => {
  const unit = 226, count = 6, cycle = unit*count;
  const imageAt = (offset,y) => Math.floor((y+offset)/unit)%count;
  for (const direction of [-1,1]) {
    const before = direction===1 ? cycle-.1 : .1;
    const distance = direction*.2;
    const wrapped = advanceDriftOffset(before,distance,cycle);
    for (const y of [113,339,565,1017,1469]) {
      // Follow the same visual location with its .2px movement. The repeated
      // image is identical across the reset, rather than an empty last track.
      assert.equal(imageAt(wrapped,y-distance),imageAt(before,y));
    }
  }
});

test('all outer columns fit at desktop and mobile sizes, including the full pointer tilt range', () => {
  for (const [width,height] of [[320,480],[375,480],[430,480],[550,560],[700,640],[830,640]]) {
    const settings=options(width,height), layout=fitDriftPlane(settings);
    for (let px=-2.8;px<=2.8;px+=.7) for (let py=-2.8;py<=2.8;py+=.7) {
      for (const x of [-layout.planeWidth/2,layout.planeWidth/2]) for (const screenY of [-height/2,0,height/2]) {
        const point=projectedWallEdge({...settings,x,screenY,scale:layout.scale,turn:settings.turn+px,tilt:settings.tilt+py});
        assert.ok(Math.abs(point.x)<width/2-layout.gutter,'right and left borders remain inside the viewport');
        assert.ok(Math.abs(point.y)<layout.planeHeight/2,'the projected plane covers both vertical edges');
      }
    }
  }
});

test('camera depth is centered, rather than translating the entire wall sideways as it turns', () => {
  for (const turn of [-30,0,30]) {
    const point=projectedWallEdge({x:0,screenY:0,scale:1,tilt:-6,turn,roll:2,perspective:950,depth:150});
    assert.equal(point.x,0);
    assert.equal(point.y,0);
  }
  const straight=projectedWallEdge({x:200,screenY:100,scale:1,tilt:0,turn:0,roll:0,perspective:950,depth:150});
  assert.ok(Math.abs(straight.x-200*950/1100)<1e-8);
  assert.ok(Math.abs(straight.y-100*1100/950)<1e-8);
});
