/** Декор мира: праздничные гирлянды, зимние крыши и сосульки, каустика на мелководье, конусы света фонарей. */
import { BUILDINGS, TH, TW } from './data';
import type { Building, Game } from './game';
import { lightOf, windAt } from './fx';
import { iceK, rainK } from './seasons';
import { plazaLanterns } from './plaza';
import { hash2 } from './rng';
import { mk, type Cv } from './sprites';

type Ctx = CanvasRenderingContext2D;

/* ═════════════ Зимние крыши ═════════════ */

interface RoofInfo {
  skip: boolean;
  top: number;
  eave: number;
  snow: Cv | null;
  ice: Cv | null;
}
const roofCache = new WeakMap<Cv, RoofInfo>();

export function roofInfo(sp: Cv): RoofInfo {
  const hit = roofCache.get(sp);
  if (hit) return hit;
  const w = sp.width;
  const h = sp.height;
  const info: RoofInfo = { skip: true, top: 0, eave: 0, snow: null, ice: null };
  roofCache.set(sp, info);
  const d = sp.getContext('2d')!.getImageData(0, 0, w, h).data;
  const A = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[(y * w + x) * 4 + 3]);
  const topY = new Int16Array(w).fill(-1);
  const rowW = new Int16Array(h);
  let top = h;
  let bottom = 0;
  let maxW = 0;
  for (let x = 0; x < w; x++)
    for (let y = 0; y < h; y++)
      if (A(x, y) >= 200) {
        topY[x] = y;
        if (y < top) top = y;
        break;
      }
  for (let y = 0; y < h; y++) {
    let n = 0;
    for (let x = 0; x < w; x++) if (A(x, y) >= 200) n++;
    rowW[y] = n;
    if (n > 0) bottom = y;
    if (n > maxW) maxW = n;
  }
  const oh = bottom - top + 1;
  if (oh < 20 || maxW < 14) return info;
  // свес крыши: последняя широкая строка выше основания
  let eave = -1;
  for (let y = top; y <= bottom; y++) if (rowW[y] >= maxW - 3) eave = y;
  let ice = true;
  if (eave < 0 || eave - top < 5 || eave > top + oh * 0.74) {
    eave = top + Math.round(oh * 0.5);
    ice = false;
  }
  info.skip = false;
  info.top = top;
  info.eave = eave;
  // снежные шапки: следуем верхнему контуру
  const snow = mk(w, h);
  const sg = snow.getContext('2d')!;
  const put = (x: number, y: number, col: string) => {
    sg.fillStyle = col;
    sg.fillRect(x, y, 1, 1);
  };
  for (let x = 0; x < w; x++) {
    const ty = topY[x];
    if (ty < 0 || ty >= eave) continue;
    const depth = 2 + (hash2(x, 3, 91) < 0.45 ? 1 : 0) + (hash2(x, 5, 92) < 0.15 ? 1 : 0);
    for (let k = 0; k < depth; k++) {
      const y = ty + k;
      if (y >= eave || A(x, y) < 200) continue;
      put(x, y, k === 0 ? '#ffffff' : k === depth - 1 ? '#bcd2ea' : '#e8f2fc');
    }
    // наметённый «козырёк» по кромке
    if (A(x - 1, ty) < 200 || A(x + 1, ty) < 200) put(x, ty, '#ffffff');
  }
  // снег на свесе и по краю ската
  for (let x = 0; x < w; x++) {
    if (A(x, eave) < 200 || hash2(x, eave, 93) > 0.7) continue;
    put(x, eave - 1, '#f4f9ff');
    if (hash2(x, eave, 94) < 0.5) put(x, eave, '#d6e6f6');
  }
  info.snow = snow;
  if (ice) {
    const ic = mk(w, h);
    const ig = ic.getContext('2d')!;
    const px = (x: number, y: number, col: string) => {
      ig.fillStyle = col;
      ig.fillRect(x, y, 1, 1);
    };
    let x = 0;
    while (x < w) {
      if (A(x, eave) >= 200 && hash2(x, 7, 95) < 0.78) {
        const len = 2 + Math.floor(hash2(x, 8, 96) * 4);
        for (let k = 1; k <= len; k++) {
          px(x, eave + k, k === len ? '#8cc8ee' : '#dff2ff');
          if (k < len - 1 && len > 3 && k < 3) px(x + 1, eave + k, '#bfe3f8');
        }
        px(x, eave + 1, '#ffffff');
      }
      x += 2 + Math.floor(hash2(x, 9, 97) * 3);
    }
    info.ice = ic;
  }
  return info;
}

/** белые шапки на крышах и сосульки под карнизами (зимой) */
export function drawWinterRoof(ctx: Ctx, g: Game, sp: Cv, dx: number, dy: number) {
  const k = iceK(g);
  if (k <= 0.02) return;
  const r = roofInfo(sp);
  if (r.skip) return;
  ctx.globalAlpha = Math.min(1, k * 1.15);
  if (r.snow) ctx.drawImage(r.snow, dx, dy);
  if (r.ice && k > 0.35) {
    ctx.globalAlpha = Math.min(1, (k - 0.35) * 1.8);
    ctx.drawImage(r.ice, dx, dy);
    // редкая блестящая капля
    const t = g.waterT;
    const n = Math.floor(t * 0.9) + dx;
    if (hash2(n, dy, 17) < 0.3) {
      const ph = (t * 0.9) % 1;
      const gx = dx + 3 + Math.floor(hash2(n, 3, 17) * (sp.width - 6));
      ctx.globalAlpha = 0.9 * (1 - ph);
      ctx.fillStyle = '#d8f2ff';
      ctx.fillRect(gx, Math.round(dy + r.eave + 4 + ph * 8), 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}

/* ═════════════ Праздничные гирлянды ═════════════ */

interface Edge {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  delay: number;
  ph: number;
  col: number;
}
interface FestState {
  sig: string;
  edges: Edge[];
  start: number;
  active: boolean;
  lastSeen: number;
  rebuildAt: number;
}
const fest = new WeakMap<Game, FestState>();
const FLAG_COLS = ['#e8404a', '#f4c830', '#38a8e8', '#58c860', '#d060d8', '#ff8a2a', '#f4f4f4'];

function anchorOf(g: Game, b: Building, towardX: number): { x: number; y: number } {
  const sp = g.bspr.cv[b.type];
  const dy = (b.y + b.h) * TH - sp.height;
  const r = roofInfo(sp);
  const cx = b.x * TW + (b.w * TW) / 2;
  const half = Math.min(sp.width * 0.4, (b.w * TW) / 2 + 5);
  const side = towardX >= cx ? 1 : -1;
  const ey = r.skip ? sp.height * 0.45 : r.eave - 1;
  return { x: cx + side * half * 0.85, y: dy + ey };
}

function buildEdges(g: Game): Edge[] {
  const list = g.buildings.filter((b) => b.done && BUILDINGS[b.type] && b.type !== 'campfire' && b.type !== 'farm' && g.bspr.cv[b.type].height >= 20);
  const cen = list.map((b) => ({ b, x: (b.x + b.w / 2) * TW, y: (b.y + b.h / 2) * TH }));
  const seen = new Set<string>();
  const edges: Edge[] = [];
  const MAX = 15 * TW;
  for (let i = 0; i < cen.length; i++) {
    const near = cen
      .map((c, j) => ({ j, d: Math.hypot(c.x - cen[i].x, (c.y - cen[i].y) * 1.4) }))
      .filter((o) => o.j !== i && o.d < MAX && o.d > 18)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
    for (const o of near) {
      const key = i < o.j ? `${i}-${o.j}` : `${o.j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const A = anchorOf(g, cen[i].b, cen[o.j].x);
      const B = anchorOf(g, cen[o.j].b, cen[i].x);
      edges.push({ ax: A.x, ay: A.y, bx: B.x, by: B.y, delay: 0, ph: hash2(i, o.j, 5) * 6, col: Math.floor(hash2(i, o.j, 6) * FLAG_COLS.length) });
    }
  }
  // «натягиваем» от Стоянки наружу
  const camp = g.buildings[0];
  const cx = camp ? (camp.x + 1) * TW : 0;
  const cy = camp ? (camp.y + 1) * TH : 0;
  edges.sort((a, b) => Math.hypot((a.ax + a.bx) / 2 - cx, (a.ay + a.by) / 2 - cy) - Math.hypot((b.ax + b.bx) / 2 - cx, (b.ay + b.by) / 2 - cy));
  edges.forEach((e, i) => (e.delay = i * 0.22));
  return edges.slice(0, 48);
}

export function drawFestival(ctx: Ctx, g: Game, left: number, top: number, vw: number, vh: number) {
  if (g.mode !== 'play' || !g.soc) return;
  let st = fest.get(g);
  if (!st) {
    st = { sig: '', edges: [], start: 0, active: false, lastSeen: -999, rebuildAt: 0 };
    fest.set(g, st);
  }
  const dec = g.soc.decrees.find((d) => d.id === 'feast');
  if (dec) {
    if (!st.active) {
      st.active = true;
      st.start = g.time;
      st.sig = '';
    }
    st.lastSeen = g.time;
  } else if (st.active) {
    st.active = false;
  }
  if (g.time < st.lastSeen - 1) {
    // загрузка более раннего сохранения
    st.lastSeen = -999;
    st.active = false;
  }
  const sinceEnd = g.time - st.lastSeen;
  if (!st.active && sinceEnd > 2.5) return;
  let alpha = 1;
  if (!st.active) alpha = Math.max(0, 1 - sinceEnd / 2.5);
  else if (dec && dec.left < 4) alpha = Math.max(0, dec.left / 4);
  if (alpha <= 0.01) return;

  const sig = String(g.buildings.length) + ':' + g.buildings.filter((b) => b.done).length;
  if (st.sig !== sig && (st.sig === '' || g.time > st.rebuildAt)) {
    st.sig = sig;
    st.rebuildAt = g.time + 2;
    st.edges = buildEdges(g);
  }
  const t = g.waterT;
  const age = g.time - st.start;
  for (const e of st.edges) {
    const prog = Math.max(0, Math.min(1, (age - e.delay) / 1.3));
    if (prog <= 0) continue;
    const minX = Math.min(e.ax, e.bx);
    const maxX = Math.max(e.ax, e.bx);
    const minY = Math.min(e.ay, e.by);
    if (maxX < left - 10 || minX > left + vw + 10 || minY > top + vh + 30 || Math.max(e.ay, e.by) < top - 30) continue;
    const len = Math.hypot(e.bx - e.ax, e.by - e.ay);
    const sag = Math.min(12, 3 + len * 0.1);
    const sway = windAt(g, e.ax) * 1.4;
    const steps = Math.max(2, Math.round(len * prog));
    ctx.globalAlpha = alpha;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const u = (i / steps) * prog;
      const bell = 4 * u * (1 - u);
      const x = e.ax + (e.bx - e.ax) * u;
      const y = e.ay + (e.by - e.ay) * u + (sag * bell) * (0.35 + 0.65 * Math.min(1, prog * 1.4)) + Math.sin(t * 2.1 + e.ph + u * 5) * sway * bell * 0.5;
      pts.push({ x, y });
    }
    // верёвка
    ctx.fillStyle = '#3a2a1a';
    for (const p of pts) ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    // флажки
    const every = 7;
    let n = 0;
    for (let i = 3; i < pts.length - 2; i += every) {
      const p = pts[i];
      const col = FLAG_COLS[(e.col + n++) % FLAG_COLS.length];
      const fl = Math.round(Math.sin(t * 4.2 + e.ph + i * 0.7) * sway * 0.9);
      const x = Math.round(p.x);
      const y = Math.round(p.y) + 1;
      ctx.fillStyle = col;
      ctx.fillRect(x - 2, y, 5, 1);
      ctx.fillRect(x - 1 + Math.round(fl * 0.4), y + 1, 3, 1);
      ctx.fillRect(x + Math.round(fl * 0.8), y + 2, 1, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(x - 2, y, 2, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x + 2, y, 1, 1);
    }
    // бубенцы-огоньки ночью
    if (g.nightK > 0.3 && prog >= 1) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 6; i < pts.length - 3; i += 14) {
        const p = pts[i];
        const f = 0.6 + 0.4 * Math.sin(t * 5 + i + e.ph);
        ctx.fillStyle = `rgba(255,214,120,${0.55 * f * g.nightK * alpha})`;
        ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 3);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.globalAlpha = 1;
}

/* ═════════════ Каустика и блики на мелководье ═════════════ */

export function drawCaustics(ctx: Ctx, g: Game, c0: number, c1: number, r0: number, r1: number) {
  const w = g.world;
  const shore = w.shore;
  if (!shore) return;
  const sun = Math.max(0, Math.min(1, (lightOf(g) - 0.5) / 0.35));
  const day = sun * (1 - rainK(g) * 0.8);
  if (day < 0.05) return;
  const t = g.waterT;
  ctx.globalCompositeOperation = 'lighter';
  const wob = (x: number, k: number) => x * 0.55 + t * 1.6 + k * 3;
  for (let ty = Math.max(0, r0); ty <= Math.min(w.h - 1, r1); ty++) {
    for (let tx = Math.max(0, c0); tx <= Math.min(w.w - 1, c1); tx++) {
      const i = ty * w.w + tx;
      if (w.biome[i] > 1) continue;
      const sh = shore[i];
      if (sh > 5) continue;
      const depthK = 1 - Math.max(0, sh - 1) / 5.5;
      const I = day * (0.4 + 0.6 * depthK);
      const x0 = tx * TW;
      const y0 = ty * TH;
      // сеть светлых «нитей»
      ctx.fillStyle = `rgba(190,255,245,${0.085 * I})`;
      for (let k = 0; k < 2; k++) {
        const base = y0 + 3 + k * 5 + Math.sin(t * 0.9 + tx * 1.3 + k * 2) * 1.4;
        for (let x = 0; x < TW; x += 2) {
          const yy = Math.round(base + Math.sin(wob(x, k) + tx * 0.8 + ty * 1.1) * 1.7);
          ctx.fillRect(x0 + x, yy, 2, 1);
        }
      }
      // мерцающие солнечные блики
      for (let k = 0; k < 2; k++) {
        const sp = hash2(tx, ty, 61 + k) * 3;
        const cyc = t * 0.85 + sp;
        const ph = cyc % 1;
        if (hash2(tx, ty, Math.floor(cyc) * 3 + k) > 0.62) continue;
        const a = Math.sin(ph * Math.PI);
        const al = a * a * I;
        if (al < 0.05) continue;
        const gx = x0 + 2 + Math.floor(hash2(tx + k, ty, Math.floor(cyc)) * (TW - 4));
        const gy = y0 + 2 + Math.floor(hash2(ty, tx + k, Math.floor(cyc)) * (TH - 4));
        ctx.fillStyle = `rgba(255,252,220,${0.9 * al})`;
        ctx.fillRect(gx, gy, 1, 1);
        if (al > 0.45) {
          ctx.fillStyle = `rgba(255,248,200,${0.45 * al})`;
          ctx.fillRect(gx - 1, gy, 3, 1);
          ctx.fillRect(gx, gy - 1, 1, 3);
        }
      }
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

/* ═════════════ Конусы света уличных фонарей ═════════════ */

export function drawLightCones(ctx: Ctx, g: Game, left: number, top: number, s: number, night: number) {
  if (night < 0.05 || g.mode !== 'play') return;
  const lamps = plazaLanterns(g);
  if (!lamps.length) return;
  const t = g.waterT;
  const vw = g.cw / s;
  const vh = g.ch / s;
  ctx.globalCompositeOperation = 'lighter';
  for (const l of lamps) {
    if (l.x < left - 30 || l.x > left + vw + 30 || l.y < top - 10 || l.y > top + vh + 40) continue;
    const fl = 0.9 + 0.1 * Math.sin(t * 7.5 + l.tx * 3 + l.ty) + 0.03 * Math.sin(t * 21 + l.tx);
    const sx = (l.x - left) * s;
    const hy = (l.y - 17 - top) * s;
    const gy = (l.y - top) * s;
    const spread = 17 * s;
    const a = night * fl;
    // сам конус
    const lg = ctx.createLinearGradient(0, hy, 0, gy + 3 * s);
    lg.addColorStop(0, `rgba(255,222,140,${0.3 * a})`);
    lg.addColorStop(0.55, `rgba(255,205,115,${0.12 * a})`);
    lg.addColorStop(1, `rgba(255,195,100,${0.05 * a})`);
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(sx - 1.5 * s, hy + 1 * s);
    ctx.lineTo(sx + 1.5 * s, hy + 1 * s);
    ctx.lineTo(sx + spread, gy + 3 * s);
    ctx.lineTo(sx - spread, gy + 3 * s);
    ctx.closePath();
    ctx.fill();
    // световое пятно на земле
    ctx.save();
    ctx.translate(sx, gy + 1.5 * s);
    ctx.scale(1, 0.38);
    const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, spread * 1.25);
    rg.addColorStop(0, `rgba(255,216,130,${0.34 * a})`);
    rg.addColorStop(0.5, `rgba(255,196,100,${0.14 * a})`);
    rg.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(0, 0, spread * 1.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // мягкое гало у самого фонаря
    const hg = ctx.createRadialGradient(sx, hy + 2 * s, 0, sx, hy + 2 * s, 9 * s);
    hg.addColorStop(0, `rgba(255,236,170,${0.42 * a})`);
    hg.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(sx - 9 * s, hy - 7 * s, 18 * s, 18 * s);
    // пылинки в луче
    for (let m = 0; m < 5; m++) {
      const ph = (t * 0.22 + m * 0.2 + l.tx * 0.13) % 1;
      const wy = hy + ph * (gy - hy);
      const half = 1.5 * s + (spread - 1.5 * s) * ph;
      const wx = sx + Math.sin(t * 0.9 + m * 2.3 + l.ty) * half * 0.7;
      ctx.fillStyle = `rgba(255,240,190,${0.5 * a * Math.sin(ph * Math.PI)})`;
      ctx.fillRect(Math.round(wx), Math.round(wy), Math.max(1, Math.round(s * 0.6)), Math.max(1, Math.round(s * 0.6)));
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}
