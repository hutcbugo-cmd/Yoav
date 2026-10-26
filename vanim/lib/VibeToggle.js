// VibeToggle ("choose the vibe: quiet ... or fun"): a settings card with a two-way switch. On the
// word "quiet" the knob settles on the moon side and the card turns calm lavender; on "fun" it
// snaps across with a bounce, the card flushes pink and music notes and chat bubbles burst out.
// params: accent, title, quiet, fun, quiet_at, fun_at, hold, exit
import { seg, lerp, clamp, easeOutBack, easeInBack, easeOutCubic, easeInOutCubic, spring, rgb } from "./ease.js";
import { el, stage, card, icon, burst, canvasLayer } from "./ui.js";

let S;
const CALM = "#8C7BD6";

const mix = (a, b, k) => { const x = rgb(a), y = rgb(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(",")})`; };

export default {
  async setup(root, params, W, H) {
    const p = Object.assign({ accent: "#FF2E8B", title: "הוייב של הטיפול", quiet: "שקט", fun: "כיפי",
      quiet_at: 0.6, fun_at: 2.6, hold: 0.9, exit: true }, params);
    const u = W / 100;
    const st = stage(root, W, H);
    const cw = 84 * u, sh = 20 * u;
    const box = el("div", `position:absolute;left:${(W - cw) / 2}px;top:${H * 0.5 - 14 * u}px;width:${cw}px;padding:${5 * u}px;
      box-sizing:border-box;${card(u)}`);
    box.append(el("div", `font:800 ${6.4 * u}px Assistant;color:#2a1b22;margin-bottom:${3.4 * u}px`, p.title));
    const sw = el("div", `position:relative;height:${sh}px;border-radius:${sh}px;background:#f3eef6;overflow:hidden`);
    const knob = el("div", `position:absolute;top:${1.4 * u}px;bottom:${1.4 * u}px;width:calc(50% - ${2.8 * u}px);
      border-radius:${sh}px;box-shadow:0 ${1 * u}px ${3 * u}px rgba(0,0,0,.2)`);
    const opt = (label, ic, side) => el("div", `position:absolute;top:0;bottom:0;${side}:0;width:50%;display:flex;align-items:center;
      justify-content:center;gap:${2 * u}px;font:800 ${7 * u}px Assistant;z-index:2`,
      `${icon(ic, 7 * u, "currentColor")}<span>${label}</span>`);
    const qEl = opt(p.quiet, "moon", "right"), fEl = opt(p.fun, "party", "left");
    sw.append(knob, qEl, fEl);
    box.append(sw);
    // things that burst out of the card on "fun"
    const flyers = [["note", -30, -22], ["note", 34, -26], ["party", 40, 8], ["note", -38, 12]].map(([ic, dx, dy], i) => {
      const f = el("div", `position:absolute;left:${W / 2}px;top:${H * 0.5}px;opacity:0`, icon(ic, (9 + (i % 2) * 2) * u, i % 2 ? "#FFD24D" : "#fff"));
      st.append(f);
      return { f, dx, dy };
    });
    const bubble = (txt, dx, dy) => { const b = el("div", `position:absolute;left:${W / 2}px;top:${H * 0.5}px;white-space:nowrap;
      background:#fff;border-radius:${5 * u}px;padding:${1.4 * u}px ${3.6 * u}px;font:800 ${5 * u}px Assistant;color:#2a1b22;
      box-shadow:0 ${1 * u}px ${3 * u}px rgba(0,0,0,.2);opacity:0`, txt); st.append(b); return { f: b, dx, dy }; };
    const bubbles = [bubble("חחח", 28, -24), bubble("איזה כיף!", -22, -30)];
    st.prepend(box);
    const fx = canvasLayer(st, W, H);
    const dur = p.fun_at + 0.6 + p.hold + (p.exit ? 0.3 : 0);
    S = { p, u, W, H, box, knob, qEl, fEl, flyers, bubbles, fx, dur };
    return {
      duration: dur,
      sfx: [{ t: 0, name: "pop", gain: -6 }, { t: p.quiet_at, name: "click", gain: -8 },
            { t: p.fun_at, name: "click", gain: -3 }, { t: p.fun_at + 0.05, name: "sparkle", gain: -6 },
            { t: p.fun_at + 0.25, name: "pop2", gain: -10 }, { t: p.fun_at + 0.45, name: "pop2", gain: -12 },
            ...(p.exit ? [{ t: dur - 0.3, name: "whoosh2", gain: -14 }] : [])],
    };
  },

  async frame(t) {
    const s = S, u = s.u, p = s.p, A = p.accent;
    const k = seg(t, 0, 0.4);
    const ex = p.exit ? easeInBack(seg(t, s.dur - 0.3, s.dur), 1.6) : 0;
    const fk = seg(t, p.fun_at, p.fun_at + 0.35);
    const bump = 1 + 0.05 * Math.sin(Math.PI * seg(t, p.fun_at + 0.1, p.fun_at + 0.35));
    s.box.style.transform = `scale(${Math.max(0.001, (k <= 0 ? 0 : spring(k, 1.5, 5.5)) * (1 - ex) * bump)})
      rotateX(${lerp(30, 0, easeOutCubic(k))}deg)`;
    const qk = easeOutCubic(seg(t, p.quiet_at, p.quiet_at + 0.25));
    // knob: hidden until "quiet", sits right; on "fun" slides left with an overshoot
    const pos = easeOutBack(fk, 2.2);  // 0 = right (quiet), 1 = left (fun)
    s.knob.style.right = `calc(${pos * 50}% + ${1.4 * u}px - ${pos * 0}px)`;
    s.knob.style.opacity = qk;
    s.knob.style.background = fk > 0 ? mix(CALM, A, clamp(fk * 1.5)) : CALM;
    s.qEl.style.color = fk > 0.4 ? "#7d6a77" : mix("#7d6a77", "#ffffff", qk);
    s.fEl.style.color = fk > 0.4 ? "#ffffff" : "#7d6a77";
    s.box.style.background = fk > 0 ? mix("#F2EEFF", "#FFF0F6", clamp(fk * 1.5)) : mix("#ffffff", "#F2EEFF", qk);
    const fl = seg(t, p.fun_at + 0.15, p.fun_at + 1.6);
    [...s.flyers, ...s.bubbles].forEach(({ f, dx, dy }, i) => {
      const kk = seg(t, p.fun_at + 0.15 + i * 0.07, p.fun_at + 0.65 + i * 0.07);
      f.style.opacity = kk > 0 ? clamp(kk * 3) * (1 - ex) : 0;
      f.style.transform = `translate(-50%,-50%) translate(${dx * u * easeOutCubic(kk)}px, ${(dy * easeOutCubic(kk) - 3 * Math.sin(t * 4 + i)) * u}px)
        scale(${easeOutBack(kk, 2.4)}) rotate(${Math.sin(t * 5 + i) * 8}deg)`;
    });
    s.fx.clearRect(0, 0, s.W, s.H);
    burst(s.fx, s.W * 0.3, s.H * 0.55, s.W * 0.5, fl, [A, "#FFD24D", "#7DD3FC", "#ffffff"], 40, 5, 0.6);
  },
};
