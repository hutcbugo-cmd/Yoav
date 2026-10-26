// BigButton ("book it with one press of a button?" … "Of course."): a big glossy button rises, a finger
// taps it on the spoken word, it squashes and rings out, confetti bursts, and the answer stamps on.
// params: accent, label, answer, press_at, answer_at, hold, exit
import { seg, lerp, clamp, easeOutBack, easeInBack, easeOutCubic, spring } from "./ease.js";
import { el, stage, pill, burst, canvasLayer } from "./ui.js";

let S;

export default {
  async setup(root, params, W, H) {
    const p = Object.assign({ accent: "#FF2E8B", label: "קביעת תור", answer: "ברור!", press_at: 0.9, answer_at: 1.6,
      hold: 0.5, exit: true }, params);
    const u = W / 100;
    const st = stage(root, W, H);
    const bs = 46 * u, cx = W / 2, cy = H * 0.46;
    const base = el("div", `position:absolute;left:${cx - bs * 0.62}px;top:${cy - bs * 0.2}px;width:${bs * 1.24}px;height:${bs * 0.62}px;
      border-radius:50%;background:radial-gradient(closest-side, #3a2230, #1e1018);box-shadow:0 ${2 * u}px ${5 * u}px rgba(0,0,0,.35)`);
    const btn = el("div", `position:absolute;left:${cx - bs / 2}px;top:${cy - bs / 2}px;width:${bs}px;height:${bs}px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;text-align:center;font:800 ${7.5 * u}px Assistant;color:#fff;
      background:radial-gradient(circle at 35% 30%, #ff9cc6, ${p.accent} 55%, #b5135e);
      box-shadow:inset 0 ${-2 * u}px ${4 * u}px rgba(0,0,0,.25), 0 ${2.4 * u}px 0 #8e0e4b, 0 ${3 * u}px ${6 * u}px rgba(0,0,0,.3);
      text-shadow:0 ${0.4 * u}px ${1 * u}px rgba(0,0,0,.3);transform-origin:50% 60%`, p.label);
    const ring = el("div", `position:absolute;left:${cx}px;top:${cy}px;width:${bs}px;height:${bs}px;margin:${-bs / 2}px 0 0 ${-bs / 2}px;
      border-radius:50%;border:${1.2 * u}px solid ${p.accent};opacity:0`);
    const finger = el("div", `position:absolute;left:${cx + 4 * u}px;top:${cy + 2 * u}px;width:${12 * u}px;height:${12 * u}px;
      border-radius:50%;background:rgba(255,255,255,.75);border:${0.8 * u}px solid #fff;box-shadow:0 0 ${3 * u}px rgba(0,0,0,.3);opacity:0`);
    const ans = el("div", `position:absolute;left:50%;top:${cy + bs * 0.62}px;white-space:nowrap;opacity:0;
      ${pill(u, p.accent, `font-size:${11 * u}px;padding:${2 * u}px ${7 * u}px`)}`, p.answer);
    st.append(ring, base, btn, finger, ans);
    const fx = canvasLayer(st, W, H);
    const dur = p.answer_at + 0.4 + p.hold + (p.exit ? 0.3 : 0);
    S = { p, u, W, H, base, btn, ring, finger, ans, fx, cx, cy, dur };
    return {
      duration: dur,
      sfx: [{ t: 0, name: "pop", gain: -6 }, { t: p.press_at, name: "click", gain: -2 },
            { t: p.press_at + 0.05, name: "sparkle", gain: -6 }, { t: p.answer_at + 0.08, name: "impact", gain: -10 },
            { t: p.answer_at + 0.1, name: "pop", gain: -4 },
            ...(p.exit ? [{ t: dur - 0.3, name: "whoosh2", gain: -14 }] : [])],
    };
  },

  async frame(t) {
    const s = S, u = s.u, p = s.p;
    const ex = p.exit ? easeInBack(seg(t, s.dur - 0.3, s.dur), 1.6) : 0;
    const k = seg(t, 0, 0.4);
    const sc = Math.max(0.001, (k <= 0 ? 0 : spring(k, 1.4, 5)) * (1 - ex));
    const idle = 1 + 0.03 * Math.sin(t * 9) * (t < p.press_at - 0.2 ? seg(t, 0.4, 0.6) : 0);
    const pr = Math.sin(Math.PI * seg(t, p.press_at - 0.04, p.press_at + 0.18));
    s.base.style.transform = `scale(${sc})`;
    s.btn.style.transform = `translateY(${-(1 - easeOutCubic(k)) * 10 * u + pr * 2.2 * u}px) scale(${sc * idle * (1 + 0.06 * pr)}, ${sc * idle * (1 - 0.12 * pr)})`;
    s.btn.style.filter = `brightness(${1 + 0.25 * seg(t, p.press_at, p.press_at + 0.1) * (1 - seg(t, p.press_at + 0.3, p.press_at + 0.8))})`;
    const fk = seg(t, p.press_at - 0.3, p.press_at + 0.3);
    s.finger.style.opacity = fk > 0 && fk < 1 ? Math.sin(Math.PI * fk) * (1 - ex) : 0;
    s.finger.style.transform = `translate(${lerp(10, 0, easeOutCubic(clamp(fk * 2))) * u}px, ${lerp(10, 0, easeOutCubic(clamp(fk * 2))) * u}px)
      scale(${1 - 0.25 * pr})`;
    [0, 0.25].forEach((d) => {});
    const rk = seg(t, p.press_at, p.press_at + 0.7);
    s.ring.style.opacity = rk > 0 && rk < 1 ? (1 - rk) * (1 - ex) : 0;
    s.ring.style.transform = `scale(${1 + 1.2 * easeOutCubic(rk)})`;
    const ak = seg(t, p.answer_at, p.answer_at + 0.16);
    s.ans.style.opacity = ak > 0 ? clamp(ak * 3) * (1 - ex) : 0;
    s.ans.style.transform = `translateX(-50%) rotate(-5deg) scale(${lerp(2.2, 1, easeOutCubic(ak)) *
      (1 + 0.07 * Math.sin(Math.PI * seg(t, p.answer_at + 0.16, p.answer_at + 0.34))) * (1 - ex) + 0.001})`;
    s.fx.clearRect(0, 0, s.W, s.H);
    burst(s.fx, s.cx, s.cy, s.W * 0.55, seg(t, p.press_at + 0.02, p.press_at + 1.1), [p.accent, "#FFD24D", "#7DD3FC", "#ffffff"], 46, 9, 0.7);
  },
};
