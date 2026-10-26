// RoadTrip ("I moved to the centre … so I drove back to Be'er Sheva for a manicure"): a map with two
// pins, a dashed road draws, a car drives it while a km counter runs, and on arrival a polished nail
// pops with "just for a manicure?!".
// params: accent, from, to, km, drive_at, nail_at, punch, hold, exit
import { seg, lerp, clamp, easeOutBack, easeInBack, easeOutCubic, easeInOutCubic, spring, sparkle } from "./ease.js";
import { el, stage, card, icon, pill, nailTile, canvasLayer } from "./ui.js";

let S;

export default {
  async setup(root, params, W, H) {
    const p = Object.assign({ accent: "#FF2E8B", from: "מרכז", to: "באר שבע", km: 110, drive_at: 0.9, nail_at: 2.1,
      punch: "בשביל לק?!", hold: 0.5, exit: true }, params);
    const u = W / 100;
    const st = stage(root, W, H);
    const mw = 70 * u, mh = 74 * u, mx = (W - mw) / 2, my = H * 0.47 - mh / 2;
    const map = el("div", `position:absolute;left:${mx}px;top:${my}px;width:${mw}px;height:${mh}px;overflow:hidden;
      ${card(u, "background:#fdf6ee")}`, `<svg viewBox="0 0 100 106" width="${mw}" height="${mh}" preserveAspectRatio="none">
      <path d="M78 0 C70 30 86 60 74 106" stroke="#bfe3f6" stroke-width="16" fill="none" opacity=".7"/>
      <ellipse cx="22" cy="80" rx="20" ry="16" fill="#f3e3c6"/><ellipse cx="30" cy="30" rx="16" ry="10" fill="#d4efd9"/>
      <g stroke="#fff" stroke-width="2.4"><path d="M0 40H100M0 72H100M40 0V106M66 0V106"/></g></svg>`);
    // road from the centre (top) to Be'er Sheva (bottom), in map units
    const P0 = [62, 16], P1 = [30, 90];
    const road = `M${P0[0]} ${P0[1]} C 80 40, 20 50, ${P1[0]} ${P1[1]}`;
    const ov = el("div", "position:absolute;inset:0", `<svg viewBox="0 0 100 106" width="${mw}" height="${mh}" preserveAspectRatio="none">
      <path class="rd" d="${road}" stroke="${p.accent}" stroke-width="2.6" stroke-dasharray="4 3" fill="none" stroke-linecap="round"/></svg>`);
    map.append(ov);
    const rdPath = ov.querySelector(".rd");
    const len = rdPath.getTotalLength();
    rdPath.setAttribute("stroke-dasharray", `${len}`);
    const toPx = ([x, y]) => [mx + x / 100 * mw, my + y / 106 * mh];
    const pinEl = (pt, label, c) => {
      const [x, y] = toPx(pt), s = 10 * u;
      const e = el("div", `position:absolute;left:${x - s / 2}px;top:${y - s}px;width:${s}px;height:${s}px;transform-origin:50% 100%`,
        icon("pin", s, c));
      const l = el("div", `position:absolute;left:${x}px;top:${y + 1 * u}px;transform:translateX(-50%);white-space:nowrap;
        background:#fff;border-radius:${3 * u}px;padding:${0.6 * u}px ${2.4 * u}px;font:800 ${4.6 * u}px Assistant;color:#2a1b22;
        box-shadow:0 ${0.4 * u}px ${1.2 * u}px rgba(0,0,0,.2)`, label);
      st.append(e, l);
      return [e, l];
    };
    st.append(map);
    const pa = pinEl(P0, p.from, "#6c58d8"), pb = pinEl(P1, p.to, p.accent);
    const car = el("div", `position:absolute;width:${12 * u}px;height:${7 * u}px;margin:${-3.5 * u}px 0 0 ${-6 * u}px`,
      `<svg viewBox="0 0 48 28" width="${12 * u}" height="${7 * u}"><path d="M4 18 L8 9 Q10 5 15 5 H31 Q36 5 39 9 L44 16 Q46 18 46 21 V23 H2 V21 Q2 19 4 18z"
       fill="${p.accent}"/><path d="M12 10 Q13 8 16 8 H23 V14 H10z M26 8 H31 Q34 8 36 11 L38 14 H26z" fill="#dff3ff"/>
       <circle cx="13" cy="23" r="4.5" fill="#2a1b22"/><circle cx="35" cy="23" r="4.5" fill="#2a1b22"/></svg>`);
    const kmEl = el("div", `position:absolute;left:50%;top:${my - 7 * u}px;white-space:nowrap;direction:rtl;
      ${pill(u, "#2a1b22", `font-size:${6 * u}px;padding:${1.4 * u}px ${4 * u}px;box-shadow:none`)}`);
    const nail = el("div", `position:absolute;left:${W / 2 - 9 * u}px;top:${H * 0.47 - 15 * u}px;width:${18 * u}px;height:${26 * u}px;
      ${nailTile(p.accent, `${9 * u}px ${9 * u}px ${3 * u}px ${3 * u}px`)};border:${1 * u}px solid #fff;
      box-shadow:0 ${1.4 * u}px ${4 * u}px rgba(0,0,0,.3);opacity:0`);
    const punch = el("div", `position:absolute;left:50%;top:${H * 0.47 + 14 * u}px;white-space:nowrap;opacity:0;
      ${pill(u, p.accent, `font-size:${9 * u}px;padding:${2 * u}px ${5.4 * u}px`)}`, p.punch);
    st.append(car, kmEl, nail, punch);
    const fx = canvasLayer(st, W, H);
    const dur = p.nail_at + 0.45 + p.hold + (p.exit ? 0.3 : 0);
    S = { p, u, W, H, map, pa, pb, rdPath, len, car, kmEl, nail, punch, fx, mx, my, mw, mh, dur };
    return {
      duration: dur,
      sfx: [{ t: 0, name: "whoosh2", gain: -8 }, { t: 0.3, name: "pop2", gain: -12 }, { t: 0.45, name: "pop2", gain: -12 },
            { t: p.drive_at, name: "whoosh", gain: -6 }, { t: p.nail_at - 0.1, name: "click", gain: -8 },
            { t: p.nail_at, name: "impact", gain: -10 }, { t: p.nail_at + 0.05, name: "sparkle", gain: -6 },
            { t: p.nail_at + 0.25, name: "pop", gain: -6 },
            ...(p.exit ? [{ t: dur - 0.3, name: "whoosh2", gain: -14 }] : [])],
    };
  },

  async frame(t) {
    const s = S, u = s.u, p = s.p;
    const ex = p.exit ? easeInBack(seg(t, s.dur - 0.3, s.dur), 1.6) : 0;
    const k = seg(t, 0, 0.35);
    const sc = Math.max(0.001, (k <= 0 ? 0 : spring(k, 1.4, 6)) * (1 - ex));
    const fade = seg(t, p.nail_at - 0.15, p.nail_at + 0.1);  // map dims behind the punchline
    s.map.style.transform = `scale(${sc})`;
    s.map.style.filter = `brightness(${1 - 0.35 * fade})`;
    [[s.pa, 0.3], [s.pb, 0.45]].forEach(([[pin, lab], t0]) => {
      const pk = seg(t, t0, t0 + 0.25);
      pin.style.transform = `translateY(${-(1 - easeOutCubic(pk)) * 8 * u}px) scale(${pk > 0 ? sc : 0.001})`;
      pin.style.opacity = pk > 0 ? 1 - fade * 0.6 : 0;
      lab.style.opacity = pk > 0 ? (1 - ex) * (1 - fade * 0.6) : 0;
    });
    const dk = easeInOutCubic(seg(t, p.drive_at, p.nail_at - 0.1));
    s.rdPath.setAttribute("stroke-dashoffset", s.len * (1 - seg(t, 0.5, p.drive_at + 0.2)));
    const pt = s.rdPath.getPointAtLength(s.len * dk), pt2 = s.rdPath.getPointAtLength(Math.min(s.len, s.len * dk + 1));
    const ang = Math.atan2((pt2.y - pt.y) * s.mh / 106, (pt2.x - pt.x) * s.mw / 100) * 180 / Math.PI;
    s.car.style.left = `${s.mx + pt.x / 100 * s.mw}px`;
    s.car.style.top = `${s.my + pt.y / 106 * s.mh}px`;
    s.car.style.opacity = t > p.drive_at - 0.1 ? (1 - ex) * (1 - fade) : 0;
    s.car.style.transform = `rotate(${ang > 90 || ang < -90 ? ang - 180 : ang}deg) scaleX(${ang > 90 || ang < -90 ? -1 : 1})
      translateY(${Math.sin(t * 40) * 0.3 * u}px)`;
    const km = Math.round(p.km * dk);
    s.kmEl.textContent = `${km} ק"מ`;
    s.kmEl.style.opacity = t > p.drive_at ? 1 - ex : 0;
    s.kmEl.style.transform = `translateX(-50%) scale(${1 + 0.08 * Math.sin(Math.PI * seg(t, p.nail_at - 0.15, p.nail_at))})`;
    const nk = seg(t, p.nail_at, p.nail_at + 0.3);
    s.nail.style.opacity = nk > 0 ? 1 - ex : 0;
    s.nail.style.transform = `scale(${nk > 0 ? easeOutBack(nk, 2.6) * (1 - ex) + 0.001 : 0.001}) rotate(${lerp(-20, 6, easeOutCubic(nk))}deg)`;
    const pk2 = seg(t, p.nail_at + 0.2, p.nail_at + 0.4);
    s.punch.style.opacity = pk2 > 0 ? 1 - ex : 0;
    s.punch.style.transform = `translateX(-50%) rotate(-4deg) scale(${pk2 > 0 ? lerp(1.8, 1, easeOutCubic(pk2)) * (1 - ex) + 0.001 : 0.001})`;
    s.fx.clearRect(0, 0, s.W, s.H);
    sparkle(s.fx, s.W * 0.64, s.H * 0.3, s.W * 0.08, seg(t, p.nail_at + 0.05, p.nail_at + 0.55));
    sparkle(s.fx, s.W * 0.36, s.H * 0.38, s.W * 0.06, seg(t, p.nail_at + 0.15, p.nail_at + 0.65));
  },
};
