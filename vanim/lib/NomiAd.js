// NomiAd: a fast-cut 9:16 ad in the style of the "Agent for All" reference (docs/style-references.md, reference 4):
// one full-frame shot per thought, hard cuts with a small punch-in, warm daylight still-life sets (table surface,
// window-blind shadows, light leak, grain), short captions with one highlighted word, a headline over the hook and
// a brand-colour end card. Every shot is drawn here (no stock footage).
// params: shots [{id, t}] (shot start, s), caps [{t, e, text, hl:[word idx]}], headline [l1, l2], end, logo, photos, accent
import { seg, lerp, clamp, easeOutBack, easeOutCubic, easeInOutCubic, spring, sparkle, shade } from "./ease.js";
import { el, star, icon, nailTile, burst, canvasLayer } from "./ui.js";

let S;
const INK = "#2a1b22";
const pop = (k, f = 1.5, d = 5.5) => (k <= 0 ? 0.001 : spring(k, f, d));
const show = (e, k) => { e.style.opacity = k > 0 ? 1 : 0; };

// ---------------------------------------------------------------- sets (backgrounds)
function table(o, tone = "#f0dcc4") {  // warm table top in daylight: surface, blind shadows, light leak
  const u = S.u;
  o.append(el("div", `position:absolute;inset:-6%;background:
      radial-gradient(ellipse 70% 50% at 30% 20%, ${shade(tone, 0.35)} 0%, ${tone} 45%, ${shade(tone, -0.22)} 100%)`));
  o.append(el("div", `position:absolute;inset:-6%;opacity:.32;background:repeating-linear-gradient(118deg,
      rgba(0,0,0,0) 0 ${7 * u}px, rgba(90,50,20,.22) ${7 * u}px ${10.5 * u}px);filter:blur(${1.2 * u}px);mix-blend-mode:multiply`));
}
function room(o) {  // living-room wall + floor, evening
  const u = S.u;
  o.append(el("div", `position:absolute;inset:-6%;background:linear-gradient(#d9c7b6 0%, #cdb8a4 62%, #a88a70 62%, #8c6f57 100%)`));
  o.append(el("div", `position:absolute;left:${12 * u}px;top:${S.H * 0.1}px;width:${34 * u}px;height:${44 * u}px;border-radius:${1 * u}px;
    background:linear-gradient(160deg,#3b4a72,#1e2747);box-shadow:inset 0 0 0 ${1.4 * u}px #efe4d8, 0 ${1 * u}px ${3 * u}px rgba(0,0,0,.2)`,
    `<div style="position:absolute;left:50%;top:0;bottom:0;width:${1.2 * u}px;margin-left:${-0.6 * u}px;background:#efe4d8"></div>
     <div style="position:absolute;left:${22 * u}px;top:${8 * u}px;width:${5 * u}px;height:${5 * u}px;border-radius:50%;background:#f6eccf;box-shadow:0 0 ${3 * u}px #f6eccf"></div>`));
  o.append(el("div", `position:absolute;left:${70 * u}px;top:${S.H * 0.16}px;width:${40 * u}px;height:${40 * u}px;margin-left:${-20 * u}px;
    border-radius:50%;background:radial-gradient(circle,#ffd99a99,#ffd99a00 70%)`));
}

// ---------------------------------------------------------------- props
const shadowUnder = (w, h, a = 0.35) => `<div style="position:absolute;left:${-w / 2}px;top:${-h / 2}px;width:${w}px;height:${h}px;border-radius:50%;
  background:radial-gradient(ellipse, rgba(60,30,10,${a}), rgba(60,30,10,0) 70%)"></div>`;
function bottle(x, y, s, color) {  // nail polish bottle: glass body with lacquer, tall glossy cap
  const u = S.u * s;
  return el("div", `position:absolute;left:${x}px;top:${y}px;width:0;height:0`,
    `${shadowUnder(22 * u, 6 * u)}
     <div style="position:absolute;left:${-9 * u}px;top:${-22 * u}px;width:${18 * u}px;height:${22 * u}px;border-radius:${4 * u}px;
       background:linear-gradient(90deg, ${shade(color, -0.35)}, ${color} 30%, ${shade(color, 0.35)} 48%, ${color} 62%, ${shade(color, -0.4)});
       box-shadow:inset 0 0 0 ${0.6 * u}px rgba(255,255,255,.35)">
       <div style="position:absolute;left:${3 * u}px;top:${2 * u}px;width:${2.4 * u}px;height:${16 * u}px;border-radius:${2 * u}px;background:rgba(255,255,255,.55);filter:blur(${0.3 * u}px)"></div></div>
     <div style="position:absolute;left:${-3.5 * u}px;top:${-24.5 * u}px;width:${7 * u}px;height:${3 * u}px;background:#d9d0c8;border-radius:${0.6 * u}px"></div>
     <div style="position:absolute;left:${-4.5 * u}px;top:${-44 * u}px;width:${9 * u}px;height:${20 * u}px;border-radius:${1.6 * u}px;
       background:linear-gradient(90deg,#0d0b0c,#3b3437 35%,#6c6266 45%,#1b1719 60%,#050405)"></div>`);
}
function clock(x, y, s) {  // twin-bell alarm clock
  const u = S.u * s, R = 13 * u;
  const c = el("div", `position:absolute;left:${x}px;top:${y}px;width:0;height:0`,
    `${shadowUnder(34 * u, 7 * u)}
     <div class="b" style="position:absolute;left:0;top:0;width:0;height:0">
     <div style="position:absolute;left:${-R - 2 * u}px;top:${-2 * R - 9 * u}px;width:${9 * u}px;height:${6 * u}px;border-radius:${9 * u}px ${9 * u}px 0 0;transform:rotate(-30deg);background:linear-gradient(#ff8fbf,#d61f6f)"></div>
     <div style="position:absolute;left:${R - 7 * u}px;top:${-2 * R - 9 * u}px;width:${9 * u}px;height:${6 * u}px;border-radius:${9 * u}px ${9 * u}px 0 0;transform:rotate(30deg);background:linear-gradient(#ff8fbf,#d61f6f)"></div>
     <div style="position:absolute;left:${-R}px;top:${-2 * R - 2 * u}px;width:${2 * R}px;height:${2 * R}px;border-radius:50%;
       background:radial-gradient(circle at 35% 30%,#ff9cc6,${S.A} 55%,#a3134f);box-shadow:0 ${0.6 * u}px ${1.5 * u}px rgba(0,0,0,.25)">
       <div style="position:absolute;inset:${2 * u}px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff,#efe7e3)"></div>
       <div style="position:absolute;left:50%;top:50%;width:${0.9 * u}px;height:${7 * u}px;margin:${-7 * u}px 0 0 ${-0.45 * u}px;background:${INK};transform-origin:50% 100%;transform:rotate(20deg)"></div>
       <div style="position:absolute;left:50%;top:50%;width:${0.9 * u}px;height:${5 * u}px;margin:${-5 * u}px 0 0 ${-0.45 * u}px;background:${INK};transform-origin:50% 100%;transform:rotate(-60deg)"></div>
       <div style="position:absolute;left:50%;top:50%;width:${1.8 * u}px;height:${1.8 * u}px;margin:${-0.9 * u}px;border-radius:50%;background:${S.A}"></div></div>
     <div style="position:absolute;left:${-R * 0.7}px;top:${-3 * u}px;width:${1.4 * u}px;height:${4 * u}px;background:#a3134f;transform:rotate(25deg)"></div>
     <div style="position:absolute;left:${R * 0.6}px;top:${-3 * u}px;width:${1.4 * u}px;height:${4 * u}px;background:#a3134f;transform:rotate(-25deg)"></div></div>`);
  return c;
}
function phone(w, h, inner, extra = "") {  // modern phone: thin dark frame, island, light screen
  const u = S.u;
  return el("div", `position:absolute;left:${-w / 2}px;top:${-h / 2}px;width:${w}px;height:${h}px;border-radius:${w * 0.15}px;
    background:linear-gradient(140deg,#3a3a40,#0c0c0e);padding:${w * 0.03}px;box-sizing:border-box;
    box-shadow:0 ${4 * u}px ${9 * u}px rgba(60,25,10,.35), 0 ${1 * u}px ${2 * u}px rgba(0,0,0,.3);${extra}`,
    `<div style="width:100%;height:100%;border-radius:${w * 0.12}px;overflow:hidden;background:#f6f1ec;position:relative;direction:rtl">
       <div style="position:absolute;left:50%;top:${w * 0.03}px;width:${w * 0.3}px;height:${w * 0.075}px;margin-left:${-w * 0.15}px;border-radius:${w}px;background:#000;z-index:3"></div>
       ${inner}</div>`);
}
const bubble = (u, txt, me, extra = "") => `<div class="bb" style="align-self:${me ? "flex-start" : "flex-end"};max-width:78%;background:${me ? "#ffd9ea" : "#fff"};
  color:${INK};border-radius:${3 * u}px;${me ? `border-bottom-left-radius:${0.8 * u}px` : `border-bottom-right-radius:${0.8 * u}px`};
  padding:${1.6 * u}px ${3 * u}px;font:700 ${4.2 * u}px Assistant;box-shadow:0 ${0.3 * u}px ${0.8 * u}px rgba(0,0,0,.1);opacity:0;${extra}">${txt}</div>`;
const chatHead = (u, name, col) => `<div style="padding:${7 * u}px ${3 * u}px ${2 * u}px;background:#fff;display:flex;align-items:center;gap:${2 * u}px;
  border-bottom:1px solid #eee"><div style="width:${7 * u}px;height:${7 * u}px;border-radius:50%;background:${col};color:#fff;font:800 ${3.4 * u}px Assistant;
  display:flex;align-items:center;justify-content:center">${name[0]}</div><div style="font:800 ${4 * u}px Assistant;color:${INK}">${name}</div></div>`;

// ---------------------------------------------------------------- shots (lt = local time, 0 = cut)
const SHOTS = {
  polish(o, u, W, H) {  // polish bottles + alarm clock on the table; the clock starts to shake on "ודחוף"
    table(o);
    const b1 = bottle(W * 0.3, H * 0.6, 1.25, S.A), b2 = bottle(W * 0.48, H * 0.66, 1.0, "#C9A27E"), ck = clock(W * 0.74, H * 0.62, 1.05);
    o.append(b2, b1, ck);
    const bb = ck.querySelector(".b");
    return (lt) => { bb.style.transform = `rotate(${lt > 1.0 ? Math.sin(lt * 60) * 5 : 0}deg)`; };
  },
  ring(o, u, W, H) {  // close-up: the clock rings hard
    table(o, "#e6d3c0");
    const ck = clock(W * 0.5, H * 0.62, 2.2);
    const lines = el("div", `position:absolute;left:${W * 0.5}px;top:${H * 0.38}px;width:0;height:0`,
      [-60, -30, 30, 60].map((a) => `<div style="position:absolute;left:${-0.8 * u}px;top:${-38 * u}px;width:${1.6 * u}px;height:${7 * u}px;border-radius:${u}px;
        background:${S.A};transform-origin:50% ${38 * u}px;transform:rotate(${a}deg)"></div>`).join(""));
    o.append(ck, lines);
    const bb = ck.querySelector(".b");
    return (lt) => {
      bb.style.transform = `rotate(${Math.sin(lt * 70) * 7}deg) translateY(${Math.abs(Math.sin(lt * 70)) * -0.6 * u}px)`;
      lines.style.opacity = 0.5 + 0.5 * Math.sin(lt * 30);
      lines.style.transform = `scale(${1 + 0.06 * Math.sin(lt * 30)})`;
    };
  },
  nobody(o, u, W, H) {  // phone on the table: replies "no availability" pile up
    table(o, "#e9d9c7");
    const inner = `${chatHead(u, "מניקוריסטיות באזור", "#b98aa0")}
      <div class="col" style="display:flex;flex-direction:column;gap:${2 * u}px;padding:${3 * u}px">
        ${bubble(u, "היי, יש לך תור היום?", true)}${bubble(u, "אין לי מקום היום", false)}${bubble(u, "מלאה עד שבוע הבא", false)}${bubble(u, "מצטערת מותק, אין", false)}</div>`;
    const ph = phone(54 * u, 104 * u, inner);
    const g = el("div", `position:absolute;left:${W * 0.5}px;top:${H * 0.44}px;width:0;height:0`);
    g.append(ph); o.append(g);
    const bs = [...ph.querySelectorAll(".bb")];
    return (lt) => {
      g.style.transform = `perspective(${300 * u}px) rotateX(${lerp(14, 8, seg(lt, 0, 1.3))}deg) rotate(${-4 + lt}deg)`;
      bs.forEach((b, i) => { const k = seg(lt, 0.05 + i * 0.28, 0.25 + i * 0.28); show(b, k);
        b.style.transform = `scale(${k > 0 ? easeOutBack(k, 2.4) : 0.001})`; });
    };
  },
  sofa(o, u, W, H) {  // evening on the sofa, blanket on, zero energy
    room(o);
    const s = el("div", `position:absolute;left:${W * 0.5}px;top:${H * 0.66}px;width:0;height:0`,
      `${shadowUnder(96 * u, 12 * u, 0.4)}
       <div style="position:absolute;left:${-46 * u}px;top:${-34 * u}px;width:${92 * u}px;height:${26 * u}px;border-radius:${6 * u}px ${6 * u}px ${2 * u}px ${2 * u}px;
         background:linear-gradient(#c98ea6,#a96c86)"></div>
       <div style="position:absolute;left:${-50 * u}px;top:${-14 * u}px;width:${100 * u}px;height:${14 * u}px;border-radius:${4 * u}px;background:linear-gradient(#b97894,#8f5470)"></div>
       <div style="position:absolute;left:${-54 * u}px;top:${-24 * u}px;width:${10 * u}px;height:${24 * u}px;border-radius:${5 * u}px;background:linear-gradient(90deg,#9c6079,#c48aa2)"></div>
       <div style="position:absolute;left:${44 * u}px;top:${-24 * u}px;width:${10 * u}px;height:${24 * u}px;border-radius:${5 * u}px;background:linear-gradient(90deg,#c48aa2,#9c6079)"></div>
       <div style="position:absolute;left:${-36 * u}px;top:${-30 * u}px;width:${18 * u}px;height:${15 * u}px;border-radius:${4 * u}px;background:linear-gradient(160deg,#f3e6da,#d8c4b2);transform:rotate(-8deg)"></div>
       <div style="position:absolute;left:${-10 * u}px;top:${-22 * u}px;width:${50 * u}px;height:${16 * u}px;border-radius:${6 * u}px ${8 * u}px ${3 * u}px ${3 * u}px;
         background:repeating-linear-gradient(90deg,#f2d7c4 0 ${3 * u}px,#e9c8b2 ${3 * u}px ${6 * u}px);box-shadow:0 ${1 * u}px ${2 * u}px rgba(0,0,0,.15)"></div>`);
    const z = el("div", `position:absolute;left:${W * 0.62}px;top:${H * 0.44}px;font:800 ${12 * u}px Assistant;color:#fff;opacity:0;text-shadow:0 ${0.4 * u}px ${1.5 * u}px rgba(0,0,0,.25)`, "Zzz");
    o.append(s, z);
    return (lt) => {
      const zk = (lt * 0.7) % 1;
      z.style.opacity = Math.sin(Math.PI * zk);
      z.style.transform = `translate(${zk * 4 * u}px, ${-zk * 14 * u}px) scale(${0.8 + 0.4 * zk})`;
    };
  },
  logo(o, u, W, H) {  // white flash -> brand bloom, the app icon drops onto the table, wordmark
    table(o, "#f1dfe6");
    o.append(el("div", `position:absolute;inset:0;background:radial-gradient(circle at 50% 45%, ${S.A}55, ${S.A}00 55%)`));
    const s = 38 * u;
    const ic = el("div", `position:absolute;left:${W / 2 - s / 2}px;top:${H * 0.42 - s / 2}px;width:${s}px;height:${s}px;border-radius:${s * 0.22}px;overflow:hidden;
      box-shadow:0 ${3 * u}px ${8 * u}px rgba(163,19,79,.45)`, S.logo ? `<img src="/${S.logo}" style="width:100%;height:100%;display:block">` : "");
    const wm = el("div", `position:absolute;left:0;right:0;top:${H * 0.42 + s / 2 + 3 * u}px;text-align:center;direction:ltr;font:800 ${16 * u}px Assistant;
      color:${S.A};opacity:0`, "Nomi");
    const fx = canvasLayer(o, W, H);
    o.append(ic, wm);
    return (lt) => {
      const k = seg(lt, 0, 0.45);
      ic.style.transform = `translateY(${(1 - easeOutCubic(k)) * -30 * u}px) scale(${pop(k, 1.6, 5)}) rotate(${lerp(-14, 0, easeOutCubic(k))}deg)`;
      const wk = seg(lt, 0.85, 1.1);
      wm.style.opacity = wk; wm.style.transform = `scale(${wk > 0 ? easeOutBack(wk, 2.4) : 0.5})`;
      fx.clearRect(0, 0, W, H);
      burst(fx, W / 2, H * 0.42, 45 * u, seg(lt, 0.35, 1.3), [S.A, "#ffd166", "#ffffff", "#ff8fbf"], 46, 11, 0.6);
      sparkle(fx, W * 0.7, H * 0.32, 9 * u, seg(lt, 0.5, 1.0)); sparkle(fx, W * 0.3, H * 0.5, 7 * u, seg(lt, 0.7, 1.2));
    };
  },
  find(o, u, W, H) {  // phone: technicians near you, distance badge, stars light up
    table(o);
    const techs = [["נועה", "1.2"], ["מאיה", "2.0"], ["שירה", "2.6"], ["רוני", "3.1"]];
    const inner = `<div style="padding:${9 * u}px ${3 * u}px 0">
      <div style="font:800 ${5 * u}px Assistant;color:${INK};margin-bottom:${2.5 * u}px">מניקוריסטיות לידך</div>
      ${techs.map(([n, km]) => `<div class="tc" style="display:flex;align-items:center;gap:${2 * u}px;background:#fff;border-radius:${3 * u}px;
        padding:${2 * u}px;margin-bottom:${2 * u}px;box-shadow:0 ${0.4 * u}px ${1.2 * u}px rgba(120,40,70,.12);opacity:0">
        <div style="width:${9 * u}px;height:${9 * u}px;border-radius:50%;background:linear-gradient(140deg,#ff8fbf,${S.A});color:#fff;
          font:800 ${4 * u}px Assistant;display:flex;align-items:center;justify-content:center">${n[0]}</div>
        <div style="flex:1"><div style="font:800 ${4.2 * u}px Assistant;color:${INK}">${n}</div>
        <div class="st" style="direction:ltr;text-align:right;font-size:${3.4 * u}px;opacity:.25">${star("#f5a623").repeat(5)}</div></div>
        <div class="km" style="font:800 ${3.6 * u}px Assistant;color:${S.A};white-space:nowrap">${km} ק"מ</div></div>`).join("")}</div>`;
    const g = el("div", `position:absolute;left:${W * 0.5}px;top:${H * 0.44}px;width:0;height:0`);
    g.append(phone(54 * u, 104 * u, inner)); o.append(g);
    const badge = el("div", `position:absolute;left:${W * 0.5}px;top:${H * 0.065}px;display:flex;gap:${1.4 * u}px;align-items:center;background:#fff;
      border-radius:${5 * u}px;padding:${1.6 * u}px ${3.4 * u}px;font:800 ${5 * u}px Assistant;color:${INK};white-space:nowrap;opacity:0;
      box-shadow:0 ${1.4 * u}px ${4 * u}px rgba(120,30,70,.25)`, `${icon("pin", 5.4 * u, S.A)}<span>הכי קרובה</span>`);
    o.append(badge);
    const cards = [...g.querySelectorAll(".tc")], sts = [...g.querySelectorAll(".st")];
    return (lt) => {
      g.style.transform = `perspective(${300 * u}px) rotateX(${lerp(16, 6, seg(lt, 0, 2.7))}deg) rotate(${3 - lt * 0.8}deg)`;
      cards.forEach((c, i) => { const k = seg(lt, 0.1 + i * 0.12, 0.35 + i * 0.12); c.style.opacity = k;
        c.style.transform = `translateY(${(1 - easeOutCubic(k)) * 6 * u}px)`; });
      const bk = seg(lt, 1.3, 1.55);
      show(badge, bk); badge.style.transform = `translateX(-50%) scale(${bk > 0 ? easeOutBack(bk, 2.6) : 0.001})`;
      sts.forEach((s, i) => { s.style.opacity = 0.25 + 0.75 * seg(lt, 2.0 + i * 0.08, 2.25 + i * 0.08); });
    };
  },
  folio(o, u, W, H) {  // printed work photos dropped on the table, the favourite lifts
    table(o, "#e7d6c4");
    const ps = S.photos.length ? S.photos : [{}, {}, {}];
    const pos = [[0.3, 0.42, -12], [0.68, 0.4, 9], [0.5, 0.56, -3]];
    const cards = ps.slice(0, 3).map((p, i) => {
      const [x, y, r] = pos[i];
      const c = el("div", `position:absolute;left:${W * x - 21 * u}px;top:${H * y - 26 * u}px;width:${42 * u}px;height:${52 * u}px;padding:${2 * u}px ${2 * u}px ${8 * u}px;
        box-sizing:border-box;background:#fbf8f4;box-shadow:0 ${2 * u}px ${5 * u}px rgba(60,30,10,.3);opacity:0`,
        p.src ? `<img src="/${p.src}" style="width:100%;height:100%;object-fit:cover;object-position:${p.pos || "50% 50%"};display:block">`
              : `<div style="width:100%;height:100%;${nailTile(S.A, "0")}"></div>`);
      o.append(c); return { c, r };
    });
    return (lt) => {
      cards.forEach(({ c, r }, i) => {
        const k = seg(lt, 0.05 + i * 0.16, 0.35 + i * 0.16), fav = i === 2 ? easeOutBack(seg(lt, 0.9, 1.2), 2) : 0;
        show(c, k);
        c.style.zIndex = i === 2 ? 5 : 1;
        c.style.transform = `translateY(${(1 - easeOutCubic(k)) * -14 * u - fav * 3 * u}px) rotate(${r + (1 - easeOutCubic(k)) * 14}deg)
          scale(${lerp(1.25, 1, easeOutCubic(k)) * (1 + 0.1 * fav)})`;
        c.style.boxShadow = `0 ${(2 + fav * 4) * u}px ${(5 + fav * 6) * u}px rgba(60,30,10,${0.3 - fav * 0.08})`;
      });
    };
  },
  send(o, u, W, H) {  // chat: the design photo is sent, read, she answers
    table(o);
    const ph0 = S.photos[2] || S.photos[0];
    const img = ph0 ? `<img src="/${ph0.src}" style="width:100%;height:${30 * u}px;object-fit:cover;object-position:${ph0.pos};border-radius:${2 * u}px;display:block">`
                    : `<div style="height:${30 * u}px;${nailTile(S.A, `${2 * u}px`)}"></div>`;
    const inner = `${chatHead(u, "נועה · מניקוריסטית", S.A)}
      <div style="display:flex;flex-direction:column;gap:${2 * u}px;padding:${3 * u}px">
        ${bubble(u, `${img}<div style="display:flex;justify-content:space-between;padding-top:${1 * u}px"><span>בדיוק כזה!</span><span class="tk" style="color:#9aa;direction:ltr">✓✓</span></div>`, true, `width:${36 * u}px;padding:${1.2 * u}px`)}
        ${bubble(u, "סגור, מושלם! יוצא מהמם", false)}</div>`;
    const g = el("div", `position:absolute;left:${W * 0.5}px;top:${H * 0.44}px;width:0;height:0`);
    g.append(phone(54 * u, 104 * u, inner)); o.append(g);
    const [b1, b2] = g.querySelectorAll(".bb"), tk = g.querySelector(".tk");
    return (lt) => {
      g.style.transform = `perspective(${300 * u}px) rotateX(${lerp(12, 6, seg(lt, 0, 1.9))}deg) rotate(${-2 + lt * 0.6}deg)`;
      const k = seg(lt, 0.1, 0.35);
      show(b1, k); b1.style.transform = `translateY(${(1 - easeOutCubic(k)) * 14 * u}px) scale(${lerp(0.8, 1, easeOutCubic(k))})`;
      tk.style.color = lt > 0.7 ? "#34b7f1" : "#9aa";
      const k2 = seg(lt, 1.2, 1.45);
      show(b2, k2); b2.style.transform = `scale(${k2 > 0 ? easeOutBack(k2, 2.4) : 0.001})`;
    };
  },
  calendar(o, u, W, H) {  // paper wall calendar: a pink marker circles the day, the hour is written, confirmed
    table(o, "#efe5d8");
    const days = Array.from({ length: 30 }, (_, i) => i + 1), pick = 18;
    const cal = el("div", `position:absolute;left:${W * 0.5 - 38 * u}px;top:${H * 0.2}px;width:${76 * u}px;padding:${8 * u}px ${4 * u}px ${5 * u}px;box-sizing:border-box;
      background:#fffdf9;box-shadow:0 ${2 * u}px ${6 * u}px rgba(60,30,10,.3);transform:rotate(-2deg)`,
      `<div style="position:absolute;left:0;right:0;top:${1.6 * u}px;display:flex;justify-content:space-around">${"<i></i>".repeat(6).replace(/<i><\/i>/g,
        `<div style="width:${2 * u}px;height:${4 * u}px;border-radius:${u}px;background:#555"></div>`)}</div>
       <div style="font:800 ${7 * u}px Assistant;color:${INK};text-align:center;margin-bottom:${3 * u}px">נובמבר</div>
       <div style="display:grid;grid-template-columns:repeat(7,1fr);row-gap:${2.6 * u}px;direction:rtl;font:700 ${4.4 * u}px Assistant;color:#5a4a50;text-align:center">
         ${days.map((d) => `<div class="${d === pick ? "pk" : ""}" style="position:relative">${d}</div>`).join("")}</div>`);
    o.append(cal);
    const pk = cal.querySelector(".pk");
    pk.insertAdjacentHTML("beforeend", `<svg viewBox="0 0 60 44" style="position:absolute;left:50%;top:50%;width:${11 * u}px;height:${8 * u}px;
      margin:${-4 * u}px 0 0 ${-5.5 * u}px;overflow:visible"><path class="mk" d="M48 10 C 40 2, 10 2, 6 18 C 2 34, 30 42, 46 36 C 58 30, 56 14, 40 8"
      fill="none" stroke="${S.A}" stroke-width="4" stroke-linecap="round" stroke-dasharray="170" stroke-dashoffset="170"/></svg>
`);
    const mk = pk.querySelector(".mk");
    const ok = el("div", `position:absolute;left:50%;top:${H * 0.62}px;white-space:nowrap;background:#22c55e;color:#fff;border-radius:${6 * u}px;
      padding:${1.8 * u}px ${5 * u}px;font:800 ${5.6 * u}px Assistant;box-shadow:0 ${1.4 * u}px ${4 * u}px #22c55e77;opacity:0`, "התור נקבע · 18:30 ✓");
    o.append(ok);
    return (lt) => {
      mk.setAttribute("stroke-dashoffset", 170 * (1 - easeInOutCubic(seg(lt, 0.45, 0.85))));
      const k = seg(lt, 1.1, 1.35);
      show(ok, k); ok.style.transform = `translateX(-50%) scale(${k > 0 ? easeOutBack(k, 2.6) : 0.001})`;
    };
  },
  route(o, u, W, H) {  // top-down map: her car drives to your door
    o.append(el("div", `position:absolute;inset:-6%;background:#efe6da`));
    const map = el("div", `position:absolute;inset:0`, `<svg viewBox="0 0 100 178" width="${W}" height="${H}" preserveAspectRatio="none">
      <rect x="58" y="18" width="34" height="30" rx="3" fill="#cfe3c4"/><rect x="6" y="112" width="30" height="26" rx="3" fill="#cfe3c4"/>
      <g stroke="#fff" stroke-width="6" fill="none"><path d="M0 60H100M0 104H100M0 150H100M30 0V178M74 0V178"/></g>
      <g stroke="#e3d6c6" stroke-width="1.6" fill="none"><path d="M0 60H100M0 104H100M0 150H100M30 0V178M74 0V178" stroke-dasharray="3 3"/></g>
      <path class="rt" d="M30 172 V104 H74 V60" stroke="${S.A}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
    o.append(map);
    const rt = map.querySelector(".rt"), L = rt.getTotalLength();
    rt.setAttribute("stroke-dasharray", `${L} ${L}`);
    const sx = W / 100, sy = H / 178;
    const home = el("div", `position:absolute;left:${74 * sx}px;top:${60 * sy}px;width:0;height:0`,
      `<div style="position:absolute;left:${-7 * u}px;top:${-16 * u}px">${icon("pin", 14 * u, S.A)}</div>`);
    const car = el("div", `position:absolute;width:0;height:0`, `<div style="position:absolute;left:${-4 * u}px;top:${-7 * u}px;width:${8 * u}px;height:${14 * u}px;
      border-radius:${2.4 * u}px;background:linear-gradient(90deg,#d61f6f,${S.A} 40%,#ff8fbf 55%,${S.A});box-shadow:0 ${0.8 * u}px ${1.6 * u}px rgba(0,0,0,.35)">
      <div style="position:absolute;left:${1 * u}px;right:${1 * u}px;top:${2.4 * u}px;height:${3 * u}px;border-radius:${0.8 * u}px;background:#3a2a32"></div></div>`);
    o.append(home, car);
    return (lt) => {
      const d = easeInOutCubic(seg(lt, 0.0, 0.8)) * L;
      rt.setAttribute("stroke-dashoffset", L - d);
      const p = rt.getPointAtLength(d), q = rt.getPointAtLength(Math.min(L, d + 1));
      const ang = Math.atan2((q.y - p.y) * sy, (q.x - p.x) * sx) * 180 / Math.PI + 90;
      car.style.left = `${p.x * sx}px`; car.style.top = `${p.y * sy}px`; car.style.transform = `rotate(${ang}deg)`;
      home.style.transform = `scale(${1 + 0.2 * Math.sin(Math.PI * seg(lt, 0.7, 0.85))})`;
    };
  },
  door(o, u, W, H) {  // front door opens into warm light: she's here
    o.append(el("div", `position:absolute;inset:-6%;background:linear-gradient(90deg,#d6c3b0,#e8d9c9 50%,#d3bfab)`));
    const dw = 56 * u, dh = 112 * u, x = W / 2 - dw / 2, y = H * 0.16;
    o.append(el("div", `position:absolute;left:${x - 3 * u}px;top:${y - 3 * u}px;width:${dw + 6 * u}px;height:${dh + 3 * u}px;background:#f7efe6;
      box-shadow:0 ${1 * u}px ${3 * u}px rgba(0,0,0,.15)`));
    const light = el("div", `position:absolute;left:${x}px;top:${y}px;width:${dw}px;height:${dh}px;background:radial-gradient(ellipse at 50% 60%,#fff6dc,#ffd9a0)`);
    const kit = el("div", `position:absolute;left:${x + dw * 0.3}px;top:${y + dh * 0.62}px;width:${dw * 0.4}px;height:${dh * 0.2}px;border-radius:${2 * u}px;
      background:linear-gradient(160deg,#ff8fbf,${S.A});box-shadow:0 ${1 * u}px ${2 * u}px rgba(0,0,0,.2);opacity:0`,
      `<div style="position:absolute;left:30%;right:30%;top:${-3 * u}px;height:${4 * u}px;border:${1 * u}px solid #a3134f;border-bottom:none;border-radius:${2 * u}px ${2 * u}px 0 0"></div>
       <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:800 ${4.4 * u}px Assistant;color:#fff;direction:ltr">Nomi</div>`);
    const leaf = el("div", `position:absolute;left:${x}px;top:${y}px;width:${dw}px;height:${dh}px;transform-origin:0% 50%;
      background:linear-gradient(90deg,#c7a27f,#dcbb98 50%,#c29c78);box-shadow:inset 0 0 0 ${1.2 * u}px rgba(0,0,0,.08)`,
      `<div style="position:absolute;left:${6 * u}px;right:${6 * u}px;top:${8 * u}px;height:${40 * u}px;border-radius:${u}px;box-shadow:inset 0 0 0 ${0.8 * u}px rgba(80,50,20,.25)"></div>
       <div style="position:absolute;left:${6 * u}px;right:${6 * u}px;top:${56 * u}px;height:${46 * u}px;border-radius:${u}px;box-shadow:inset 0 0 0 ${0.8 * u}px rgba(80,50,20,.25)"></div>
       <div style="position:absolute;right:${5 * u}px;top:${54 * u}px;width:${3 * u}px;height:${8 * u}px;border-radius:${u}px;background:linear-gradient(#f3d58a,#b8902f)"></div>`);
    const bell = el("div", `position:absolute;left:${x + dw + 8 * u}px;top:${y + dh * 0.42}px;white-space:nowrap;background:#fff;border-radius:${4 * u}px;
      padding:${1.4 * u}px ${3 * u}px;font:800 ${4.6 * u}px Assistant;color:${INK};box-shadow:0 ${1 * u}px ${3 * u}px rgba(0,0,0,.18);opacity:0;transform-origin:0% 50%`, "דינג דונג!");
    o.append(light, kit, leaf, bell);
    return (lt) => {
      const bk = seg(lt, 0.0, 0.2);
      show(bell, bk * (1 - seg(lt, 0.5, 0.6)));
      bell.style.transform = `translateX(-100%) scale(${bk > 0 ? easeOutBack(bk, 2.6) : 0.001})`;
      const dk = easeInOutCubic(seg(lt, 0.25, 0.85));
      leaf.style.transform = `perspective(${120 * u}px) rotateY(${-78 * dk}deg)`;
      const kk = seg(lt, 0.6, 0.9);
      kit.style.opacity = kk; kit.style.transform = `translateY(${(1 - easeOutCubic(kk)) * 4 * u}px)`;
    };
  },
  trust(o, u, W, H) {  // recap: ticked cards stack up (like the reference's checklist), then five stars
    table(o, "#eee2d4");
    const rows = ["מניקוריסטיות מאומתות", "תיק עבודות אמיתי", "תור בשעה שנוח לך", "עד הבית"];
    const cards = rows.map((r, i) => el("div", `position:absolute;left:${W * 0.5 - 36 * u}px;top:${H * 0.2 + i * 15 * u}px;width:${72 * u}px;height:${12 * u}px;
      display:flex;align-items:center;gap:${3 * u}px;padding:0 ${3.4 * u}px;box-sizing:border-box;background:#fff;border-radius:${3.4 * u}px;
      box-shadow:0 ${1.2 * u}px ${3.4 * u}px rgba(90,40,20,.2);font:800 ${4.8 * u}px Assistant;color:${INK};opacity:0`,
      `<div class="tk" style="width:${7 * u}px;height:${7 * u}px;border-radius:50%;background:#22c55e;color:#fff;font:800 ${4.4 * u}px Assistant;
        display:flex;align-items:center;justify-content:center;transform:scale(0)">✓</div><span>${r}</span>`));
    const stars = el("div", `position:absolute;left:0;right:0;top:${H * 0.2 + 64 * u}px;display:flex;justify-content:center;gap:${1.6 * u}px;direction:ltr`);
    const ss = [0, 1, 2, 3, 4].map(() => { const s = el("div", "opacity:0", star("#f5a623", `${10 * u}px`)); stars.append(s); return s; });
    o.append(...cards, stars);
    return (lt) => {
      cards.forEach((c, i) => {
        const k = seg(lt, 0.05 + i * 0.22, 0.3 + i * 0.22);
        c.style.opacity = k; c.style.transform = `translateX(${(1 - easeOutCubic(k)) * 30 * u}px)`;
        const tk = seg(lt, 0.25 + i * 0.22, 0.4 + i * 0.22);
        c.querySelector(".tk").style.transform = `scale(${tk > 0 ? easeOutBack(tk, 3) : 0})`;
      });
      ss.forEach((s, i) => { const k = seg(lt, 1.85 + i * 0.09, 2.05 + i * 0.09); s.style.opacity = k;
        s.style.transform = `scale(${k > 0 ? easeOutBack(k, 3) : 0.001}) rotate(${(1 - k) * -40}deg)`; });
    };
  },
  end(o, u, W, H) {  // brand flood: logo, wordmark, tagline, CTA
    const A = S.A;
    o.append(el("div", `position:absolute;inset:0;background:radial-gradient(circle at 50% 40%, ${shade(A, 0.3)}, ${A} 55%, ${shade(A, -0.3)})`));
    const lg = 34 * u;
    const logo = el("div", `position:absolute;left:${W / 2 - lg / 2}px;top:${H * 0.26 - lg / 2}px;width:${lg}px;height:${lg}px;border-radius:${lg * 0.22}px;overflow:hidden;
      box-shadow:0 ${2 * u}px ${6 * u}px rgba(0,0,0,.3)`, S.logo ? `<img src="/${S.logo}" style="width:100%;height:100%;display:block">` : "");
    const word = el("div", `position:absolute;left:0;right:0;top:${H * 0.37}px;text-align:center;direction:ltr;font:800 ${20 * u}px Assistant;color:#fff;opacity:0`, "Nomi");
    const tag = el("div", `position:absolute;left:0;right:0;top:${H * 0.5}px;text-align:center;font:800 ${10 * u}px Assistant;color:#fff;opacity:0`, S.p.tagline);
    const cta = el("div", `position:absolute;left:50%;top:${H * 0.64}px;white-space:nowrap;background:#fff;color:${A};border-radius:${8 * u}px;
      padding:${2.2 * u}px ${8 * u}px;font:800 ${7 * u}px Assistant;box-shadow:0 ${1.4 * u}px ${4 * u}px rgba(0,0,0,.2);opacity:0`, S.p.cta);
    const fx = canvasLayer(o, W, H);
    o.append(logo, word, tag, cta);
    return (lt) => {
      const lk = seg(lt, 0.05, 0.5);
      logo.style.transform = `scale(${pop(lk, 1.4, 5)}) rotate(${Math.sin(Math.max(0, lt - 1.2) * 3) * 3 * seg(lt, 1.2, 1.5)}deg)`;
      const wk = seg(lt, 0.25, 0.55); word.style.opacity = wk; word.style.transform = `translateY(${(1 - easeOutCubic(wk)) * 5 * u}px)`;
      const tk = seg(lt, 0.8, 1.1); tag.style.opacity = tk; tag.style.filter = `blur(${(1 - tk) * 1.5 * u}px)`;
      const ck = seg(lt, 1.4, 1.7);
      cta.style.opacity = ck;
      cta.style.transform = `translateX(-50%) scale(${(ck > 0 ? easeOutBack(ck, 2.4) : 0.001) * (1 + 0.04 * Math.sin(Math.max(0, lt - 1.9) * 6))})`;
      fx.clearRect(0, 0, W, H);
      [[0.3, 0.18, 0.3], [0.72, 0.24, 0.45], [0.66, 0.44, 0.6], [0.26, 0.5, 1.7]].forEach(([x, y, t0]) => sparkle(fx, x * W, y * H, 7 * u, seg(lt, t0, t0 + 0.55)));
    };
  },
};

// SFX per shot: [dt, name, gain]
const SFX = {
  polish: [[0.05, "pop", -12], [1.0, "click", -14]], ring: [[0.0, "impact", -12]],
  nobody: [[0.05, "pop2", -10], [0.33, "pop2", -10], [0.61, "pop2", -10], [0.89, "pop2", -9]], sofa: [[0.0, "whoosh2", -14]],
  logo: [[0.0, "whoosh", -6], [0.38, "impact", -6], [0.45, "sparkle", -4]],
  find: [[0.1, "pop2", -12], [1.3, "pop", -8], [2.0, "sparkle", -10]], folio: [[0.05, "click", -10], [0.21, "click", -10], [0.37, "click", -10], [0.9, "pop2", -10]],
  send: [[0.1, "whoosh2", -12], [1.2, "pop2", -8]], calendar: [[0.45, "click", -10], [1.1, "sparkle", -6], [1.1, "pop", -8]],
  route: [[0.0, "whoosh", -12], [0.7, "pop", -10]], door: [[0.0, "click", -8], [0.25, "whoosh2", -10]],
  trust: [[0.25, "pop2", -12], [0.47, "pop2", -12], [0.69, "pop2", -12], [0.91, "pop2", -12], [1.85, "coin", -10]],
  end: [[0.0, "whoosh", -4], [0.1, "impact", -6], [0.25, "sparkle", -4], [1.4, "pop", -6]],
};

// ---------------------------------------------------------------- composition
export default {
  async setup(root, params, W, H) {
    const p = Object.assign({ accent: "#FF2E8B", shots: [], caps: [], headline: null, end: 25, logo: "", photos: [],
      tagline: "מניקור עד הבית", cta: "הורידי עכשיו" }, params);
    const u = W / 100;
    S = { p, u, W, H, A: p.accent, logo: p.logo, photos: p.photos };
    root.style.background = "#000";
    const view = el("div", `position:absolute;inset:0;overflow:hidden;direction:rtl;font-family:Assistant`);
    root.append(view);
    S.shots = p.shots.map((sh, i) => {
      const o = el("div", `position:absolute;inset:0;overflow:hidden;display:none`);
      const cam = el("div", `position:absolute;inset:0;transform-origin:50% 45%`);
      o.append(cam); view.append(o);
      const f = SHOTS[sh.id](cam, u, W, H);
      const t1 = i + 1 < p.shots.length ? p.shots[i + 1].t : p.end;
      return { ...sh, t1, o, cam, f };
    });
    // look: vignette + warm grade + film grain (pre-made noise tiles, one per frame)
    view.append(el("div", `position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 85% 70% at 50% 45%, rgba(0,0,0,0) 55%, rgba(40,15,5,.38) 100%)`));
    const grain = canvasLayer(view, W, H);
    grain.canvas.style.mixBlendMode = "overlay"; grain.canvas.style.opacity = "0.1";
    S.tiles = [0, 1, 2, 3].map((k) => {
      const c = document.createElement("canvas"); c.width = W / 3; c.height = H / 3;
      const x = c.getContext("2d"), im = x.createImageData(c.width, c.height);
      let seed = 1234 + k * 977;
      for (let i = 0; i < im.data.length; i += 4) { seed = (seed * 16807) % 2147483647; const v = (seed / 2147483647) * 255;
        im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
      x.putImageData(im, 0, 0); return c;
    });
    S.grain = grain;
    // headline over the hook (two lines, second in the brand colour)
    if (p.headline) {
      S.head = el("div", `position:absolute;left:${6 * u}px;right:${6 * u}px;top:${H * 0.085}px;text-align:center;opacity:0;
        text-shadow:0 ${0.5 * u}px ${2 * u}px rgba(0,0,0,.35)`,
        `<div style="font:800 ${11 * u}px Assistant;color:#fff;line-height:1.02">${p.headline[0]}</div>
         <div style="font:800 ${11 * u}px Assistant;color:#fff;line-height:1.12"><span style="background:${S.A};border-radius:${2.4 * u}px;padding:0 ${2.4 * u}px">${p.headline[1]}</span></div>`);
      view.append(S.head);
    }
    // captions: white, soft shadow, highlighted word on a brand-colour chip
    S.caps = p.caps.map((c) => {
      const words = c.text.split(" ");
      const e = el("div", `position:absolute;left:${5 * u}px;right:${5 * u}px;top:${H * 0.8}px;text-align:center;direction:rtl;opacity:0;
        font:800 ${9 * u}px Assistant;color:#fff;line-height:1.1;text-shadow:0 ${0.4 * u}px ${1.8 * u}px rgba(0,0,0,.55), 0 0 ${0.4 * u}px rgba(0,0,0,.4)`,
        words.map((w, i) => (c.hl || []).includes(i)
          ? `<span style="background:${S.A};border-radius:${2 * u}px;padding:0 ${1.8 * u}px;text-shadow:none;box-shadow:0 ${0.6 * u}px ${2 * u}px rgba(0,0,0,.25)">${w}</span>`
          : w).join(" "));
      view.append(e); return { ...c, node: e };
    });
    S.flash = el("div", `position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none`);
    view.append(S.flash);
    const sfx = [];
    S.shots.forEach((sh) => (SFX[sh.id] || []).forEach(([dt, name, gain]) => sfx.push({ t: sh.t + dt, name, gain })));
    return { duration: p.end, sfx };
  },

  async frame(t) {
    const s = S, u = s.u, W = s.W, H = s.H;
    s.shots.forEach((sh) => {
      const on = t >= sh.t && t < sh.t1;
      sh.o.style.display = on ? "block" : "none";
      if (!on) return;
      const lt = t - sh.t, d = sh.t1 - sh.t;
      // camera: punch-in on the cut that settles, slow push over the shot, a little handheld breathing
      const punch = 0.05 * (1 - easeOutCubic(seg(lt, 0, 0.22)));
      const push = sh.id === "end" ? 0 : 0.05 * (lt / d);
      const hx = Math.sin(t * 1.7 + sh.t) * 0.35 * u, hy = Math.cos(t * 1.3 + sh.t) * 0.3 * u;
      sh.cam.style.transform = `translate(${hx}px, ${hy}px) scale(${1.02 + push + punch}) rotate(${Math.sin(t * 0.9 + sh.t) * 0.25}deg)`;
      sh.f(lt);
    });
    s.grain.clearRect(0, 0, W, H);
    s.grain.drawImage(s.tiles[Math.floor(t * 30) % 4], 0, 0, W, H);
    // white flash on the brand reveal
    const lg = s.shots.find((x) => x.id === "logo");
    s.flash.style.opacity = lg ? 0.9 * (1 - seg(t, lg.t, lg.t + 0.25)) * (t >= lg.t ? 1 : 0) : 0;
    if (s.head) {
      const h0 = s.shots.length > 1 ? s.shots[1].t + 0.9 : 2;
      const k = seg(t, 0.0, 0.25), ko = seg(t, h0, h0 + 0.2);
      s.head.style.opacity = k * (1 - ko);
      s.head.style.transform = `scale(${(k > 0 ? easeOutBack(k, 2) : 0.5) * (1 - 0.1 * ko)})`;
    }
    s.caps.forEach((c) => {
      const on = t >= c.t && t < c.e;
      c.node.style.opacity = on ? 1 : 0;
      if (on) { const k = seg(t, c.t, c.t + 0.12); c.node.style.transform = `scale(${lerp(0.86, 1, easeOutBack(k, 2.2))})`; }
    });
  },
};
