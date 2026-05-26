// Reactive Dex hero. A noise-displaced icosahedron whose displacement
// amplitude, animation speed, and glow are driven by the conversation state
// passed in via the `state` prop. Lifted from anomalous-matter-hero's shader
// and adapted to embed inside the welcome screen at any size.
//
// State machine (callers pass one of these):
//   idle       — ambient breathing, no input yet
//   typing     — user is composing a message, gentle ripple
//   sending    — message just dispatched, brief energetic burst
//   thinking   — waiting on Anthropic, continuous fast wave
//   responding — text streaming back, rhythmic shimmer

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

// Ripple tuned by feel: idle/typing barely register, and even the active
// states (thinking/responding) stay subtle. `responding` is the most
// visible since that's the moment the ripple is *for* — Dex talking back.
// Bump these very gently if you want more motion; large jumps read as
// "zooming" again.
// Typing now matches idle exactly — the baseline noise wave keeps rolling
// smoothly whether or not the user is composing. Each *character* fires a
// transient pulse instead (see pulseSignal/pulseEnergy below).
const STATE_TARGETS = {
  idle:       { amp: 0.012, speed: 0.18, glow: 0.85 },
  typing:     { amp: 0.012, speed: 0.18, glow: 0.92 }, // amp/speed = idle; glow slightly hotter to read as "listening"
  sending:    { amp: 0.030, speed: 0.35, glow: 1.10 },
  thinking:   { amp: 0.022, speed: 0.40, glow: 0.95 },
  responding: { amp: 0.050, speed: 0.45, glow: 1.10 },
};

// Dex palette — base yellow (#FFD600) for the wireframe surface and a
// brighter hot tint that bleeds through where the noise displacement
// pushes outward.
const DEX_YELLOW = new THREE.Color("#FFD600");
const DEX_HOT    = new THREE.Color("#FFE894");

// Simplex noise function lifted from anomalous-matter-hero's vertex shader.
// Kept as a constant so both the GLSL and a possible CPU mirror stay in sync.
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

const VERTEX_SHADER = /* glsl */ `
  uniform float time;
  uniform float amp;
  uniform float speed;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vDisplacement;

  ${SIMPLEX_GLSL}

  void main() {
    vNormal = normal;
    vPosition = position;
    float n = snoise(position * 1.8 + time * speed);
    float d = n * amp;
    vDisplacement = d;
    vec3 p = position + normal * d;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 color;
  uniform vec3 hotColor;
  uniform float glow;
  uniform float opacityMult;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vDisplacement;

  void main() {
    vec3 n = normalize(vNormal);
    float fresnel = pow(1.0 - max(dot(n, vec3(0.0, 0.0, 1.0)), 0.0), 2.0);
    // Where the noise pushes outward, bias toward the hot tint.
    float hot = clamp(vDisplacement * 5.0 + 0.4, 0.0, 1.0);
    vec3 base = mix(color, hotColor, hot);
    vec3 finalColor = base + base * fresnel * (0.55 * glow);
    // opacityMult is per-layer so the three nested icosahedrons can sit at
    // different alphas while sharing the rest of the lighting uniforms.
    gl_FragColor = vec4(finalColor, opacityMult);
  }
`;

export default function DexReactiveCore({ state = "idle", size = 320, pulseSignal = 0 }) {
  const mountRef = useRef(null);
  // Use a ref for state so we don't have to tear down + rebuild the renderer
  // every time the prop changes. The animation loop reads from the ref.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Per-character pulse. The parent passes a counter that increments on each
  // keystroke; when we see it go up, we inject a transient bump into
  // pulseEnergyRef. The animate loop adds that energy on top of the baseline
  // amp and decays it (~250ms half-life). When the user is just sitting
  // there, pulseEnergy is 0 and the wave is the smooth idle noise.
  const pulseSignalRef = useRef(pulseSignal);
  const pulseEnergyRef = useRef(0);
  useEffect(() => {
    if (pulseSignal > pulseSignalRef.current) {
      // Cap accumulation so spamming the keyboard doesn't snowball into a
      // full-blown ripple wall. Each kick adds ~0.045 to the amp.
      pulseEnergyRef.current = Math.min(pulseEnergyRef.current + 0.045, 0.18);
    }
    pulseSignalRef.current = pulseSignal;
  }, [pulseSignal]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let w = mount.clientWidth || size;
    let h = mount.clientHeight || size;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
    camera.position.z = 3.4;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // Single dense wireframe icosahedron — the layered concept is gone.
    // High polygon count (detail 48) gives the shell its frosted-lattice
    // appeal; the user-added outer glow sprite below provides the external
    // light bleed and the fragment shader's fresnel gives a soft internal
    // highlight. Depth here comes from lighting + glow, not stacked meshes.
    // Detail 32 gives a slightly more airy wireframe than 48 — fewer wires
    // crossing per square pixel reads as "less thick" without losing the
    // frosted-lattice appeal the user wanted to keep.
    const geometry = new THREE.IcosahedronGeometry(1.15, 32);
    const material = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        time:        { value: 0 },
        amp:         { value: STATE_TARGETS.idle.amp },
        speed:       { value: STATE_TARGETS.idle.speed },
        glow:        { value: STATE_TARGETS.idle.glow },
        color:       { value: DEX_YELLOW.clone() },
        hotColor:    { value: DEX_HOT.clone() },
        opacityMult: { value: 0.92 },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      wireframe: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Soft fill light just so the fresnel rim has something to lean on.
    const point = new THREE.PointLight(0xffffff, 1, 100);
    point.position.set(0, 0, 5);
    scene.add(point);

    // --- Outer glow ---------------------------------------------------------
    // The fragment shader's fresnel only brightens the wireframe itself, which
    // reads as an *inner* glow. To make light bleed *outside* the silhouette we
    // render a soft radial sprite behind the orb with additive blending. Its
    // scale + opacity are driven from the same eased `glow` value the shader
    // uses (see the animate loop), so the aura pulses with the conversation.
    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = glowCanvas.height = 256;
    const gctx = glowCanvas.getContext("2d");
    const grad = gctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0.0,  "rgba(255,232,148,0.95)");
    grad.addColorStop(0.16, "rgba(255,214,0,0.55)");
    grad.addColorStop(0.42, "rgba(255,214,0,0.16)");
    grad.addColorStop(1.0,  "rgba(255,214,0,0.0)");
    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, 256, 256);
    const glowTexture = new THREE.CanvasTexture(glowCanvas);
    const glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    const glowSprite = new THREE.Sprite(glowMaterial);
    glowSprite.position.set(0, 0, -0.4); // sit just behind the mesh
    glowSprite.renderOrder = -1;
    scene.add(glowSprite);

    // Animation loop with target-chasing eases for amp/speed/glow so state
    // transitions feel like the orb is *responding*, not snapping.
    let frameId;
    let curAmp   = STATE_TARGETS.idle.amp;
    let curSpeed = STATE_TARGETS.idle.speed;
    let curGlow  = STATE_TARGETS.idle.glow;

    const animate = (t) => {
      const target = STATE_TARGETS[stateRef.current] || STATE_TARGETS.idle;
      // 0.04 ease ~= slower, more elegant settle. Feel free to tune.
      curAmp   += (target.amp   - curAmp)   * 0.04;
      curSpeed += (target.speed - curSpeed) * 0.04;
      curGlow  += (target.glow  - curGlow)  * 0.04;

      // Decay the per-character pulse each frame (~12% off per tick @ 60fps
      // ≈ falls to 10% in ~17 frames / ~280ms). Then add it on top of the
      // eased baseline amp so each keystroke reads as a discrete ripple.
      pulseEnergyRef.current *= 0.88;
      if (pulseEnergyRef.current < 0.001) pulseEnergyRef.current = 0;

      material.uniforms.time.value  = t * 0.0006;
      material.uniforms.amp.value   = curAmp + pulseEnergyRef.current;
      material.uniforms.speed.value = curSpeed;
      material.uniforms.glow.value  = curGlow;

      // Outer aura tracks the eased glow: it swells in scale and opacity as the
      // orb ramps from idle (~0.85) toward its hottest states (~1.18). This is
      // the light that reads *outside* the wireframe; the shader fresnel above
      // only shades the mesh surface itself.
      const gT = Math.max(0, Math.min(1, (curGlow - 0.8) / 0.45));
      glowMaterial.opacity = 0.32 + 0.5 * gT;
      const gS = 2.7 + 0.8 * gT;
      glowSprite.scale.set(gS, gS, 1);

      mesh.rotation.y += 0.0009;
      mesh.rotation.x += 0.0003;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate(0);

    // Respond to size changes (window resize, sidebar opens, etc.)
    const handleResize = () => {
      const w2 = mount.clientWidth || size;
      const h2 = mount.clientHeight || size;
      if (w2 === w && h2 === h) return;
      w = w2; h = h2;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // Light follows cursor across the whole viewport for that subtle parallax
    // shimmer the original anomalous-matter scene had. Cheap, no overhead.
    const handleMouseMove = (e) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -(e.clientY / window.innerHeight) * 2 + 1;
      point.position.set(x * 3, y * 3, 5);
    };
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      glowTexture.dispose();
      glowMaterial.dispose();
      renderer.dispose();
    };
  }, [size]);

  return (
    <div
      ref={mountRef}
      style={{ width: size, height: size }}
      className="dx-reactive-core"
      aria-hidden="true"
    />
  );
}
