// VerifiedStars ("technicians are verified ... see their ratings"): a shield flips in, a tick draws
// itself and a ring pulses ("verified" pill); later five stars fill one by one and the score counts up.
// params: accent, label, score, check_at, stars_at, hold, exit
import { seg, lerp, clamp, easeOutBack, easeInBack, easeOutCubic, spring, sparkle } from "./ease.js";
import { el, stage, pill, star, canvasLayer } from "./ui.js";

let S;
const GOLD = "#F5A623";

export default {
  async setup(root, params, W, H) {
    const p = Object.assign({ accent: "#FF2E8B", label: "מאומתת", score: 4.9, check_at: 0.45, stars_at: 1.4,
      hold: 0.7, exit: true }, params);
    const u = W / 100;
    const st = stage(root, W, H);
    const sz = 40 * u;
    const shield = el("div", `position:absolute;left:${(W - sz) / 2}px;top:${H * 0.33 - sz / 2}px;width:${sz}px;height:${sz}px`,
      `<svg viewBox="0 0 24 24" width="${sz}" height="${sz}" style="overflow:visible">
        <defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff74ad"/>
          <stop offset="1" stop-color="${p.accent}"/></linearGradient>
          <filter id="ss"><feDropShadow dx="0" dy=".5" stdDeviation=".7" flood-color="#5a0f33" flood-opacity=".4"/></filter></defs>
        <path d="M12 1.5l8.5 3.2v6.3c0 5.5-3.6 9.9-8.5 11.6C7.1 20.9 3.5 16.5 3.5 11V4.7z" fill="url(#sg)" filter="url(#ss)"/>
        <path d="M12 3.4l6.8 2.6v5c0 4.5-2.9 8.1-6.8 9.6" fill="rgba(255,255,255,.18)"/>
        <path class="tick" d="M7.6 12.2l3 3 5.9-6.3" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"
          stroke-linejoin="round" stroke-dasharray="14" stroke-dashoffset="14"/></svg>`);
    const ring = el("div", `position:absolute;left:${W / 2}px;top:${H * 0.33}px;width:${sz}px;height:${sz}px;margin:${-sz / 2}px 0 0 ${-sz / 2}px;
      border-radius:50%;border:${1.2 * u}px solid ${p.accent};opacity:0`);
    const lab = el("div", `position:absolute;left:50%;top:${H * 0.33 + sz / 2 + 2 * u}px;white-space:nowrap;${pill(u, p.accent)}`, p.label);
    const row = el("div", `position:absolute;left:0;right:0;top:${H * 0.33 + sz / 2 + 18 * u}px;display:flex;justify-content:center;
      align-items:center;gap:${1.6 * u}px;direction:ltr`);
    const stars = [0, 1, 2, 3, 4].map(() => {
      const s = el("div", `position:relative;width:${11 * u}px;height:${11 * u}px`,
        `<div style="position:absolute;inset:0">${star("rgba(255,255,255,.55)", 11 * u)}</div>
         <div class="f" style="position:absolute;inset:0;opacity:0">${star(GOLD, 11 * u)}</div>`);
      row.append(s);
      return s;
    });
    const score = el("div", `font:800 ${9 * u}px Assistant;color:#fff;margin-left:${2.4 * u}px;
      text-shadow:0 ${0.6 * u}px ${2.4 * u}px rgba(0,0,0,.45);min-width:${14 * u}px`, "");
    row.append(score);
    st.append(ring, shield, lab, row);
    const fx = canvasLayer(st, W, H);
    const dur = p.stars_at + 0.9 + p.hold + (p.exit ? 0.3 : 0);
    S = { p, u, W, H, shield, ring, lab, row, stars, score, fx, dur, tick: shield.querySelector(".tick") };
    return {
      duration: dur,
      sfx: [{ t: 0, name: "whoosh2", gain: -10 }, { t: 0.2, name: "pop", gain: -6 },
            { t: p.check_at + 0.12, name: "sparkle", gain: -6 }, { t: p.check_at + 0.3, name: "pop2", gain: -10 },
            ...[0, 1, 2, 3, 4].map((i) => ({ t: p.stars_at + i * 0.1, name: "pop2", gain: -12 + i })),
            { t: p.stars_at + 0.55, name: "coin", gain: -8 },
            ...(p.exit ? [{ t: dur - 0.3, name: "whoosh2", gain: -14 }] : [])],
    };
  },

  async frame(t) {
    const s = S, u = s.u, p = s.p;
    const ex = p.exit ? easeInBack(seg(t, s.dur - 0.3, s.dur), 1.6) : 0;
    const k = seg(t, 0, 0.4);
    s.shield.style.transform = `scale(${Math.max(0.001, (k <= 0 ? 0 : spring(k, 1.5, 5)) * (1 - ex))})
      rotateY(${lerp(180, 0, easeOutCubic(k))}deg)`;
    s.tick.setAttribute("stroke-dashoffset", 14 * (1 - easeOutCubic(seg(t, p.check_at, p.check_at + 0.22))));
    const rk = seg(t, p.check_at + 0.1, p.check_at + 0.7);
    s.ring.style.opacity = rk > 0 && rk < 1 ? 1 - rk : 0;
    s.ring.style.transform = `scale(${1 + 0.9 * easeOutCubic(rk)})`;
    const lk = seg(t, p.check_at + 0.25, p.check_at + 0.5);
    s.lab.style.transform = `translateX(-50%) scale(${lk <= 0 ? 0.001 : easeOutBack(lk, 2.4) * (1 - ex) + 0.001})`;
    s.row.style.opacity = t >= p.stars_at - 0.1 ? 1 - ex : 0;
    s.stars.forEach((st, i) => {
      const sk = seg(t, p.stars_at + i * 0.1, p.stars_at + i * 0.1 + 0.25);
      st.querySelector(".f").style.opacity = sk > 0 ? 1 : 0;
      st.style.transform = `scale(${sk > 0 ? easeOutBack(sk, 3) : lerp(0.6, 1, seg(t, p.stars_at - 0.1, p.stars_at))})`;
    });
    const ck = easeOutCubic(seg(t, p.stars_at, p.stars_at + 0.55));
    s.score.textContent = t >= p.stars_at ? (p.score * ck).toFixed(1) : "";
    s.fx.clearRect(0, 0, s.W, s.H);
    sparkle(s.fx, s.W * 0.66, s.H * 0.2, s.W * 0.09, seg(t, p.check_at + 0.1, p.check_at + 0.6));
    sparkle(s.fx, s.W * 0.3, s.H * 0.3, s.W * 0.07, seg(t, p.check_at + 0.2, p.check_at + 0.7));
    sparkle(s.fx, s.W * 0.78, s.H * 0.66, s.W * 0.07, seg(t, p.stars_at + 0.5, p.stars_at + 1.0));
  },
};
