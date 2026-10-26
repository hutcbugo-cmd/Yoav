// NoNeed ("no marketing yourself, no finding a clinic"): two icon cards appear; on each spoken word a
// red line slashes across its card and the card greys out and drops back.
// params: accent, items [{icon, label, at}], hold, exit
import { seg, lerp, clamp, easeOutBack, easeInBack, easeOutCubic } from "./ease.js";
import { el, stage, card, icon } from "./ui.js";

let S;
const RED = "#E5243B";

export default {
  async setup(root, params, W, H) {
    const p = Object.assign({ accent: "#FF2E8B", hold: 0.6, exit: true,
      items: [{ icon: "megaphone", label: "שיווק", at: 0.55 }, { icon: "store", label: "קליניקה", at: 1.7 }] }, params);
    const u = W / 100;
    const st = stage(root, W, H);
    const cw = 38 * u, gap = 8 * u;
    const cards = p.items.map((it, i) => {
      const x = W / 2 + (i === 0 ? gap / 2 : -gap / 2 - cw);  // first item on the right (RTL reading order)
      const c = el("div", `position:absolute;left:${x}px;top:${H * 0.5 - cw * 0.62}px;width:${cw}px;height:${cw * 1.15}px;
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${2.4 * u}px;${card(u)}`,
        `${icon(it.icon, 18 * u, p.accent)}<div style="font:800 ${6.6 * u}px Assistant;color:#2a1b22">${it.label}</div>`);
      const slash = el("div", "position:absolute;inset:0;pointer-events:none",
        `<svg viewBox="0 0 100 115" width="${cw}" height="${cw * 1.15}" style="overflow:visible">
          <path d="M8 105 L92 10" stroke="${RED}" stroke-width="9" stroke-linecap="round" fill="none"
            stroke-dasharray="130" stroke-dashoffset="130"/></svg>`);
      c.append(slash);
      st.append(c);
      return { c, path: slash.querySelector("path"), ico: c.querySelector("svg"), at: it.at, appear: Math.max(0, it.at - 0.45) };
    });
    const last = Math.max(...p.items.map((i) => i.at));
    const dur = last + 0.4 + p.hold + (p.exit ? 0.3 : 0);
    S = { p, u, W, H, cards, dur };
    return {
      duration: dur,
      sfx: [...cards.flatMap((c) => [{ t: c.appear, name: "pop", gain: -8 }, { t: c.at, name: "swipe", gain: -4 }]),
            ...(p.exit ? [{ t: dur - 0.3, name: "whoosh2", gain: -14 }] : [])],
    };
  },

  async frame(t) {
    const s = S, u = s.u;
    const ex = s.p.exit ? easeInBack(seg(t, s.dur - 0.3, s.dur), 1.6) : 0;
    s.cards.forEach(({ c, path, ico, at, appear }, i) => {
      const k = seg(t, appear, appear + 0.35);
      const xk = seg(t, at, at + 0.16);
      const g = seg(t, at + 0.1, at + 0.4);
      const sc = (k <= 0 ? 0.001 : easeOutBack(k, 2)) * (1 - 0.1 * easeOutCubic(g)) * (1 - ex);
      c.style.transform = `translateX(${Math.sin(t * 60) * 1.2 * u * Math.exp(-12 * Math.max(0, t - at)) * (t > at ? 1 : 0)}px)
        scale(${Math.max(0.001, sc)}) rotate(${(i ? 1 : -1) * 4 * easeOutCubic(g)}deg)`;
      c.style.opacity = clamp(k * 4);
      path.setAttribute("stroke-dashoffset", 130 * (1 - easeOutCubic(xk)));
      ico.style.filter = `grayscale(${g}) opacity(${1 - 0.45 * g})`;
    });
  },
};
