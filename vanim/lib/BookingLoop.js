// BookingLoop ("I book the next one at the end of each appointment"): appointment cards chain one after
// another around a looping arrow; each lands with a tick, the loop keeps spinning.
// params: accent, dates [...], label, step (s between cards), hold, exit
import { seg, lerp, clamp, easeOutBack, easeInBack, easeOutCubic, spring } from "./ease.js";
import { el, stage, card, pill } from "./ui.js";

let S;

export default {
  async setup(root, params, W, H) {
    const p = Object.assign({ accent: "#FF2E8B", dates: ["1.3", "29.3", "26.4", "24.5"], label: "כל פעם לתור הבא",
      step: 0.45, hold: 0.5, exit: true }, params);
    const u = W / 100;
    const st = stage(root, W, H);
    const R = 27 * u, cx = W / 2, cy = H * 0.52;
    const ring = el("div", `position:absolute;left:${cx - R}px;top:${cy - R}px;width:${2 * R}px;height:${2 * R}px`,
      `<svg viewBox="0 0 100 100" width="${2 * R}" height="${2 * R}" style="overflow:visible">
        <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="3" stroke-dasharray="6 5"/>
        <g class="arrow"><path d="M50 6 A44 44 0 0 1 94 50" fill="none" stroke="${p.accent}" stroke-width="6" stroke-linecap="round"/>
        <path d="M86 44 L95 54 L103 42" fill="none" stroke="${p.accent}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`);
    const n = p.dates.length;
    const cards = p.dates.map((d, i) => {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      const c = el("div", `position:absolute;left:${x - 11 * u}px;top:${y - 12 * u}px;width:${22 * u}px;height:${24 * u}px;
        overflow:hidden;opacity:0;${card(u, `border-radius:${4 * u}px`)}`,
        `<div style="height:${6.5 * u}px;background:linear-gradient(90deg,#ff6aa8,${p.accent})"></div>
         <div style="text-align:center;font:800 ${7.5 * u}px Assistant;color:#2a1b22;line-height:${11 * u}px;direction:ltr">${d}</div>
         <div class="tk" style="position:absolute;right:${1.4 * u}px;bottom:${1.2 * u}px;width:${6 * u}px;height:${6 * u}px;border-radius:50%;
           background:#22c55e;color:#fff;font:800 ${4.4 * u}px Assistant;text-align:center;line-height:${6 * u}px;opacity:0">✓</div>`);
      st.append(c);
      return c;
    });
    const lab = el("div", `position:absolute;left:50%;top:${cy}px;white-space:nowrap;opacity:0;
      ${pill(u, p.accent, `font-size:${5.2 * u}px;padding:${1.2 * u}px ${3.4 * u}px`)}`, p.label);
    st.prepend(ring); st.append(lab);
    const t0 = 0.3, tl = t0 + n * p.step;
    const dur = tl + 0.3 + p.hold + (p.exit ? 0.3 : 0);
    S = { p, u, W, H, ring, cards, lab, t0, tl, dur, arrow: ring.querySelector(".arrow") };
    return {
      duration: dur,
      sfx: [{ t: 0, name: "whoosh2", gain: -10 }, ...cards.map((_, i) => ({ t: t0 + i * p.step, name: "pop2", gain: -10 })),
            ...cards.map((_, i) => ({ t: t0 + i * p.step + 0.2, name: "click", gain: -14 })),
            { t: tl, name: "pop", gain: -6 }, ...(p.exit ? [{ t: dur - 0.3, name: "whoosh2", gain: -14 }] : [])],
    };
  },

  async frame(t) {
    const s = S, u = s.u, p = s.p;
    const ex = p.exit ? easeInBack(seg(t, s.dur - 0.3, s.dur), 1.6) : 0;
    const k = seg(t, 0, 0.35);
    s.ring.style.transform = `scale(${Math.max(0.001, (k <= 0 ? 0 : spring(k, 1.4, 6)) * (1 - ex))})`;
    s.arrow.setAttribute("transform", `rotate(${t * 220} 50 50)`);
    s.cards.forEach((c, i) => {
      const ck = seg(t, s.t0 + i * p.step, s.t0 + i * p.step + 0.3);
      c.style.opacity = ck > 0 ? 1 - ex : 0;
      c.style.transform = `scale(${ck > 0 ? easeOutBack(ck, 2.4) * (1 - ex) + 0.001 : 0.001}) rotate(${lerp(-15, 0, easeOutCubic(ck))}deg)`;
      const tk = seg(t, s.t0 + i * p.step + 0.2, s.t0 + i * p.step + 0.35);
      const e = c.querySelector(".tk");
      e.style.opacity = tk;
      e.style.transform = `scale(${tk > 0 ? easeOutBack(tk, 3) : 0})`;
    });
    const lk = seg(t, s.tl, s.tl + 0.25);
    s.lab.style.opacity = lk > 0 ? 1 - ex : 0;
    s.lab.style.transform = `translate(-50%,-50%) scale(${lk > 0 ? easeOutBack(lk, 2.4) * (1 - ex) + 0.001 : 0.001})`;
  },
};
