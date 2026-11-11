// Layout repair for the vendored React Bits DriftWall. Keep the moving tracks
// anchored to a fixed visible plane, independent of their repeated content.
const radians = degrees => degrees * Math.PI / 180;

export function projectedWallEdge({ x, screenY, scale, tilt, turn, roll, perspective, depth }) {
  const rx = radians(tilt), ry = radians(turn), rz = radians(roll);
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);
  // CSS rotateX · rotateY · rotateZ, with camera depth applied afterwards.
  const xx = cy * cz, xy = -cy * sz;
  const yx = cx * sz + sx * sy * cz, yy = cx * cz - sx * sy * sz;
  const zx = sx * sz - cx * sy * cz, zy = sx * cz + cx * sy * sz;
  const y = (screenY * (perspective + depth) - scale * x * (screenY * zx + perspective * yx)) /
    (scale * (screenY * zy + perspective * yy));
  const projectedX = perspective * scale * (xx * x + xy * y) /
    (perspective + depth - scale * (zx * x + zy * y));
  return { x: projectedX, y };
}

export function fitDriftPlane({ width, height, columns, tileWidth, tileHeight, gap, tilt, turn, roll, perspective, depth, parallax, lift }) {
  const planeWidth = columns * (tileWidth + gap);
  const gutter = Math.min(24, Math.max(12, width * .035));
  const halfAvailable = Math.max(1, width / 2 - gutter);
  const excursion = parallax * 4;
  const views = [-excursion, 0, excursion].flatMap(px => [-excursion, 0, excursion].map(py => ({
    tilt: tilt + py, turn: turn + px, roll, perspective, depth
  })));
  const edges = scale => views.flatMap(view => [-planeWidth / 2, planeWidth / 2].flatMap(x =>
    [-height / 2, height / 2].map(screenY => projectedWallEdge({ ...view, x, screenY, scale }))));
  // Reserve the hover lift as well as the resting edge. The photographed face
  // stays inside the horizontal viewport even at the pointer's farthest tilt.
  const fits = scale => edges(scale).every(point => Math.abs(point.x) + lift * scale * .65 <= halfAvailable);
  let low = .05, high = 1.18;
  for (let i = 0; i < 24; i++) {
    const middle = (low + high) / 2;
    if (fits(middle)) low = middle;
    else high = middle;
  }
  const scale = low;
  const visibleHalfHeight = Math.max(...edges(scale).map(point => Math.abs(point.y)));
  return { planeWidth, planeHeight: Math.ceil(visibleHalfHeight * 2 + (tileHeight + gap) * 2), scale, gutter };
}

export const repeatCountForViewport = (planeHeight, copyHeight) => Math.max(2, Math.ceil(planeHeight / copyHeight) + 1);
export const advanceDriftOffset = (offset, distance, copyHeight) => ((offset + distance) % copyHeight + copyHeight) % copyHeight;
