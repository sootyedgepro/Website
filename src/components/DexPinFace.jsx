// DexPinFace — fullscreen "pin art" audio-visualizer background.
//
// A wall of instanced 3D pins (think pin-screen toys / the Cerebro wall)
// covers the whole container. A procedurally generated face heightmap pushes
// the pins outward so Dex's face emerges from the wall, and a shader-driven
// mouth/jaw rig makes the face *talk* while Dex is responding. Everything is
// one draw call: a single InstancedBufferGeometry with a custom shader.
//
// Depth comes from three things working together:
//   1. Baked heightmap normals → directional diffuse + specular, so every
//      feature has a lit side and a shadow side (not just a brightness ramp).
//   2. A resting camera tilt + slow drift + cursor parallax, so pin shafts
//      are always visible and the wall constantly shifts in perspective.
//   3. Terraced height quantization — discrete pin tiers like a real
//      pin-screen, whose edges catch the moving light.
//
// State machine (same vocabulary as the rest of the app):
//   idle       — face rests in the wall, breathing, light sweeps slowly
//   typing     — idle + a ripple ring per keystroke (pulseSignal)
//   sending    — brief energetic shimmer
//   thinking   — face recedes slightly, fast rolling wave (cyan bias)
//   responding — face fully emerges, glows hot, mouth animates (talking)
//   listening  — voice mode: attentive, cyan-tinted shimmer
//   error      — everything dims
//
// Props:
//   state       one of the states above
//   pulseSignal counter — each increment fires a ripple ring (keystrokes)
//   mouthPulse  counter — each increment kicks the mouth (TTS word boundary)
//   paused      stop rendering (e.g. chat face while voice overlay is open)

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

// ── Palette ────────────────────────────────────────────────────────────────
const COL_BASE = new THREE.Color("#0b0f18"); // unlit pin body
const COL_GOLD = new THREE.Color("#FFD600"); // Dex signal gold
const COL_HOT  = new THREE.Color("#FFE894"); // hottest highlights
const COL_CYAN = new THREE.Color("#00D4D4"); // holographic chrome

// Per-state targets, eased toward every frame so transitions glide.
const STATE_TARGETS = {
  idle:       { face: 0.84, noise: 0.13, speed: 0.35, glow: 0.85, cyan: 0.10, talk: 0 },
  typing:     { face: 0.86, noise: 0.14, speed: 0.42, glow: 0.95, cyan: 0.12, talk: 0 },
  sending:    { face: 0.90, noise: 0.22, speed: 1.10, glow: 1.10, cyan: 0.18, talk: 0 },
  thinking:   { face: 0.74, noise: 0.26, speed: 1.60, glow: 1.00, cyan: 0.30, talk: 0 },
  responding: { face: 1.05, noise: 0.13, speed: 0.55, glow: 1.22, cyan: 0.10, talk: 1 },
  listening:  { face: 0.90, noise: 0.16, speed: 0.50, glow: 1.05, cyan: 0.55, talk: 0 },
  error:      { face: 0.52, noise: 0.06, speed: 0.20, glow: 0.50, cyan: 0.05, talk: 0 },
};

// ── Face heightmap ─────────────────────────────────────────────────────────
// All landmarks live in a 256×256 map, y-down (canvas convention). The
// shader gets the same landmarks converted to uv space (y-up) so the mouth
// and blink rigs line up with the painted features exactly.
const MAP = 256;
// [cx, cy, rx, ry, height] — soft elliptical gaussian blobs, additive.
// Negative height carves (eye sockets, lip slit, nostrils).
const FACE_BLOBS = [
  [128, 122, 80, 102, 0.46],   // skull dome
  [128,  76, 62, 46,  0.16],   // forehead
  [104, 103, 26, 10,  0.20],   // brow L
  [152, 103, 26, 10,  0.20],   // brow R
  [103, 117, 16, 10, -0.30],   // eye socket L
  [153, 117, 16, 10, -0.30],   // eye socket R
  [128, 132, 10, 22,  0.18],   // nose bridge
  [128, 154, 13, 11,  0.30],   // nose tip
  [116, 159,  8,  6,  0.12],   // nostril wing L
  [140, 159,  8,  6,  0.12],   // nostril wing R
  [113, 163,  5,  3, -0.12],   // nostril shadow L
  [143, 163,  5,  3, -0.12],   // nostril shadow R
  [ 94, 142, 24, 18,  0.16],   // cheekbone L
  [162, 142, 24, 18,  0.16],   // cheekbone R
  [128, 173, 20,  7,  0.22],   // upper lip
  [128, 179, 18,  3, -0.26],   // lip slit
  [128, 186, 16,  7,  0.24],   // lower lip
  [128, 206, 19, 14,  0.20],   // chin
  [100, 184, 14, 22,  0.08],   // jaw L
  [156, 184, 14, 22,  0.08],   // jaw R
];
// Landmarks the shader needs (uv space, y-up).
const UV_MOUTH_X = 0.5;
const UV_MOUTH_Y = 1 - 179 / MAP; // lip slit
const UV_EYE_DX  = 25 / MAP;      // eye offset from center
const UV_EYE_Y   = 1 - 117 / MAP;

// Slope of the relief used when baking normals: world height of a full-white
// pixel divided by the world size of the face square. Must match
// uHeightScale/uFaceSize in buildGrid (≈0.30) for lighting to look honest.
const RELIEF = 0.30;

function buildFaceTexture() {
  const h = new Float32Array(MAP * MAP);
  for (const [cx, cy, rx, ry, amp] of FACE_BLOBS) {
    const x0 = Math.max(0, Math.floor(cx - rx * 2.4));
    const x1 = Math.min(MAP - 1, Math.ceil(cx + rx * 2.4));
    const y0 = Math.max(0, Math.floor(cy - ry * 2.4));
    const y1 = Math.min(MAP - 1, Math.ceil(cy + ry * 2.4));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        const d2 = dx * dx + dy * dy;
        if (d2 > 5.8) continue;
        h[y * MAP + x] += amp * Math.exp(-d2 * 1.45);
      }
    }
  }
  // Fade hard to zero near the map border so the face melts into the wall.
  for (let y = 0; y < MAP; y++) {
    for (let x = 0; x < MAP; x++) {
      const ex = Math.min(x, MAP - 1 - x) / (MAP * 0.16);
      const ey = Math.min(y, MAP - 1 - y) / (MAP * 0.16);
      const edge = Math.min(1, ex) * Math.min(1, ey);
      h[y * MAP + x] *= edge * edge * (3 - 2 * edge); // smoothstep-ish
    }
  }
  // Normalize to 0..1.
  let max = 0;
  for (let i = 0; i < h.length; i++) max = Math.max(max, h[i]);
  const inv = 1 / (max || 1);
  for (let i = 0; i < h.length; i++) h[i] = Math.max(0, Math.min(1, h[i] * inv));

  // Pack RGBA = [height, normal.x, normal.y, 255]. Normals come from the
  // heightmap gradient (central differences) in *uv space* (y-up — note the
  // sign flip, since the array is y-down and the texture uploads flipY).
  const data = new Uint8Array(MAP * MAP * 4);
  const texel = 1 / MAP;
  for (let y = 0; y < MAP; y++) {
    for (let x = 0; x < MAP; x++) {
      const i = y * MAP + x;
      const xl = h[y * MAP + Math.max(0, x - 1)];
      const xr = h[y * MAP + Math.min(MAP - 1, x + 1)];
      const yu = h[Math.max(0, y - 1) * MAP + x];
      const yd = h[Math.min(MAP - 1, y + 1) * MAP + x];
      // Slopes in world-ish units (height RELIEF over uv distance).
      const sx = ((xr - xl) * RELIEF) / (2 * texel);
      const sy = (-(yd - yu) * RELIEF) / (2 * texel); // y-up flip
      // Surface normal of the relief.
      let nx = -sx, ny = -sy, nz = 1;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= len; ny /= len;
      data[i * 4]     = Math.round(h[i] * 255);
      data[i * 4 + 1] = Math.round((nx * 0.5 + 0.5) * 255);
      data[i * 4 + 2] = Math.round((ny * 0.5 + 0.5) * 255);
      data[i * 4 + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, MAP, MAP, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.flipY = true;
  tex.needsUpdate = true;
  return tex;
}

// ── Shaders ────────────────────────────────────────────────────────────────
const SIMPLEX_GLSL = /* glsl */ `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }
`;

const VERT = /* glsl */ `
  attribute vec2 aOffset;   // pin center, world xy
  attribute vec2 aCell;     // pin position in wall uv (0..1)

  uniform sampler2D uFaceMap;
  uniform float uTime;
  uniform float uFaceAmp;    // face emergence 0..1+
  uniform float uNoiseAmp;   // ambient wave amplitude
  uniform float uNoiseSpeed;
  uniform float uTalk;       // mouth openness 0..~1.2
  uniform float uBlink;      // 0..1
  uniform float uHeightScale;// world units at face==1
  uniform vec2  uFaceOrigin; // world xy of the face square's min corner
  uniform float uFaceSize;   // world side length of the face square
  uniform vec4  uRipple[3];  // (cx, cy, age, strength) in wall uv

  varying vec3 vNormal;      // box-face normal (view space)
  varying vec3 vMapN;        // relief normal from the heightmap (wall space)
  varying float vHeight;     // 0..1-ish composed height
  varying vec2 vCell;
  varying float vFace;       // raw face sample (for highlight shaping)

  ${SIMPLEX_GLSL}

  void main() {
    vCell = aCell;

    // Where does this pin sit on the face map?
    vec2 fUv = (aOffset - uFaceOrigin) / uFaceSize;
    bool onFace = fUv.x > 0.0 && fUv.x < 1.0 && fUv.y > 0.0 && fUv.y < 1.0;

    // Jaw rig: pins below the mouth sample the map slightly *higher* while
    // talking, which reads as the jaw + lower lip dropping. Normals shift
    // with the sample, so lighting follows the moving jaw too.
    float jawMask = onFace ? smoothstep(${(UV_MOUTH_Y + 0.02).toFixed(4)}, ${(UV_MOUTH_Y - 0.10).toFixed(4)}, fUv.y) : 0.0;
    vec2 sUv = fUv + vec2(0.0, jawMask * uTalk * 0.045);
    vec4 mapS = onFace ? texture2D(uFaceMap, clamp(sUv, 0.0, 1.0)) : vec4(0.0, 0.5, 0.5, 1.0);
    float face = mapS.r;
    vFace = face;

    // Relief normal (unpack from the baked gradient).
    vec3 mapN = vec3(mapS.g * 2.0 - 1.0, mapS.b * 2.0 - 1.0, 0.0);
    mapN.z = sqrt(max(1.0 - dot(mapN.xy, mapN.xy), 0.0));
    vMapN = mapN;

    // Terraced pin tiers — quantize the face into discrete steps like a real
    // pin screen. Lighting still uses the smooth normals, so the terraces
    // read as carved levels rather than banding artifacts.
    face = floor(face * 15.0 + 0.5) / 15.0;

    // Mouth cavity: an ellipse that opens with uTalk and carves into the face.
    vec2 mc = vec2(${UV_MOUTH_X.toFixed(4)}, ${UV_MOUTH_Y.toFixed(4)} - 0.030 * uTalk);
    vec2 md = (fUv - mc) / vec2(0.085, 0.014 + 0.065 * uTalk);
    float cavity = onFace ? (1.0 - smoothstep(0.6, 1.0, length(md))) : 0.0;
    face -= cavity * uTalk * (face * 0.85 + 0.10);

    // Blink: recess the eye ellipses.
    vec2 eL = (fUv - vec2(${(0.5 - UV_EYE_DX).toFixed(4)}, ${UV_EYE_Y.toFixed(4)})) / vec2(0.075, 0.045);
    vec2 eR = (fUv - vec2(${(0.5 + UV_EYE_DX).toFixed(4)}, ${UV_EYE_Y.toFixed(4)})) / vec2(0.075, 0.045);
    float eyeMask = max(1.0 - smoothstep(0.5, 1.0, length(eL)),
                        1.0 - smoothstep(0.5, 1.0, length(eR)));
    face -= eyeMask * uBlink * 0.30;

    // Ambient rolling wave across the whole wall.
    float n = snoise(vec3(aCell * 5.5, uTime * uNoiseSpeed)) * 0.5
            + snoise(vec3(aCell * 13.0, uTime * uNoiseSpeed * 1.7)) * 0.22;

    // Keystroke ripple rings.
    float ripple = 0.0;
    for (int i = 0; i < 3; i++) {
      vec4 r = uRipple[i];
      if (r.w > 0.001) {
        float d = distance(aCell, r.xy);
        float ring = exp(-pow((d - r.z * 0.55) * 16.0, 2.0));
        ripple += ring * r.w * exp(-r.z * 2.4);
      }
    }

    // Compose height (world units).
    float h = 0.045
            + max(face, 0.0) * uFaceAmp * uHeightScale
            + n * uNoiseAmp * uHeightScale * 0.5
            + ripple * 0.26;
    h = max(h, 0.02);
    vHeight = h / max(uHeightScale, 0.0001);

    // Stretch the unit box (z in -0.5..0.5) from the wall plane to height h.
    vec3 p = position;
    vec3 world = vec3(aOffset + p.xy, (p.z + 0.5) * h);
    vNormal = normalMatrix * normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform float uGlow;
  uniform float uCyan;
  uniform vec3 uLightDir;   // normalized, wall space
  uniform vec3 uColBase;
  uniform vec3 uColGold;
  uniform vec3 uColHot;
  uniform vec3 uColCyan;

  varying vec3 vNormal;
  varying vec3 vMapN;
  varying float vHeight;
  varying vec2 vCell;
  varying float vFace;

  void main() {
    vec3 boxN = normalize(vNormal);
    float front = clamp(boxN.z, 0.0, 1.0);       // tip of the pin
    float side  = 1.0 - front;                    // shaft of the pin
    vec3 L = normalize(uLightDir);

    // ── Relief lighting (the actual depth read) ──
    vec3 N = normalize(vMapN);
    float diffuse = max(dot(N, L), 0.0);
    // Specular glint toward the viewer — pins flash as the light sweeps.
    vec3 R = reflect(-L, N);
    float spec = pow(max(R.z, 0.0), 18.0);
    // Slopes facing away from the light fall into shadow.
    float shade = 0.22 + 0.78 * diffuse;

    // Height ramp still feeds the color choice: taller pins run hotter.
    float t = clamp(vHeight * 1.15, 0.0, 1.0);
    vec3 highlight = mix(uColGold, uColHot, smoothstep(0.55, 1.0, t + vFace * 0.25));
    highlight = mix(highlight, uColCyan, uCyan);

    // Front faces: lit relief. Sides: dark shafts lit by the same light
    // through their own box normal, with a cyan chrome wash.
    vec3 frontCol = mix(uColBase, highlight, pow(t, 1.5) * 0.95) * shade
                  + highlight * spec * 0.85
                  + uColCyan * pow(1.0 - N.z, 2.0) * 0.18; // rim on steep slopes
    float sideLit = 0.25 + 0.75 * max(dot(boxN, L), 0.0);
    vec3 sideCol = (mix(uColBase * 0.5, uColCyan * 0.55, pow(t, 2.0) * 0.6)
                  + highlight * 0.10 * t) * sideLit;
    sideCol *= 0.30 + 0.70 * t; // shafts brighten toward their tips

    vec3 col = frontCol * front + sideCol * side;

    // Vignette so the wall melts into the page edges.
    float vd = distance(vCell, vec2(0.5));
    col *= smoothstep(0.98, 0.42, vd) * 0.85 + 0.15;

    col *= uGlow;
    gl_FragColor = vec4(col, 1.0);
  }
`;

// ── Component ──────────────────────────────────────────────────────────────
export default function DexPinFace({
  state = "idle",
  pulseSignal = 0,
  mouthPulse = 0,
  paused = false,
}) {
  const mountRef = useRef(null);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  const pausedRef = useRef(paused);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // Keystroke ripples: consume increments of pulseSignal.
  const pulseRef = useRef(pulseSignal);
  const rippleQueueRef = useRef(0);
  useEffect(() => {
    if (pulseSignal > pulseRef.current) rippleQueueRef.current += 1;
    pulseRef.current = pulseSignal;
  }, [pulseSignal]);

  // Mouth kicks (TTS word boundaries).
  const mouthSigRef = useRef(mouthPulse);
  const mouthKickRef = useRef(0);
  useEffect(() => {
    if (mouthPulse > mouthSigRef.current) {
      mouthKickRef.current = Math.min(mouthKickRef.current + 0.55, 1.2);
    }
    mouthSigRef.current = mouthPulse;
  }, [mouthPulse]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let w = mount.clientWidth || 640;
    let h = mount.clientHeight || 480;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 60);
    const CAM_DIST = 9;
    camera.position.z = CAM_DIST;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    mount.appendChild(renderer.domElement);

    const faceTex = buildFaceTexture();

    const uniforms = {
      uFaceMap:     { value: faceTex },
      uTime:        { value: 0 },
      uFaceAmp:     { value: STATE_TARGETS.idle.face },
      uNoiseAmp:    { value: STATE_TARGETS.idle.noise },
      uNoiseSpeed:  { value: STATE_TARGETS.idle.speed },
      uTalk:        { value: 0 },
      uBlink:       { value: 0 },
      uGlow:        { value: STATE_TARGETS.idle.glow },
      uCyan:        { value: STATE_TARGETS.idle.cyan },
      uLightDir:    { value: new THREE.Vector3(0.5, 0.6, 1).normalize() },
      uHeightScale: { value: 1.55 },
      uFaceOrigin:  { value: new THREE.Vector2(-2, -2) },
      uFaceSize:    { value: 4 },
      uRipple:      { value: [
        new THREE.Vector4(0, 0, 99, 0),
        new THREE.Vector4(0, 0, 99, 0),
        new THREE.Vector4(0, 0, 99, 0),
      ] },
      uColBase: { value: COL_BASE },
      uColGold: { value: COL_GOLD },
      uColHot:  { value: COL_HOT },
      uColCyan: { value: COL_CYAN },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
    });

    const group = new THREE.Group();
    scene.add(group);

    let mesh = null;
    let geometry = null;
    let cols = 0, rows = 0;

    // Build (or rebuild) the instanced pin grid. Overscan well past the
    // frustum so the resting tilt + drift + parallax never expose an edge.
    const buildGrid = () => {
      const aspect = w / h;
      const visH = 2 * CAM_DIST * Math.tan((camera.fov * Math.PI) / 360) * 1.18;
      const visW = visH * aspect;
      const targetCols = w < 560 ? 96 : 132;
      const pin = visW / targetCols;
      const nCols = targetCols;
      const nRows = Math.ceil(visH / pin);

      if (!mesh || nCols !== cols || nRows !== rows) {
        cols = nCols; rows = nRows;
        if (mesh) {
          group.remove(mesh);
          geometry.dispose();
        }
        const box = new THREE.BoxGeometry(pin * 0.84, pin * 0.84, 1);
        geometry = new THREE.InstancedBufferGeometry();
        geometry.index = box.index;
        geometry.attributes.position = box.attributes.position;
        geometry.attributes.normal = box.attributes.normal;

        const count = cols * rows;
        const offsets = new Float32Array(count * 2);
        const cells = new Float32Array(count * 2);
        let i = 0;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            offsets[i * 2]     = (c + 0.5 - cols / 2) * pin;
            offsets[i * 2 + 1] = (r + 0.5 - rows / 2) * pin;
            cells[i * 2]     = (c + 0.5) / cols;
            cells[i * 2 + 1] = (r + 0.5) / rows;
            i++;
          }
        }
        geometry.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offsets, 2));
        geometry.setAttribute("aCell", new THREE.InstancedBufferAttribute(cells, 2));
        geometry.instanceCount = count;

        mesh = new THREE.Mesh(geometry, material);
        mesh.frustumCulled = false;
        group.add(mesh);
      }

      // The face occupies a centered square sized to the smaller *visible*
      // extent (pre-overscan), nudged upward so the mouth/chin clear the
      // composer and caption UI hugging the bottom of the viewport.
      const worldW = visW / 1.18;
      const worldH = visH / 1.18;
      const faceSize = Math.min(worldW, worldH) * 1.02;
      uniforms.uFaceSize.value = faceSize;
      uniforms.uFaceOrigin.value.set(-faceSize / 2, -faceSize / 2 + worldH * 0.06);
      // Keep in sync with RELIEF (≈0.30) so baked normals match real slopes.
      uniforms.uHeightScale.value = faceSize * 0.30;
    };
    buildGrid();

    // ── Animation state (plain refs, no React re-renders) ──
    let frameId;
    let cur = { ...STATE_TARGETS.idle, talk: 0 };
    let talkEase = 0;
    let uTalkSm = 0;
    let blinkAt = performance.now() + 2200 + Math.random() * 3000;
    let blinkStart = -1;
    const ripples = uniforms.uRipple.value;
    let nextRipple = 0;
    let px = 0, py = 0, tx = 0, ty = 0;
    let last = performance.now();

    const onMouseMove = (e) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", onMouseMove);

    const animate = (now) => {
      frameId = requestAnimationFrame(animate);
      if (pausedRef.current) { last = now; return; }
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = now * 0.001;

      const target = STATE_TARGETS[stateRef.current] || STATE_TARGETS.idle;
      const E = 1 - Math.pow(0.94, dt * 60); // framerate-independent ease
      cur.face  += (target.face  - cur.face)  * E;
      cur.noise += (target.noise - cur.noise) * E;
      cur.speed += (target.speed - cur.speed) * E;
      cur.glow  += (target.glow  - cur.glow)  * E;
      cur.cyan  += (target.cyan  - cur.cyan)  * E;
      talkEase  += (target.talk  - talkEase)  * E * 1.6;

      // Mouth: syllable oscillator while talking + word-boundary kicks.
      mouthKickRef.current *= Math.pow(0.86, dt * 60);
      const syll = Math.max(0, Math.sin(t * 24.0)) * (0.62 + 0.38 * Math.sin(t * 6.3 + 1.7));
      const mouthRaw =
        talkEase * (0.16 + 0.84 * syll) + mouthKickRef.current * 0.35;
      uTalkSm += (Math.min(mouthRaw, 1.25) - uTalkSm) * (1 - Math.pow(0.7, dt * 60));

      // Blink scheduler.
      let blink = 0;
      if (blinkStart < 0 && now >= blinkAt) blinkStart = now;
      if (blinkStart >= 0) {
        const ph = (now - blinkStart) / 150;
        if (ph >= 1) {
          blinkStart = -1;
          blinkAt = now + 2200 + Math.random() * 3600;
        } else {
          blink = Math.sin(ph * Math.PI);
        }
      }

      // Ripples: spawn queued keystroke rings from the bottom center (the
      // composer), then age them out.
      while (rippleQueueRef.current > 0) {
        rippleQueueRef.current -= 1;
        const r = ripples[nextRipple];
        r.set(0.5, 0.04, 0, 0.9);
        nextRipple = (nextRipple + 1) % ripples.length;
      }
      for (const r of ripples) {
        if (r.w > 0.001) {
          r.z += dt * 1.35;        // age
          if (r.z > 2.2) r.w = 0;  // expired
        }
      }

      // Breathing: the face swells and settles ~every 8 seconds, a touch
      // faster and deeper while thinking.
      const breath = 1 + 0.045 * Math.sin(t * 0.78) + 0.015 * Math.sin(t * 1.31 + 2.0);

      uniforms.uTime.value = t;
      uniforms.uFaceAmp.value = cur.face * breath;
      uniforms.uNoiseAmp.value = cur.noise;
      uniforms.uNoiseSpeed.value = cur.speed;
      uniforms.uGlow.value = cur.glow;
      uniforms.uCyan.value = cur.cyan;
      uniforms.uTalk.value = uTalkSm;
      uniforms.uBlink.value = blink;

      // Sweeping key light: drifts on its own and leans toward the cursor,
      // so the relief is always shifting between lit and shadowed slopes.
      px += (tx - px) * E;
      py += (ty - py) * E;
      const az = 0.55 * Math.sin(t * 0.21) + px * 0.9;
      const el = 0.55 + 0.18 * Math.sin(t * 0.13) + py * 0.35;
      uniforms.uLightDir.value
        .set(Math.sin(az), Math.sin(el), Math.cos(az) * Math.cos(el))
        .normalize();

      // Resting tilt + slow drift + cursor parallax. The baseline tilt keeps
      // pin shafts visible (head-on, extrusion is invisible at the center).
      group.rotation.y = 0.10 + 0.05 * Math.sin(t * 0.23) + px * 0.10;
      group.rotation.x = -0.07 + 0.04 * Math.sin(t * 0.31) - py * 0.07;

      renderer.render(scene, camera);
    };
    frameId = requestAnimationFrame(animate);

    const onResize = () => {
      const w2 = mount.clientWidth;
      const h2 = mount.clientHeight;
      if (!w2 || !h2 || (w2 === w && h2 === h)) return;
      w = w2; h = h2;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      buildGrid();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(frameId);
      ro.disconnect();
      window.removeEventListener("mousemove", onMouseMove);
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      if (geometry) geometry.dispose();
      material.dispose();
      faceTex.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="dx-pinface"
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}
    />
  );
}
