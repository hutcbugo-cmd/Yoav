// PleaChat ("I begged her to fit me in, then she set me up with a friend of hers"): pleading messages pile up
// fast, then the reply bubble lands with a referral.
// params: accent, pleas [...], reply, reply_at, hold, exit
import { seg, lerp, clamp, easeOutBack, easeInBack, easeOutCubic, spring } from "./ease.js";
import { el, stage, card } from "./ui.js";

let S;

export default {
  async setup(root, params, W, H) {
    const p = Object.assign({ accent: "#FF2E8B", pleas: ["היי!! יש מצב היום?", "מתחננת 🥺", "רק 10 דקות!!", "פליייייז"],
      reply: "אין לי… אבל חברה שלי פנויה", reply_at: 1.6, step: 0.25, hold: 0.5, exit: true }, params);
    p.pleas = p.pleas.map((x) => x.replace(/\s*\p{Extended_Pictographic}\s*/gu, ""));  // no emoji (client rule)
    const u = W / 100;
    const st = stage(root, W, H);
    const cw = 80 * u, top = H * 0.5 - 38 * u;
    const box = el("div", `position:absolute;left:${(W - cw) / 2}px;top:${top}px;width:${cw}px;height:${70 * u}px;overflow:hidden;
      ${card(u, "background:#f3efe9")}`);
    const bubbles = p.pleas.map((txt, i) => {
      const b = el("div", `position:absolute;left:${4 * u}px;top:${(5 + i * 11) * u}px;background:#ffd9ea;color:#2a1b22;
        border-radius:${4 * u}px ${4 * u}px ${4 * u}px ${1 * u}px;padding:${1.8 * u}px ${3.6 * u}px;font:800 ${5 * u}px Assistant;
        white-space:nowrap;opacity:0;transform-origin:0% 100%`, txt);
      box.append(b);
      return b;
    });
    const rep = el("div", `position:absolute;right:${4 * u}px;top:${(7 + p.pleas.length * 11) * u}px;max-width:${60 * u}px;background:#fff;
      color:#2a1b22;border-radius:${4 * u}px ${4 * u}px ${1 * u}px ${4 * u}px;padding:${1.8 * u}px ${3.6 * u}px;font:800 ${5 * u}px Assistant;
      opacity:0;transform-origin:100% 100%;box-shadow:0 ${0.5 * u}px ${1.4 * u}px rgba(0,0,0,.12)`, p.reply);
    box.append(rep);
    st.append(box);
    const dur = p.reply_at + 0.4 + p.hold + (p.exit ? 0.3 : 0);
    S = { p, u, W, H, box, bubbles, rep, dur };
    return {
      duration: dur,
      sfx: [{ t: 0, name: "pop", gain: -8 }, ...bubbles.map((_, i) => ({ t: 0.25 + i * p.step, name: "pop2", gain: -10 + i })),
            { t: p.reply_at, name: "pop", gain: -4 }, ...(p.exit ? [{ t: dur - 0.3, name: "whoosh2", gain: -14 }] : [])],
    };
  },

  async frame(t) {
    const s = S, u = s.u, p = s.p;
    const ex = p.exit ? easeInBack(seg(t, s.dur - 0.3, s.dur), 1.6) : 0;
    const k = seg(t, 0, 0.3);
    s.box.style.transform = `scale(${Math.max(0.001, (k <= 0 ? 0 : spring(k, 1.5, 5.5)) * (1 - ex))})`;
    s.bubbles.forEach((b, i) => {
      const bk = seg(t, 0.25 + i * p.step, 0.45 + i * p.step);
      b.style.opacity = bk > 0 ? 1 : 0;
      b.style.transform = `scale(${bk > 0 ? easeOutBack(bk, 2.6) : 0.001}) rotate(${(i % 2 ? 2 : -2) * (1 - bk)}deg)
        translateX(${Math.sin(t * 40 + i) * 0.4 * u * (t < p.reply_at ? 1 : 0)}px)`;
    });
    const rk = seg(t, p.reply_at, p.reply_at + 0.28);
    s.rep.style.opacity = rk > 0 ? 1 : 0;
    s.rep.style.transform = `scale(${rk > 0 ? easeOutBack(rk, 2.2) : 0.001})`;
  },
};
