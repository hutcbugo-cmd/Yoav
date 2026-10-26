// LogoReveal: the brand's app icon flips in in 3D and lands on the beat (0.3 s), a glow ring and
// sparkle burst go off, a light sweep crosses the icon, the wordmark rises letter by letter, then
// an optional tagline pill. params: logo (repo path), brand, accent, tagline, hold (s), exit
import { seg, lerp, clamp, easeOutBack, easeInBack, easeOutCubic, easeInOutCubic, spring, sparkle } from "./ease.js";
import { el, stage, pill, burst, canvasLayer } from "./ui.js";

let S;

export default {
  async setup(root, params, W, H) {
    const p = Object.assign({ brand: "Nomi", accent: "#FF2E8B", tagline: "", hold: 0.6, exit: true, logo: "" }, params);
    const u = W / 100;
    const st = stage(root, W, H);
    const ic = 46 * u;
    const box = el("div", `position:absolute;left:${(W - ic) / 2}px;top:${H * 0.38 - ic / 2}px;width:${ic}px;height:${ic}px;
      transform-style:preserve-3d`);
    const face = (css, html = "") => el("div", `position:absolute;inset:0;border-radius:${10 * u}px;overflow:hidden;
      backface-visibility:hidden;box-shadow:0 ${2 * u}px ${6 * u}px rgba(0,0,0,.3);${css}`, html);
    const front = face("background:#fff", p.logo ? `<img src="/${p.logo}" style="width:100%;height:100%;display:block">`
      : `<div style="font:800 ${16 * u}px Assistant;color:${p.accent};text-align:center;line-height:${ic}px">${p.brand[0]}</div>`);
    const shine = el("div", `position:absolute;inset:0;background:linear-gradient(115deg, rgba(255,255,255,0) 35%,
      rgba(255,255,255,.75) 50%, rgba(255,255,255,0) 65%);background-size:300% 100%`);
    front.append(shine);
    const back = face(`background:linear-gradient(140deg, ${p.accent}, #c2185b);transform:rotateY(180deg)`);
    box.append(front, back);
    const ring = el("div", `position:absolute;left:${W / 2}px;top:${H * 0.38}px;width:${ic}px;height:${ic}px;
      margin:${-ic / 2}px 0 0 ${-ic / 2}px;border-radius:50%;border:${1.4 * u}px solid ${p.accent};opacity:0`);
    const word = el("div", `position:absolute;left:0;right:0;top:${H * 0.38 + ic / 2 + 2 * u}px;text-align:center;
      direction:ltr;font:800 ${16 * u}px Assistant;color:#fff;letter-spacing:${-0.4 * u}px;
      text-shadow:0 ${0.8 * u}px ${3 * u}px rgba(0,0,0,.45)`);
    const letters = [...p.brand].map((c) => {
      const s = el("span", "display:inline-block", c);
      word.append(s);
      return s;
    });
    st.append(ring, box, word);
    let tag = null;
    if (p.tagline) {
      tag = el("div", `position:absolute;left:50%;top:${H * 0.38 + ic / 2 + 23 * u}px;transform-origin:50% 50%;
        white-space:nowrap;${pill(u, p.accent)}`, p.tagline);
      st.append(tag);
    }
    const fx = canvasLayer(st, W, H);
    const dur = 1.2 + p.hold + (p.exit ? 0.35 : 0);
    S = { p, W, H, u, box, ring, shine, letters, tag, fx, dur };
    return {
      duration: dur,
      sfx: [{ t: 0.0, name: "whoosh", gain: -8 }, { t: 0.3, name: "sparkle", gain: -4 },
            { t: 0.32, name: "pop", gain: -4 },
            ...(p.tagline ? [{ t: 0.82, name: "pop2", gain: -8 }] : []),
            ...(p.exit ? [{ t: dur - 0.32, name: "whoosh2", gain: -12 }] : [])],
    };
  },

  async frame(t) {
    const s = S, u = s.u;
    const k = seg(t, 0, 0.42);
    const sc = k <= 0 ? 0.001 : spring(k, 1.4, 5);
    const out = s.p.exit ? easeInBack(seg(t, s.dur - 0.35, s.dur), 1.6) : 0;
    const fl = Math.sin(t * 2.6) * 1.2 * u * seg(t, 0.6, 1.0);
    s.box.style.transform = `translateY(${fl}px) scale(${Math.max(0.001, sc * (1 - out))})
      rotateY(${lerp(200, 0, easeOutCubic(k))}deg) rotateX(${lerp(-25, 0, easeOutCubic(k)) + 4 * Math.sin(t * 1.8) * seg(t, 0.6, 1)}deg)`;
    s.shine.style.backgroundPosition = `${lerp(120, -20, easeInOutCubic(seg(t, 0.5, 1.0)))}% 0`;
    const rk = seg(t, 0.28, 0.85);
    s.ring.style.opacity = rk > 0 && rk < 1 ? 1 - rk : 0;
    s.ring.style.transform = `scale(${1 + 1.1 * easeOutCubic(rk)})`;
    s.letters.forEach((l, i) => {
      const lk = seg(t, 0.36 + i * 0.07, 0.66 + i * 0.07);
      l.style.opacity = clamp(lk * 3) * (1 - out);
      l.style.transform = `translateY(${(1 - easeOutBack(lk, 2.2)) * 10 * u}px) scale(${lerp(0.6, 1, easeOutBack(lk, 2))})`;
    });
    if (s.tag) {
      const tk = seg(t, 0.8, 1.05);
      s.tag.style.transform = `translateX(-50%) scale(${tk <= 0 ? 0.001 : easeOutBack(tk, 2.4) * (1 - out) + 0.001})`;
    }
    s.fx.clearRect(0, 0, s.W, s.H);
    burst(s.fx, s.W / 2, s.H * 0.38, s.W * 0.48, seg(t, 0.28, 1.15), ["#ffffff", s.p.accent, "#FFD24D"], 36, 11, 0.4);
    [[0.27, 0.22, 0.35], [0.76, 0.3, 0.45], [0.7, 0.55, 0.6], [0.3, 0.5, 0.7]].forEach(([x, y, t0]) =>
      sparkle(s.fx, x * s.W, y * s.H, s.W * 0.07, seg(t, t0, t0 + 0.5)));
  },
};
