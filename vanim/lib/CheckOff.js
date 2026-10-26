// CheckOff ("stuck in the middle of the day … I'm dying to tick it off and move on"): a day planner with a
// nails block wedged mid-day that flashes red and shakes, then a big tick lands, the block is struck through
// and slides out while the day flows on.
// params: accent, task, stuck_at, tick_at, hold, exit
import { seg, lerp, clamp, easeOutBack, easeInBack, easeOutCubic, easeInOutCubic, spring } from "./ease.js";
import { el, stage, card, burst, canvasLayer } from "./ui.js";

let S;
const RED = "#E5243B";

export default {
  async setup(root, params, W, H) {
    const p = Object.assign({ accent: "#FF2E8B", task: "ציפורניים", stuck_at: 0.45, tick_at: 1.6, hold: 0.5, exit: true }, params);
    const u = W / 100;
    const st = stage(root, W, H);
    const cw = 74 * u;
    const box = el("div", `position:absolute;left:${(W - cw) / 2}px;top:${H * 0.5 - 34 * u}px;width:${cw}px;padding:${3.6 * u}px ${4 * u}px;
      box-sizing:border-box;${card(u)}`);
    box.append(el("div", `font:800 ${6 * u}px Assistant;color:#2a1b22;margin-bottom:${2 * u}px`, "היום שלי"));
    const rows = [["09:00", "עבודה"], ["12:00", p.task], ["15:00", "פגישה"], ["18:00", "חדר כושר"]];
    const rowEls = rows.map(([tm, lab], i) => {
      const r = el("div", `position:relative;display:flex;align-items:center;gap:${3 * u}px;height:${11 * u}px;
        border-top:${0.3 * u}px solid #f1e4ea`, `<span style="font:700 ${4.4 * u}px Assistant;color:#9a7f8b;direction:ltr;width:${12 * u}px">${tm}</span>`);
      const blk = el("div", `flex:1;height:${8 * u}px;border-radius:${2.6 * u}px;display:flex;align-items:center;padding:0 ${3 * u}px;
        font:800 ${5 * u}px Assistant;color:${i === 1 ? "#fff" : "#5b4652"};background:${i === 1 ? p.accent : "#f6eef2"};position:relative`, lab);
      r.append(blk); box.append(r);
      return { r, blk };
    });
    const target = rowEls[1].blk;
    const strike = el("div", `position:absolute;left:${2 * u}px;right:${2 * u}px;top:50%;height:${0.8 * u}px;background:#fff;
      transform-origin:100% 50%;transform:scaleX(0)`);
    target.append(strike);
    const tick = el("div", `position:absolute;left:${W / 2 + 18 * u}px;top:${H * 0.5 - 16 * u}px;width:${20 * u}px;height:${20 * u}px;border-radius:50%;
      background:#22c55e;display:flex;align-items:center;justify-content:center;box-shadow:0 ${1.4 * u}px ${4 * u}px rgba(0,0,0,.3);opacity:0`,
      `<svg viewBox="0 0 52 52" width="${13 * u}" height="${13 * u}"><path class="tp" d="M13 27l9 9 17-19" fill="none" stroke="#fff"
        stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="40" stroke-dashoffset="40"/></svg>`);
    st.append(box, tick);
    const fx = canvasLayer(st, W, H);
    const dur = p.tick_at + 0.6 + p.hold + (p.exit ? 0.3 : 0);
    S = { p, u, W, H, box, target, strike, tick, fx, dur, tp: tick.querySelector(".tp"), others: rowEls };
    return {
      duration: dur,
      sfx: [{ t: 0, name: "pop", gain: -8 }, { t: p.stuck_at, name: "impact", gain: -14 },
            { t: p.stuck_at + 0.3, name: "click", gain: -12 }, { t: p.tick_at, name: "pop", gain: -4 },
            { t: p.tick_at + 0.1, name: "sparkle", gain: -6 }, { t: p.tick_at + 0.35, name: "whoosh2", gain: -12 },
            ...(p.exit ? [{ t: dur - 0.3, name: "whoosh2", gain: -14 }] : [])],
    };
  },

  async frame(t) {
    const s = S, u = s.u, p = s.p;
    const ex = p.exit ? easeInBack(seg(t, s.dur - 0.3, s.dur), 1.6) : 0;
    const k = seg(t, 0, 0.35);
    s.box.style.transform = `scale(${Math.max(0.001, (k <= 0 ? 0 : spring(k, 1.5, 5.5)) * (1 - ex))})`;
    // stuck: red flash + shake between stuck_at and tick_at
    const stuck = t >= p.stuck_at && t < p.tick_at;
    const sh = stuck ? Math.sin(t * 55) * 0.9 * u * (0.5 + 0.5 * Math.sin(t * 6)) : 0;
    s.target.style.background = stuck && Math.floor(t * 5) % 2 ? RED : p.accent;
    const tk = seg(t, p.tick_at, p.tick_at + 0.22);
    const out = easeInOutCubic(seg(t, p.tick_at + 0.35, p.tick_at + 0.6));
    s.target.style.transform = `translateX(${sh - out * 70 * u}px) scale(${1 + (stuck ? 0.04 : 0)})`;
    s.target.style.opacity = 1 - out;
    s.strike.style.transform = `scaleX(${easeOutCubic(seg(t, p.tick_at + 0.05, p.tick_at + 0.25))})`;
    s.tick.style.opacity = tk > 0 ? 1 - ex : 0;
    s.tick.style.transform = `scale(${tk > 0 ? easeOutBack(tk, 2.6) * (1 - ex) + 0.001 : 0.001}) rotate(${lerp(-30, 0, easeOutCubic(tk))}deg)`;
    s.tp.setAttribute("stroke-dashoffset", 40 * (1 - easeOutCubic(seg(t, p.tick_at + 0.08, p.tick_at + 0.3))));
    s.fx.clearRect(0, 0, s.W, s.H);
    burst(s.fx, s.W / 2 + 28 * u, s.H * 0.5 - 6 * u, s.W * 0.45, seg(t, p.tick_at + 0.05, p.tick_at + 1.0),
          ["#22c55e", p.accent, "#FFD24D", "#ffffff"], 36, 5, 0.6);
  },
};
