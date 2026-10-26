// CalendarFull: a booking calendar pops in, every free slot gets struck with a hand-drawn red X
// (faster and faster), then a "no appointments" stamp slams onto it and the card shakes.
// params: accent, title, stamp, slots [...], x_start, x_end, stamp_at, hold, exit
import { seg, lerp, clamp, easeOutBack, easeInBack, easeOutCubic, easeInCubic, spring } from "./ease.js";
import { el, stage, card } from "./ui.js";

let S;
const RED = "#E5243B";

export default {
  async setup(root, params, W, H) {
    const p = Object.assign({ accent: "#FF2E8B", title: "תורים פנויים", stamp: "אין תורים",
      slots: ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30", "18:00", "19:30", "21:00"],
      x_start: 0.32, x_end: 1.25, stamp_at: 1.4, hold: 0.7, exit: true }, params);
    const u = W / 100;
    const st = stage(root, W, H);
    const cw = 78 * u;
    const cardEl = el("div", `position:absolute;left:${(W - cw) / 2}px;top:${H * 0.5 - 42 * u}px;width:${cw}px;
      overflow:hidden;${card(u)}`);
    const head = el("div", `background:linear-gradient(90deg, #ff6aa8, ${p.accent});color:#fff;padding:${3.5 * u}px ${5 * u}px;
      font:800 ${6.4 * u}px Assistant;display:flex;justify-content:space-between;align-items:center`,
      `<span>${p.title}</span><span style="font:700 ${4.6 * u}px Assistant;opacity:.9">היום</span>`);
    const grid = el("div", `display:grid;grid-template-columns:repeat(3,1fr);gap:${2.6 * u}px;padding:${4.5 * u}px`);
    const slots = p.slots.map((tm) => {
      const s = el("div", `position:relative;border-radius:${3.4 * u}px;background:#fff4f8;border:${0.5 * u}px solid #ffd3e4;
        text-align:center;font:800 ${5.6 * u}px Assistant;color:#3a2230;padding:${2.6 * u}px 0;direction:ltr`, tm);
      const x = el("div", "position:absolute;inset:0;display:flex;align-items:center;justify-content:center",
        `<svg viewBox="0 0 40 40" width="${11 * u}" height="${11 * u}" style="overflow:visible">
          <path class="a" d="M6 6L34 34" stroke="${RED}" stroke-width="6.5" stroke-linecap="round" fill="none"
            stroke-dasharray="40" stroke-dashoffset="40"/>
          <path class="b" d="M34 6L6 34" stroke="${RED}" stroke-width="6.5" stroke-linecap="round" fill="none"
            stroke-dasharray="40" stroke-dashoffset="40"/></svg>`);
      s.append(x);
      grid.append(s);
      return s;
    });
    cardEl.append(head, grid);
    const stamp = el("div", `position:absolute;left:50%;top:${H * 0.5}px;white-space:nowrap;
      font:800 ${12 * u}px Assistant;color:${RED};border:${1.4 * u}px solid ${RED};border-radius:${4 * u}px;
      padding:${0.6 * u}px ${5 * u}px;background:rgba(255,255,255,.92);opacity:0;
      box-shadow:0 ${1.5 * u}px ${5 * u}px rgba(160,0,30,.3)`, p.stamp);
    st.append(cardEl, stamp);
    // strike order: scattered, accelerating (ease-in spacing)
    const order = [4, 0, 8, 2, 6, 1, 7, 3, 5].filter((i) => i < slots.length);
    const n = order.length;
    const strikeAt = order.map((_, j) => p.x_start + (p.x_end - p.x_start) * (1 - Math.pow(1 - j / Math.max(1, n - 1), 1.6)));
    const dur = p.stamp_at + 0.35 + p.hold + (p.exit ? 0.3 : 0);
    S = { p, u, W, H, cardEl, slots, stamp, order, strikeAt, dur };
    return {
      duration: dur,
      sfx: [{ t: 0, name: "pop", gain: -6 },
            ...strikeAt.map((t, j) => ({ t, name: "click", gain: -12 - (j % 2) * 2 })),
            { t: p.stamp_at + 0.12, name: "impact", gain: -6 },
            ...(p.exit ? [{ t: dur - 0.3, name: "whoosh2", gain: -14 }] : [])],
    };
  },

  async frame(t) {
    const s = S, u = s.u, p = s.p;
    const k = seg(t, 0, 0.38);
    const out = p.exit ? easeInBack(seg(t, s.dur - 0.3, s.dur), 1.6) : 0;
    const shake = Math.sin(t * 70) * 1.8 * u * Math.exp(-9 * Math.max(0, t - p.stamp_at - 0.12)) * (t > p.stamp_at + 0.12 ? 1 : 0);
    s.cardEl.style.transform = `translateX(${shake}px) scale(${Math.max(0.001, (k <= 0 ? 0 : spring(k, 1.5, 5.5)) * (1 - out))})
      rotateX(${lerp(35, 0, easeOutCubic(k))}deg)`;
    s.cardEl.style.opacity = clamp(k * 4);
    s.order.forEach((i, j) => {
      const t0 = s.strikeAt[j];
      const a = seg(t, t0, t0 + 0.08), b = seg(t, t0 + 0.06, t0 + 0.14);
      const sl = s.slots[i];
      sl.querySelector(".a").setAttribute("stroke-dashoffset", 40 * (1 - a));
      sl.querySelector(".b").setAttribute("stroke-dashoffset", 40 * (1 - b));
      const g = seg(t, t0, t0 + 0.15);
      sl.style.color = g > 0 ? `rgba(58,34,48,${1 - 0.6 * g})` : "#3a2230";
      sl.style.background = g > 0 ? "#f6eef1" : "#fff4f8";
      sl.style.transform = `scale(${1 - 0.08 * Math.sin(Math.PI * g)})`;
    });
    const sk = seg(t, p.stamp_at, p.stamp_at + 0.14);
    s.stamp.style.opacity = sk > 0 ? clamp(sk * 3) * (1 - out) : 0;
    s.stamp.style.transform = `translate(-50%,-50%) rotate(-12deg) scale(${lerp(2.6, 1, easeInCubic(sk)) *
      (1 + 0.06 * Math.sin(Math.PI * seg(t, p.stamp_at + 0.14, p.stamp_at + 0.3))) * (1 - out) + 0.001})`;
  },
};
