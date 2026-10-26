// DaysCounter ("three-four weeks"): a tear-off calendar whose pages fly off faster and faster while a
// day counter runs up, then a pill with the spoken answer stamps on.
// params: accent, target (days), label, unit, flips_end, label_at, hold, exit
import { seg, lerp, clamp, easeOutBack, easeInBack, easeOutCubic, easeInOutCubic, spring } from "./ease.js";
import { el, stage, card, pill } from "./ui.js";

let S;

export default {
  async setup(root, params, W, H) {
    const p = Object.assign({ accent: "#FF2E8B", target: 28, label: "3–4 שבועות!", unit: "ימים",
      flips_end: 1.5, label_at: 1.6, hold: 0.5, exit: true }, params);
    const u = W / 100;
    const st = stage(root, W, H);
    const cw = 50 * u, ch = 52 * u;
    const pad = el("div", `position:absolute;left:${(W - cw) / 2}px;top:${H * 0.47 - ch / 2}px;width:${cw}px;height:${ch}px;
      perspective:${W * 2}px`);
    const back = el("div", `position:absolute;inset:0;${card(u)}`);
    const rings = el("div", `position:absolute;left:0;right:0;top:${-2.4 * u}px;display:flex;justify-content:space-around;
      padding:0 ${8 * u}px;z-index:30`, [0, 1, 2].map(() => `<div style="width:${3 * u}px;height:${6 * u}px;border-radius:${2 * u}px;
      background:linear-gradient(#bbb,#666)"></div>`).join(""));
    const page = (n) => el("div", `position:absolute;inset:0;border-radius:${6 * u}px;overflow:hidden;background:#fff;
      transform-origin:50% 0%;backface-visibility:hidden;box-shadow:0 ${0.4 * u}px ${1.2 * u}px rgba(0,0,0,.12)`,
      `<div style="height:${13 * u}px;background:linear-gradient(90deg,#ff6aa8,${p.accent})"></div>
       <div style="text-align:center;font:800 ${24 * u}px Assistant;color:#2a1b22;line-height:${30 * u}px">${n}</div>
       <div style="text-align:center;font:700 ${5 * u}px Assistant;color:#8a6b78">יום</div>`);
    const flips = 12;
    const pages = Array.from({ length: flips + 1 }, (_, i) => page(1 + Math.round((p.target - 1) * i / flips)));
    pages.forEach((pg, i) => { pg.style.zIndex = 20 - i; pad.append(pg); });
    pad.prepend(back); pad.append(rings);
    const counter = el("div", `position:absolute;left:0;right:0;top:${H * 0.47 + ch / 2 + 3 * u}px;text-align:center;
      font:800 ${9 * u}px Assistant;color:#fff;text-shadow:0 ${0.6 * u}px ${2.4 * u}px rgba(0,0,0,.5)`);
    const lab = el("div", `position:absolute;left:50%;top:${H * 0.47 - 6 * u}px;white-space:nowrap;z-index:40;
      ${pill(u, p.accent, `font-size:${10 * u}px;padding:${2 * u}px ${6 * u}px`)}`, p.label);
    st.append(pad, counter, lab);
    // flip times: ease-in-out spacing (slow, fast, slow) between 0.4 s and flips_end
    const tf = Array.from({ length: flips }, (_, i) => lerp(0.4, p.flips_end, easeInOutCubic((i + 0.5) / flips)));
    const dur = p.label_at + 0.35 + p.hold + (p.exit ? 0.3 : 0);
    S = { p, u, W, H, pad, pages, counter, lab, tf, dur };
    return {
      duration: dur,
      sfx: [{ t: 0, name: "pop", gain: -6 }, ...tf.map((t, i) => ({ t, name: "click", gain: -15 + (i % 3) })),
            { t: p.label_at + 0.08, name: "impact", gain: -10 }, { t: p.label_at + 0.1, name: "pop2", gain: -8 },
            ...(p.exit ? [{ t: dur - 0.3, name: "whoosh2", gain: -14 }] : [])],
    };
  },

  async frame(t) {
    const s = S, u = s.u, p = s.p;
    const ex = p.exit ? easeInBack(seg(t, s.dur - 0.3, s.dur), 1.6) : 0;
    const k = seg(t, 0, 0.35);
    s.pad.style.transform = `scale(${Math.max(0.001, (k <= 0 ? 0 : spring(k, 1.5, 5.5)) * (1 - ex))}) rotate(${lerp(-8, 0, easeOutCubic(k))}deg)`;
    let shown = 0;
    s.pages.forEach((pg, i) => {
      if (i >= s.tf.length) return;
      const fk = seg(t, s.tf[i] - 0.05, s.tf[i] + 0.22);
      if (fk >= 1) { pg.style.opacity = 0; shown = i + 1; return; }
      pg.style.opacity = 1;
      pg.style.transform = `rotateX(${lerp(0, 110, easeInOutCubic(fk))}deg) translateY(${-fk * 8 * u}px)`;
    });
    const days = Math.round(lerp(1, p.target, clamp(seg(t, 0.4, p.flips_end + 0.15))));
    s.counter.textContent = t > 0.35 ? (days < 2 ? "יום 1" : `${days} ${p.unit}`) : "";
    s.counter.style.opacity = 1 - ex;
    const lk = seg(t, p.label_at, p.label_at + 0.16);
    s.lab.style.opacity = lk > 0 ? clamp(lk * 3) * (1 - ex) : 0;
    s.lab.style.transform = `translate(-50%,-50%) rotate(-5deg) scale(${lerp(2.2, 1, easeOutCubic(lk)) *
      (1 + 0.06 * Math.sin(Math.PI * seg(t, p.label_at + 0.16, p.label_at + 0.34))) * (1 - ex) + 0.001})`;
  },
};
