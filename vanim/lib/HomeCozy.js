// HomeCozy ("no energy to leave the house"): a little house bounces in, its door swings shut,
// the window glows warm, a moon rises behind it and sleepy "Z z z" drift up from the roof.
// params: accent, door_at, hold, exit
import { seg, lerp, clamp, easeOutBack, easeInBack, easeOutCubic, easeInOutSine, spring } from "./ease.js";
import { el, stage } from "./ui.js";

let S;

export default {
  async setup(root, params, W, H) {
    const p = Object.assign({ accent: "#FF2E8B", door_at: 0.55, hold: 1.2, exit: true }, params);
    const u = W / 100;
    const st = stage(root, W, H);
    const svg = el("div", `position:absolute;inset:0`, `
<svg viewBox="0 0 100 100" width="${W}" height="${H}" style="overflow:visible">
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFE7A3" stop-opacity=".95"/>
      <stop offset="1" stop-color="#FFE7A3" stop-opacity="0"/></radialGradient>
    <linearGradient id="roof" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff74ad"/>
      <stop offset="1" stop-color="${p.accent}"/></linearGradient>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#f6e6ee"/></linearGradient>
    <filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.6" stdDeviation="2"
      flood-color="#5a0f33" flood-opacity=".35"/></filter>
  </defs>
  <g class="moon"><path d="M77 17a9 9 0 1 0 5 13 7 7 0 0 1-5-13z" fill="#FFF3C4"/></g>
  <g class="house" filter="url(#sh)">
    <rect x="61" y="27" width="6" height="12" rx="1" fill="#d81b6a"/>
    <rect x="27" y="47" width="46" height="34" rx="3" fill="url(#wall)"/>
    <path d="M21 50 L50 25 L79 50 Q80 53 77 53 L23 53 Q20 53 21 50z" fill="url(#roof)"/>
    <circle class="wglow" cx="38" cy="63" r="13" fill="url(#glow)" opacity="0"/>
    <rect x="32" y="57" width="12" height="11" rx="2" class="win" fill="#5b3d4c"/>
    <path d="M38 57v11M32 62.5h12" stroke="#fff" stroke-width="1.4"/>
    <rect x="53" y="60" width="12" height="21" rx="1.6" fill="#3a2230"/>
    <g class="door"><rect x="53" y="60" width="12" height="21" rx="1.6" fill="#ff8fbf"/>
      <circle cx="62.5" cy="71" r="1" fill="#fff"/></g>
  </g>
</svg>`);
    st.append(svg);
    const zs = ["Z", "z", "Z"].map((c, i) => {
      const z = el("div", `position:absolute;left:${(66 + i * 7) * u}px;top:${(24 - i * 4) * u}px;
        font:800 ${(9 + i * 2.5) * u}px Assistant;color:#fff;text-shadow:0 ${0.6 * u}px ${2 * u}px rgba(90,15,51,.6);opacity:0`, c);
      st.append(z);
      return z;
    });
    const dur = p.door_at + 0.6 + p.hold + (p.exit ? 0.3 : 0);
    S = { p, u, W, H, st, svg, zs, dur,
          house: svg.querySelector(".house"), door: svg.querySelector(".door"), win: svg.querySelector(".win"),
          wglow: svg.querySelector(".wglow"), moon: svg.querySelector(".moon") };
    return {
      duration: dur,
      sfx: [{ t: 0, name: "pop", gain: -6 }, { t: p.door_at + 0.16, name: "click", gain: -4 },
            { t: p.door_at + 0.45, name: "whoosh2", gain: -18 },
            ...(p.exit ? [{ t: dur - 0.3, name: "whoosh2", gain: -14 }] : [])],
    };
  },

  async frame(t) {
    const s = S, p = s.p, u = s.u;
    const k = seg(t, 0, 0.4);
    const out = p.exit ? easeInBack(seg(t, s.dur - 0.3, s.dur), 1.6) : 0;
    const sc = Math.max(0.001, (k <= 0 ? 0 : spring(k, 1.5, 5)) * (1 - out));
    // squash-and-stretch landing from the bottom centre
    const sq = 1 + 0.1 * Math.sin(Math.PI * seg(t, 0.25, 0.45));
    s.st.style.transformOrigin = "50% 85%";
    s.st.style.transform = `scale(${sc * sq}, ${sc / sq})`;
    const dk = seg(t, p.door_at, p.door_at + 0.18);  // door swings shut (perspective-ish scaleX)
    s.door.setAttribute("transform", `translate(53 0) scale(${lerp(0.12, 1, easeOutBack(dk, 2.5))} 1) translate(-53 0)`);
    const lk = seg(t, p.door_at + 0.2, p.door_at + 0.45);
    s.win.setAttribute("fill", lk > 0.5 ? "#FFD66E" : "#5b3d4c");
    s.wglow.setAttribute("opacity", lk);
    const mk = easeOutCubic(seg(t, 0.3, 0.9));
    s.moon.setAttribute("transform", `translate(0 ${lerp(10, 0, mk)})`);
    s.moon.setAttribute("opacity", mk);
    s.zs.forEach((z, i) => {
      const t0 = p.door_at + 0.4 + i * 0.32, zk = seg(t, t0, t0 + 1.3);
      z.style.opacity = zk > 0 && zk < 1 ? Math.sin(Math.PI * zk) * (1 - out) : 0;
      z.style.transform = `translate(${Math.sin(zk * 6) * 2 * u}px, ${-zk * 14 * u}px) rotate(${-10 + 20 * easeInOutSine(zk)}deg)`;
    });
  },
};
