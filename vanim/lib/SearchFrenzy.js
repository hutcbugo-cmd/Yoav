// SearchFrenzy ("I started searching all over the internet"): a search box types the query, result cards
// shuffle in one after another and each gets stamped "no availability".
// params: accent, query, results [...], stamp, hold, exit
import { seg, lerp, clamp, easeOutBack, easeInBack, easeOutCubic, spring } from "./ease.js";
import { el, stage, card } from "./ui.js";

let S;
const RED = "#E5243B";

export default {
  async setup(root, params, W, H) {
    const p = Object.assign({ accent: "#FF2E8B", query: "מניקור דחוף היום", results: ["סטודיו ציפורניים", "מניקור ג'ל במרכז", "בר לק ליד הבית"],
      stamp: "אין זמינות", step: 0.45, hold: 0.4, exit: true }, params);
    const u = W / 100;
    const st = stage(root, W, H);
    const cw = 80 * u, x0 = (W - cw) / 2, y0 = H * 0.5 - 36 * u;
    const bar = el("div", `position:absolute;left:${x0}px;top:${y0}px;width:${cw}px;height:${12 * u}px;display:flex;align-items:center;
      gap:${2.4 * u}px;padding:0 ${4 * u}px;box-sizing:border-box;${card(u, `border-radius:${6 * u}px`)};font:700 ${5 * u}px Assistant;color:#2a1b22`);
    bar.innerHTML = `<svg viewBox="0 0 24 24" width="${5.5 * u}" height="${5.5 * u}"><circle cx="10.5" cy="10.5" r="6.5" stroke="#4285f4"
      stroke-width="2.6" fill="none"/><path d="M15.5 15.5L21 21" stroke="#4285f4" stroke-width="2.6" stroke-linecap="round"/></svg><span class="q"></span>`;
    const cards = p.results.map((r, i) => {
      const c = el("div", `position:absolute;left:${x0}px;top:${y0 + (16 + i * 15) * u}px;width:${cw}px;height:${12.5 * u}px;padding:${2 * u}px ${4 * u}px;
        box-sizing:border-box;opacity:0;${card(u, `border-radius:${4 * u}px`)}`,
        `<div style="font:800 ${4.8 * u}px Assistant;color:#1a0dab">${r}</div>
         <div style="font:700 ${3.4 * u}px Assistant;color:#5f6368">★ 4.${8 - i} · תל אביב</div>`);
      const sp = el("div", `position:absolute;left:${3 * u}px;top:50%;font:800 ${4.8 * u}px Assistant;color:${RED};
        border:${0.7 * u}px solid ${RED};border-radius:${2 * u}px;padding:0 ${2 * u}px;background:#fff;opacity:0`, p.stamp);
      c.append(sp);
      st.append(c);
      return { c, sp };
    });
    st.append(bar);
    const t1 = 0.25 + [...p.query].length * 0.04;
    const last = t1 + 0.2 + (p.results.length - 1) * p.step + 0.25;
    const dur = last + 0.3 + p.hold + (p.exit ? 0.3 : 0);
    S = { p, u, W, H, bar, cards, t1, dur, q: bar.querySelector(".q") };
    return {
      duration: dur,
      sfx: [{ t: 0, name: "pop", gain: -8 },
            ...[...p.query].filter((c) => c !== " ").map((_, i) => ({ t: 0.25 + i * 0.045, name: "click", gain: -20 })),
            ...cards.flatMap((_, i) => [{ t: t1 + 0.2 + i * p.step, name: "pop2", gain: -12 },
                                        { t: t1 + 0.45 + i * p.step, name: "impact", gain: -16 }]),
            ...(p.exit ? [{ t: dur - 0.3, name: "whoosh2", gain: -14 }] : [])],
    };
  },

  async frame(t) {
    const s = S, u = s.u, p = s.p;
    const ex = p.exit ? easeInBack(seg(t, s.dur - 0.3, s.dur), 1.6) : 0;
    const k = seg(t, 0, 0.3);
    const sc = Math.max(0.001, (k <= 0 ? 0 : spring(k, 1.5, 5.5)) * (1 - ex));
    s.bar.style.transform = `scale(${sc})`;
    const q = [...p.query];
    s.q.textContent = q.slice(0, Math.floor(q.length * seg(t, 0.25, s.t1))).join("");
    s.cards.forEach(({ c, sp }, i) => {
      const ck = seg(t, s.t1 + 0.2 + i * p.step, s.t1 + 0.45 + i * p.step);
      c.style.opacity = ck > 0 ? 1 - ex : 0;
      c.style.transform = `translateY(${(1 - easeOutCubic(ck)) * 8 * u}px) scale(${sc})`;
      const sk = seg(t, s.t1 + 0.45 + i * p.step, s.t1 + 0.6 + i * p.step);
      sp.style.opacity = sk > 0 ? 1 : 0;
      sp.style.transform = `translateY(-50%) rotate(-8deg) scale(${sk > 0 ? lerp(1.8, 1, easeOutCubic(sk)) : 0.001})`;
      c.style.filter = `grayscale(${0.7 * sk})`;
    });
  },
};
