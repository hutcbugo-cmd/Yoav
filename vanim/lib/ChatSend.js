// ChatSend ("send her the design you want"): a chat bubble carrying a nail-design photo flies up and
// lands, its ticks turn read, the technician types and replies.
// params: accent, caption, reply, photo (optional repo path), colors, hold, exit
import { seg, lerp, clamp, easeOutBack, easeInBack, easeOutCubic, spring } from "./ease.js";
import { el, stage, nailTile } from "./ui.js";

let S;

export default {
  async setup(root, params, W, H) {
    const p = Object.assign({ accent: "#FF2E8B", caption: "בדיוק כזה!", reply: "סגור, מושלם!",
      colors: ["#FF2E8B", "#F7B2CC", "#C21E6A"], photo: "", hold: 0.8, exit: true }, params);
    const u = W / 100;
    const st = stage(root, W, H);
    // outgoing (left in an RTL chat), with the photo
    const out = el("div", `position:absolute;left:${8 * u}px;top:${16 * u}px;width:${56 * u}px;padding:${2 * u}px;
      background:linear-gradient(160deg, #ff5fa2, ${p.accent});border-radius:${6 * u}px ${6 * u}px ${6 * u}px ${1.5 * u}px;
      box-shadow:0 ${1.6 * u}px ${5 * u}px rgba(120,20,70,.35);transform-origin:0% 100%`);
    const photo = el("div", `height:${34 * u}px;border-radius:${4.4 * u}px;overflow:hidden;position:relative;
      background:linear-gradient(150deg, #fbe3ec, #f3c6d6);display:flex;align-items:flex-end;justify-content:center;
      gap:${2.4 * u}px;padding-bottom:${3 * u}px;box-sizing:border-box`);
    if (p.photo) photo.innerHTML = `<img src="/${p.photo}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">`;
    else p.colors.forEach((c, i) => photo.append(el("div", `width:${10 * u}px;height:${(19 + (i === 1 ? 4 : 0)) * u}px;
      ${nailTile(c, `${5 * u}px ${5 * u}px ${2 * u}px ${2 * u}px`)};box-shadow:0 ${0.6 * u}px ${1.5 * u}px rgba(0,0,0,.2)`)));
    const meta = el("div", `display:flex;justify-content:space-between;align-items:center;color:#fff;
      font:800 ${5.4 * u}px Assistant;padding:${1.6 * u}px ${1.5 * u}px 0`,
      `<span>${p.caption}</span><span class="ticks" style="font:800 ${4.2 * u}px Assistant;direction:ltr;color:rgba(255,255,255,.6)">✓✓</span>`);
    out.append(photo, meta);
    // incoming (right)
    const inc = el("div", `position:absolute;right:${8 * u}px;top:${66 * u}px;background:#fff;color:#2a1b22;
      border-radius:${6 * u}px ${6 * u}px ${1.5 * u}px ${6 * u}px;padding:${3 * u}px ${5 * u}px;font:800 ${5.6 * u}px Assistant;
      box-shadow:0 ${1.6 * u}px ${5 * u}px rgba(120,20,70,.25);transform-origin:100% 100%;white-space:nowrap`);
    const dots = el("div", `display:flex;gap:${1.6 * u}px;direction:ltr;padding:${1.4 * u}px 0`);
    const dotEls = [0, 1, 2].map(() => { const d = el("div", `width:${2.4 * u}px;height:${2.4 * u}px;border-radius:50%;background:#c9a9b6`); dots.append(d); return d; });
    const txt = el("div", "display:none", p.reply);
    inc.append(dots, txt);
    st.append(out, inc);
    const dur = 1.75 + p.hold + (p.exit ? 0.3 : 0);
    S = { p, u, W, H, out, inc, dots, dotEls, txt, ticks: meta.querySelector(".ticks"), dur };
    return {
      duration: dur,
      sfx: [{ t: 0.0, name: "whoosh2", gain: -6 }, { t: 0.3, name: "pop", gain: -6 },
            { t: 0.7, name: "click", gain: -10 }, { t: 0.9, name: "pop2", gain: -14 }, { t: 1.5, name: "pop2", gain: -6 },
            ...(p.exit ? [{ t: dur - 0.3, name: "whoosh2", gain: -14 }] : [])],
    };
  },

  async frame(t) {
    const s = S, u = s.u, p = s.p;
    const ex = p.exit ? easeInBack(seg(t, s.dur - 0.3, s.dur), 1.6) : 0;
    const k = seg(t, 0, 0.42);
    s.out.style.transform = `translateY(${(1 - easeOutCubic(k)) * 40 * u}px) rotate(${lerp(-8, 0, easeOutCubic(k))}deg)
      scale(${Math.max(0.001, (k <= 0 ? 0 : spring(k, 1.4, 5)) * (1 - ex))})`;
    s.out.style.opacity = clamp(k * 4);
    s.ticks.style.color = t > 0.7 ? "#ffffff" : "rgba(255,255,255,.55)";
    s.ticks.style.transform = `scale(${1 + 0.35 * Math.sin(Math.PI * seg(t, 0.7, 0.9))})`;
    const ik = seg(t, 0.9, 1.1);
    s.inc.style.opacity = ik > 0 ? 1 : 0;
    const typing = t < 1.5;
    s.dots.style.display = typing ? "flex" : "none";
    s.txt.style.display = typing ? "none" : "block";
    s.dotEls.forEach((d, i) => { d.style.transform = `translateY(${-Math.max(0, Math.sin((t - i * 0.12) * 12)) * 1.2 * u}px)`; });
    const pop = t >= 1.5 ? 1 + 0.08 * Math.sin(Math.PI * seg(t, 1.5, 1.68)) : 1;
    s.inc.style.transform = `scale(${Math.max(0.001, (ik <= 0 ? 0 : easeOutBack(ik, 2.2)) * pop * (1 - ex))})`;
  },
};
