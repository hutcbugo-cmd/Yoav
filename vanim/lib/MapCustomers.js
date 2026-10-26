// MapCustomers ("find customers who live near you"): a stylised neighbourhood map unfolds, the
// technician's pin drops and ripples, customer avatars pop up around it and link to the pin, and
// a counter pill shows how many are nearby.
// params: accent, count_text, names, hold, exit
import { seg, lerp, clamp, easeOutBack, easeInBack, easeOutCubic, easeInCubic, spring } from "./ease.js";
import { el, stage, card, icon, pill } from "./ui.js";

let S;

export default {
  async setup(root, params, W, H) {
    const p = Object.assign({ accent: "#FF2E8B", count_text: "12 לקוחות באזור", names: ["ר", "ד", "ל", "ש", "ת"],
      hold: 0.6, exit: true }, params);
    const u = W / 100;
    const st = stage(root, W, H);
    const mw = 80 * u, mh = 62 * u, mx = (W - mw) / 2, my = H * 0.46 - mh / 2;
    const map = el("div", `position:absolute;left:${mx}px;top:${my}px;width:${mw}px;height:${mh}px;overflow:hidden;${card(u, "background:#fdf2f6")}`,
      `<svg viewBox="0 0 100 78" width="${mw}" height="${mh}" preserveAspectRatio="none">
        <path d="M60 0 C55 20 70 30 66 50 S70 70 72 78" stroke="#bfe3f6" stroke-width="7" fill="none"/>
        <ellipse cx="22" cy="60" rx="16" ry="10" fill="#d4efd9"/><ellipse cx="86" cy="14" rx="11" ry="8" fill="#d4efd9"/>
        <g stroke="#fff" stroke-width="4.2" stroke-linecap="round"><path d="M0 26H100M0 54H100M30 0V78M78 0V78"/></g>
        <g stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M0 40H100M14 0V78M48 0V78M92 0V78"/></g>
        <g fill="#f6dbe6"><rect x="34" y="6" width="10" height="15" rx="1.5"/><rect x="82" y="30" width="8" height="18" rx="1.5"/>
          <rect x="4" y="8" width="7" height="13" rx="1.5"/><rect x="51" y="58" width="9" height="15" rx="1.5"/></g></svg>`);
    const lines = el("div", "position:absolute;inset:0", `<svg width="${W}" height="${H}" style="overflow:visible"></svg>`);
    const svgL = lines.querySelector("svg");
    const cx = W / 2, cy = my + mh * 0.5;
    const pinS = 14 * u;
    const pin = el("div", `position:absolute;left:${cx - pinS / 2}px;top:${cy - pinS}px;width:${pinS}px;height:${pinS}px;
      transform-origin:50% 100%;filter:drop-shadow(0 ${0.8 * u}px ${1.2 * u}px rgba(90,15,51,.45))`, icon("pin", pinS, p.accent));
    const ripples = [0, 1].map(() => {
      const r = el("div", `position:absolute;left:${cx}px;top:${cy}px;width:${30 * u}px;height:${14 * u}px;margin:${-7 * u}px 0 0 ${-15 * u}px;
        border-radius:50%;border:${0.8 * u}px solid ${p.accent};opacity:0`);
      return r;
    });
    const spots = [[-28, -16], [26, -20], [-30, 14], [30, 12], [2, 24]];
    const people = spots.slice(0, p.names.length).map(([dx, dy], i) => {
      const a = 11 * u;
      const e = el("div", `position:absolute;left:${cx + dx * u - a / 2}px;top:${cy + dy * u - a / 2}px;width:${a}px;height:${a}px;
        border-radius:50%;border:${0.8 * u}px solid #fff;box-shadow:0 ${0.8 * u}px ${2 * u}px rgba(0,0,0,.25);display:flex;
        align-items:center;justify-content:center;font:800 ${5 * u}px Assistant;color:#fff;
        background:linear-gradient(140deg, ${["#ff8fbf", "#9d8cf0", "#ffb36b", "#6cc7c0", "#f06b8f"][i % 5]}, ${["#e2337f", "#6c58d8", "#f08a2e", "#2e9f97", "#c9305a"][i % 5]})`, p.names[i]);
      const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
      ln.setAttribute("x1", cx); ln.setAttribute("y1", cy - pinS * 0.4); ln.setAttribute("x2", cx + dx * u); ln.setAttribute("y2", cy + dy * u);
      ln.setAttribute("stroke", p.accent); ln.setAttribute("stroke-width", 0.6 * u); ln.setAttribute("stroke-dasharray", `${1.4 * u} ${1.2 * u}`);
      ln.setAttribute("opacity", 0);
      svgL.append(ln);
      return { e, ln };
    });
    const count = el("div", `position:absolute;left:50%;top:${my + mh + 3 * u}px;white-space:nowrap;${pill(u, p.accent)}`, p.count_text);
    st.append(map, ...ripples, lines, ...people.map((q) => q.e), pin, count);
    const dur = 1.9 + p.hold + (p.exit ? 0.3 : 0);
    S = { p, u, W, H, map, pin, ripples, people, count, dur };
    return {
      duration: dur,
      sfx: [{ t: 0, name: "whoosh2", gain: -8 }, { t: 0.42, name: "impact", gain: -14 }, { t: 0.45, name: "pop", gain: -8 },
            ...people.map((_, i) => ({ t: 0.7 + i * 0.12, name: "pop2", gain: -12 })),
            { t: 1.45, name: "coin", gain: -8 },
            ...(p.exit ? [{ t: dur - 0.3, name: "whoosh2", gain: -14 }] : [])],
    };
  },

  async frame(t) {
    const s = S, u = s.u, p = s.p;
    const ex = p.exit ? easeInBack(seg(t, s.dur - 0.3, s.dur), 1.6) : 0;
    const k = seg(t, 0, 0.35);
    const all = Math.max(0.001, 1 - ex);
    s.map.style.transform = `perspective(${s.W * 2}px) rotateX(${lerp(60, 18, easeOutCubic(k))}deg) scale(${(k <= 0 ? 0.001 : spring(k, 1.4, 6)) * all})`;
    s.map.style.opacity = clamp(k * 4);
    const pk = seg(t, 0.25, 0.45);
    const land = 1 + 0.18 * Math.sin(Math.PI * seg(t, 0.45, 0.6));
    s.pin.style.opacity = pk > 0 ? all : 0;
    s.pin.style.transform = `translateY(${-(1 - easeInCubic(pk)) * 30 * u}px) scale(${all / land}, ${all * land})`;
    s.ripples.forEach((r, i) => {
      const rk = seg(t, 0.45 + i * 0.35, 1.25 + i * 0.35);
      r.style.opacity = rk > 0 && rk < 1 ? (1 - rk) * all : 0;
      r.style.transform = `scale(${0.3 + 1.4 * easeOutCubic(rk)})`;
    });
    s.people.forEach(({ e, ln }, i) => {
      const kk = seg(t, 0.7 + i * 0.12, 1.0 + i * 0.12);
      e.style.opacity = kk > 0 ? all : 0;
      e.style.transform = `scale(${kk > 0 ? easeOutBack(kk, 2.6) * all : 0.001}) translateY(${Math.sin(t * 3 + i) * 0.6 * u}px)`;
      ln.setAttribute("opacity", clamp(seg(t, 0.8 + i * 0.12, 1.0 + i * 0.12)) * 0.8 * all);
    });
    const ck = seg(t, 1.4, 1.65);
    s.count.style.transform = `translateX(-50%) scale(${ck > 0 ? easeOutBack(ck, 2.4) * all : 0.001})`;
  },
};
