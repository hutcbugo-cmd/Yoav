// NailPainting: a 3D fingertip pops in with a bounce, a polish brush paints the nail in three
// strokes (centre, left, right), then a glossy reflection sweeps across and sparkles finish it.
// Real-time 3D (three.js, physically based materials + studio environment reflections).
// params: color (polish), skin, duration scale `speed`, `exit` (true: shrinks away at the end)
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { seg, lerp, clamp, easeOutBack, easeInBack, easeOutCubic, easeInOutCubic, easeInOutSine,
         sparkle } from "./ease.js";

let S;  // scene state

const NAIL_W = 0.64;       // half width of the nail plate
const NAIL_Y0 = 0.95;      // cuticle
const NAIL_Y1 = 2.62;      // free edge (past the fingertip)
const FINGER_R = 1.0;

// half-width of the nail outline at v (0 = cuticle, 1 = tip): rounded cuticle, oval tip
function halfWidth(v) {
  if (v < 0.16) return NAIL_W * Math.pow(1 - Math.pow((0.16 - v) / 0.16, 2.6), 1 / 2.6);
  if (v > 0.7) return NAIL_W * Math.pow(Math.max(0, 1 - Math.pow((v - 0.7) / 0.3, 2.2)), 1 / 2.2);
  return NAIL_W;
}

// nail surface point for (u, v): wraps the finger's curvature, rises slightly toward the tip
function nailPoint(u, v, lift = 0) {
  const x = (u * 2 - 1) * halfWidth(v);
  const y = lerp(NAIL_Y0, NAIL_Y1, v);
  const r = FINGER_R + 0.05 + lift;
  const z = Math.sqrt(Math.max(0, r * r - x * x)) + 0.06 * v - 0.05 * (1 - v) * (1 - v);
  return new THREE.Vector3(x, y, z);
}

// three strokes like a manicurist: centre, then the left and right sides
const STROKES = [
  { t0: 0.95, t1: 1.42, u: 0.5, w: 0.42 },
  { t0: 1.62, t1: 2.02, u: 0.22, w: 0.4 },
  { t0: 2.2, t1: 2.6, u: 0.78, w: 0.4 },
];

function paintTexture(t) {
  const { ctx, tex, color } = S;
  const N = 512;
  // natural nail: pink plate, pale lunula at the cuticle, white free edge
  const g = ctx.createLinearGradient(0, 0, 0, N);
  g.addColorStop(0, "#f3d2ca"); g.addColorStop(0.2, "#eaa99f"); g.addColorStop(0.72, "#e8a196");
  g.addColorStop(0.76, "#fbf3ee"); g.addColorStop(1, "#fffaf6");
  ctx.fillStyle = g; ctx.fillRect(0, 0, N, N);
  ctx.fillStyle = "rgba(255,245,240,0.55)";
  ctx.beginPath(); ctx.ellipse(N / 2, 0, N * 0.36, N * 0.17, 0, 0, Math.PI * 2); ctx.fill();
  // polish: each stroke is a band from the cuticle to where the brush is now
  for (const s of STROKES) {
    const p = easeInOutSine(seg(t, s.t0, s.t1));
    if (p <= 0) continue;
    const y0 = N * 0.035, y1 = N * Math.min(1, 0.035 + p * 0.99);
    const x = N * s.u, hw = (N * s.w) / 2;
    const pg = ctx.createLinearGradient(x - hw, 0, x + hw, 0);
    pg.addColorStop(0, color + "00"); pg.addColorStop(0.12, color); pg.addColorStop(0.88, color);
    pg.addColorStop(1, color + "00");
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.roundRect(x - hw, y0, hw * 2, y1 - y0, [hw * 0.9, hw * 0.9, hw * 0.4, hw * 0.4]);
    ctx.fill();
    if (p < 1) {  // wet bead of polish at the brush tip
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(x, y1, hw * 0.8, N * 0.03, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  // once all three strokes are down, flood to an even coat (no stripes at the seams)
  const even = seg(t, 2.55, 2.8);
  if (even > 0) {
    ctx.globalAlpha = even; ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(N * 0.02, N * 0.03, N * 0.96, N * 0.97, N * 0.25); ctx.fill();
    ctx.globalAlpha = 1;
  }
  tex.needsUpdate = true;
}

function brushPose(t) {
  // returns {pos (bristle tip), visible}; between strokes the brush lifts and travels in an arc
  const enter0 = 0.5, enter1 = 0.95, exit0 = 2.62, exit1 = 3.05;
  const offscreen = new THREE.Vector3(3.4, 4.4, 2.4);
  const start = (s) => nailPoint(s.u, 0.04, 0.02);
  const end = (s) => nailPoint(s.u, 1.0, 0.02);
  if (t < enter0) return { pos: offscreen, visible: false };
  if (t < enter1) {
    const k = easeOutCubic(seg(t, enter0, enter1));
    return { pos: offscreen.clone().lerp(start(STROKES[0]), k), visible: true };
  }
  for (let i = 0; i < STROKES.length; i++) {
    const s = STROKES[i];
    if (t < s.t1) {
      const k = easeInOutSine(seg(t, s.t0, s.t1));
      return { pos: nailPoint(s.u, lerp(0.04, 1.0, k), 0.02), visible: true };
    }
    const nx = STROKES[i + 1];
    if (nx && t < nx.t0) {  // lift, travel back to the cuticle, touch down
      const k = easeInOutCubic(seg(t, s.t1, nx.t0));
      const p = end(s).lerp(start(nx), k);
      p.z += 0.55 * Math.sin(Math.PI * k);
      return { pos: p, visible: true };
    }
  }
  if (t < exit1) {
    const k = easeInCubic(seg(t, exit0, exit1));
    return { pos: end(STROKES[2]).lerp(offscreen, k), visible: true };
  }
  return { pos: offscreen, visible: false };
}
const easeInCubic = (k) => k * k * k;

function buildFinger() {
  const grp = new THREE.Group();
  // skin: capsule fading out toward the knuckle (alpha gradient) so it reads as a close-up
  const cap = new THREE.CapsuleGeometry(FINGER_R, 3.6, 16, 48);
  cap.translate(0, 0.0, 0);
  const a = document.createElement("canvas"); a.width = 4; a.height = 256;
  const ac = a.getContext("2d");
  const ag = ac.createLinearGradient(0, 256, 0, 0);  // canvas y down = uv v up
  ag.addColorStop(0, "#000"); ag.addColorStop(0.3, "#000"); ag.addColorStop(0.55, "#fff");
  ag.addColorStop(1, "#fff");
  ac.fillStyle = ag; ac.fillRect(0, 0, 4, 256);
  const alphaMap = new THREE.CanvasTexture(a);
  const skin = new THREE.MeshPhysicalMaterial({
    color: S.skin, roughness: 0.52, sheen: 0.6, sheenColor: new THREE.Color("#ffb69c"),
    sheenRoughness: 0.5, clearcoat: 0.08, alphaMap, transparent: true });
  const finger = new THREE.Mesh(cap, skin);
  grp.add(finger);
  // cuticle fold: a thin torus-like lip around the nail base
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 12, 48, Math.PI),
                             new THREE.MeshPhysicalMaterial({ color: S.skin, roughness: 0.6, sheen: 0.4 }));
  lip.rotation.set(-0.35, 0, Math.PI);
  lip.scale.set(1, 0.42, 1);
  lip.position.set(0, NAIL_Y0 + 0.13, 0.86);
  grp.add(lip);

  // nail plate: dense grid bent onto the finger, so the outline is exact and the surface smooth
  const nu = 48, nv = 64;
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = i / nu, v = j / nv;
    const p = nailPoint(u, v);
    pos.push(p.x, p.y, p.z); uv.push(u, 1 - v);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a0 = j * (nu + 1) + i, b0 = a0 + 1, c0 = a0 + nu + 1, d0 = c0 + 1;
    idx.push(a0, b0, c0, b0, d0, c0);
  }
  const ng = new THREE.BufferGeometry();
  ng.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  ng.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  ng.setIndex(idx); ng.computeVertexNormals();
  const c = document.createElement("canvas"); c.width = c.height = 512;
  S.ctx = c.getContext("2d");
  S.tex = new THREE.CanvasTexture(c);
  S.tex.colorSpace = THREE.SRGBColorSpace;
  S.tex.anisotropy = 4;
  S.nailMat = new THREE.MeshPhysicalMaterial({
    map: S.tex, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.04, side: THREE.DoubleSide });
  const nail = new THREE.Mesh(ng, S.nailMat);
  grp.add(nail);
  return grp;
}

function buildBrush() {
  const b = new THREE.Group();
  const black = new THREE.MeshPhysicalMaterial({ color: "#141414", roughness: 0.18, clearcoat: 1 });
  const chrome = new THREE.MeshPhysicalMaterial({ color: "#d9d9de", metalness: 1, roughness: 0.15 });
  const wet = new THREE.MeshPhysicalMaterial({ color: S.color, roughness: 0.15, clearcoat: 1 });
  // bristles (tip at the group origin), ferrule, long cap handle; built along +y
  const bristles = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.1, 0.8, 32, 1), wet);
  bristles.scale.z = 0.4; bristles.position.y = 0.4;
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.25, 0.36, 32), chrome);
  ferrule.position.y = 0.95;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.7, 16), chrome);
  stem.position.y = 1.45;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 2.0, 40), black);
  cap.position.y = 2.8;
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), black);
  top.position.y = 3.8;
  b.add(bristles, ferrule, stem, cap, top);
  // hold it like a manicurist: handle up and to the right, tilted toward the camera
  b.rotation.set(0.62, 0, -0.62);
  return b;
}

export default {
  async setup(root, params, W, H) {
    S = { W, H, color: params.color || "#FF2E8B", skin: params.skin || "#e2a284",
          exit: params.exit !== false };
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(params.supersample || 1.25);  // 1.5 looked the same, 25 % slower
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    Object.assign(renderer.domElement.style, { position: "absolute", left: "0", top: "0" });
    root.appendChild(renderer.domElement);
    // soft edges at the top, right and bottom, where the brush enters and leaves, so nothing is
    // sliced by the overlay's border when it is composited onto footage
    root.style.webkitMaskImage = root.style.maskImage =
      "linear-gradient(to bottom, transparent 0%, #000 14%), linear-gradient(to left, transparent 0%, #000 12%), " +
      "linear-gradient(to top, transparent 0%, #000 22%)";
    root.style.webkitMaskComposite = "source-in";
    root.style.maskComposite = "intersect";
    const fx = document.createElement("canvas");  // 2D layer for sparkles
    fx.width = W; fx.height = H; fx.style.cssText = "position:absolute;left:0;top:0";
    root.appendChild(fx);
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const camera = new THREE.PerspectiveCamera(26, W / H, 0.1, 100);
    camera.position.set(0, 1.5, 9.6);
    camera.lookAt(0, 1.45, 0);
    const key = new THREE.DirectionalLight("#fff4ee", 1.6); key.position.set(-3, 5, 6);
    const rim = new THREE.DirectionalLight("#ffd0e4", 1.2); rim.position.set(4, 2, -3);
    scene.add(key, rim, new THREE.AmbientLight("#ffffff", 0.25));
    Object.assign(S, { renderer, scene, camera, fx, fctx: fx.getContext("2d") });
    S.hand = new THREE.Group();
    S.hand.add(buildFinger());
    S.hand.position.y = -0.35;
    scene.add(S.hand);
    S.brush = buildBrush();
    S.hand.add(S.brush);
    const duration = S.exit ? 4.2 : 3.7;
    return {
      duration,
      sfx: [  // names map to files in the SFX library; "brush" is synthesised (vanim.py)
        { t: 0.02, name: "pop", gain: 0 },
        { t: 0.5, name: "whoosh", gain: -8 },
        { t: 0.95, name: "brush", gain: -3 }, { t: 1.62, name: "brush", gain: -4 },
        { t: 2.2, name: "brush", gain: -4 },
        { t: 2.62, name: "whoosh2", gain: -10 },
        { t: 2.78, name: "sparkle", gain: -2 },
        ...(S.exit ? [{ t: 3.78, name: "pop2", gain: -6 }] : []),
      ],
    };
  },

  async frame(t) {
    const { hand, brush, renderer, scene, camera, fctx, W, H } = S;
    // entrance: spring scale + quarter turn into view; a little "settle" bounce after painting
    const kin = seg(t, 0, 0.55);
    let sc = kin <= 0 ? 0.001 : easeOutBack(kin, 2.2);
    sc *= 1 + 0.07 * Math.sin(Math.PI * seg(t, 2.72, 3.0));
    if (S.exit) sc *= 1 - easeInBack(seg(t, 3.75, 4.15), 1.6);
    hand.scale.setScalar(Math.max(0.001, sc));
    hand.rotation.y = lerp(-1.1, 0, easeOutCubic(kin)) + 0.06 * Math.sin(t * 1.7);
    hand.rotation.x = -0.18 + 0.03 * Math.sin(t * 1.3);
    hand.rotation.z = lerp(0.35, 0.08, easeOutCubic(kin));
    paintTexture(t);
    const bp = brushPose(t);
    brush.visible = bp.visible;
    brush.position.copy(bp.pos);
    // glossy sweep: rotate the studio reflections across the fresh coat
    const sw = easeInOutCubic(seg(t, 2.75, 3.45));
    scene.environmentRotation.set(0, lerp(-0.9, 0.9, sw), 0);
    S.nailMat.clearcoatRoughness = lerp(0.12, 0.02, seg(t, 2.6, 2.9));
    renderer.render(scene, camera);
    // sparkles on the nail (projected from 3D so they stay on it while it moves)
    fctx.clearRect(0, 0, W, H);
    const spots = [[0.3, 0.35, 3.0, 0.7], [0.72, 0.62, 3.12, 0.55], [0.5, 0.85, 3.25, 0.5],
                   [0.15, 0.75, 3.35, 0.4]];
    hand.updateMatrixWorld();
    for (const [u, v, t0, sz] of spots) {
      const p = nailPoint(u, v, 0.05).applyMatrix4(hand.matrixWorld).project(camera);
      sparkle(fctx, (p.x + 1) / 2 * W, (1 - p.y) / 2 * H, W * 0.12 * sz, seg(t, t0, t0 + 0.5));
    }
  },
};
