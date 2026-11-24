/** Следы истории на земле: пепел на месте построек, сломанные щиты после схваток, щебень у добытых камней. */
import { TH, TW } from './data';
import type { Game } from './game';
import { hash2 } from './rng';
import { mk, type Cv } from './sprites';

export interface Mark {
  kind: 'ash' | 'shield' | 'rubble';
  /** центр в пикселях мира */
  x: number;
  y: number;
  /** ширина следа, пикселей */
  w: number;
  h: number;
  born: number;
  life: number;
  seed: number;
  cv?: Cv;
}

const store = new WeakMap<Game, Mark[]>();
let seedN = 1;

export function marksOf(g: Game): Mark[] {
  let a = store.get(g);
  if (!a) {
    a = [];
    store.set(g, a);
  }
  return a;
}

function push(g: Game, m: Omit<Mark, 'born' | 'seed'>) {
  if (g.mode !== 'play') return;
  const a = marksOf(g);
  a.push({ ...m, born: g.time, seed: seedN++ * 7 + Math.floor(Math.random() * 1000) });
  if (a.length > 160) a.shift();
}

/** пепелище на месте здания (координаты и размеры — в тайлах) */
export function addAsh(g: Game, tx: number, ty: number, tw: number, th: number) {
  push(g, { kind: 'ash', x: (tx + tw / 2) * TW, y: (ty + th / 2) * TH + 2, w: Math.round(tw * TW * 1.1) + 4, h: Math.round(th * TH * 1.05) + 4, life: 330 });
}

/** сломанные щиты на месте схватки (тайловые координаты, могут быть дробными) */
export function addShields(g: Game, tx: number, ty: number, n = 3, spread = 2.2) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * spread;
    push(g, { kind: 'shield', x: (tx + Math.cos(a) * r) * TW, y: (ty + Math.sin(a) * r * 0.7) * TH, w: 16, h: 11, life: 240 + Math.random() * 80 });
  }
}

/** россыпь щебня у добытого камня */
export function addRubble(g: Game, tx: number, ty: number) {
  push(g, { kind: 'rubble', x: (tx + 0.5) * TW, y: (ty + 0.7) * TH, w: 18, h: 10, life: 220 + Math.random() * 60 });
}

/* ───────────── спрайты следов ───────────── */

const SHIELD_FACES = ['#b8283a', '#2a5aa8', '#c8a02a', '#3a8a4a', '#8a4aa8'];

function paintAsh(m: Mark): Cv {
  const W = m.w + 6;
  const H = m.h + 6;
  const c = mk(W, H);
  const p = c.getContext('2d')!;
  const cx = W / 2;
  const cy = H / 2;
  const rx = m.w / 2;
  const ry = m.h / 2;
  const put = (x: number, y: number, col: string) => {
    p.fillStyle = col;
    p.fillRect(Math.round(x), Math.round(y), 1, 1);
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d = dx * dx + dy * dy + (hash2(x, y, m.seed) - 0.5) * 0.55;
      if (d >= 1) continue;
      const hh = hash2(x + 9, y + 3, m.seed);
      let col = d < 0.35 ? '#25211f' : d < 0.7 ? '#413c38' : '#615c56';
      if (hh < 0.08) col = '#8a857e';
      else if (hh > 0.94) col = '#16120f';
      put(x, y, col);
    }
  // обугленные балки
  const beams = 4 + Math.floor(hash2(m.seed, 1, 2) * 3);
  for (let i = 0; i < beams; i++) {
    const bx = cx + (hash2(m.seed, i, 3) - 0.5) * rx * 1.3;
    const by = cy + (hash2(m.seed, i, 4) - 0.5) * ry * 1.2;
    const len = 4 + Math.floor(hash2(m.seed, i, 5) * 6);
    const vert = hash2(m.seed, i, 6) < 0.35;
    for (let k = 0; k < len; k++) {
      const x = vert ? bx : bx + k;
      const y = vert ? by + k * 0.8 : by + k * 0.18;
      put(x, y, '#1a1410');
      if (k % 3 === 0) put(x, y - 1, '#4a3626');
    }
  }
  // уцелевший камень фундамента
  for (let i = 0; i < 3; i++) {
    const x = cx + (hash2(m.seed, i, 8) - 0.5) * rx * 1.5;
    const y = cy + (hash2(m.seed, i, 9) - 0.5) * ry * 1.4;
    put(x, y, '#7a7f8e');
    put(x + 1, y, '#5a5f6e');
    put(x, y - 1, '#a0a6b6');
  }
  return c;
}

function paintShield(m: Mark): Cv {
  const W = 20;
  const H = 14;
  const c = mk(W, H);
  const p = c.getContext('2d')!;
  const face = SHIELD_FACES[Math.floor(hash2(m.seed, 1, 1) * SHIELD_FACES.length)];
  const rim = '#3a2410';
  const cx = 9;
  const cy = 7;
  const tilt = (hash2(m.seed, 2, 2) - 0.5) * 0.9;
  const dx = Math.cos(tilt) * 1.0;
  const dy = Math.sin(tilt) * 1.0;
  const px = (x: number, y: number, col: string) => {
    p.fillStyle = col;
    p.fillRect(Math.round(x), Math.round(y), 1, 1);
  };
  // две половины расколотого щита
  for (let half = 0; half < 2; half++) {
    const side = half === 0 ? -1 : 1;
    const ox = cx + side * (1.6 * dx + 1.2);
    const oy = cy + side * (1.6 * dy + 0.3) + (half === 0 ? -0.5 : 0.8);
    for (let y = -4; y <= 4; y++)
      for (let x = -5; x <= 5; x++) {
        const d = (x * x) / 24 + (y * y) / 13;
        if (d > 1) continue;
        // линия раскола (скошенная)
        const cut = x * Math.cos(tilt + 1.4) + y * Math.sin(tilt + 1.4);
        if (side < 0 ? cut > -0.3 : cut < 0.3) continue;
        const edge = d > 0.68;
        px(ox + x, oy + y, edge ? rim : y < -1 && d < 0.5 ? shade(face, 1.3) : face);
      }
  }
  // умбон (стальной «горб») на уцелевшей половине
  px(cx - 4, cy - 1, '#c0c6d4');
  px(cx - 5, cy - 1, '#7a7f8e');
  // щепки и обломок стрелы
  for (let i = 0; i < 4; i++) px(cx + (hash2(m.seed, i, 3) - 0.5) * 16, cy + (hash2(m.seed, i, 4) - 0.5) * 9, '#8a5e36');
  const ax = 3 + Math.floor(hash2(m.seed, 5, 5) * 6);
  for (let k = 0; k < 7; k++) px(ax + k, 11 - k * 0.25, '#a47848');
  px(ax + 7, 9, '#d8d8e0');
  px(ax - 1, 12, '#e8e8e8');
  return c;
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * k));
  const b = Math.min(255, Math.round((n & 255) * k));
  return `rgb(${r},${g},${b})`;
}

function paintRubble(m: Mark): Cv {
  const W = m.w + 2;
  const H = m.h + 2;
  const c = mk(W, H);
  const p = c.getContext('2d')!;
  const px = (x: number, y: number, col: string) => {
    p.fillStyle = col;
    p.fillRect(Math.round(x), Math.round(y), 1, 1);
  };
  // пыль
  for (let i = 0; i < 22; i++) px(2 + hash2(m.seed, i, 1) * (W - 4), 2 + hash2(m.seed, i, 2) * (H - 4), 'rgba(190,176,150,0.55)');
  const n = 6 + Math.floor(hash2(m.seed, 3, 3) * 4);
  for (let i = 0; i < n; i++) {
    const x = 2 + hash2(m.seed, i, 4) * (W - 7);
    const y = 2 + hash2(m.seed, i, 5) * (H - 6);
    const s = 1 + Math.floor(hash2(m.seed, i, 6) * 3);
    for (let yy = 0; yy < s; yy++) for (let xx = 0; xx < s + 1; xx++) px(x + xx, y + yy, yy === s - 1 ? '#4a4e5c' : '#8a8e9c');
    px(x, y, '#c8cedc');
    if (s > 1) px(x + 1, y, '#b0b6c6');
  }
  return c;
}

function paint(m: Mark): Cv {
  return m.kind === 'ash' ? paintAsh(m) : m.kind === 'shield' ? paintShield(m) : paintRubble(m);
}

export function drawMarks(ctx: CanvasRenderingContext2D, g: Game, left: number, top: number, vw: number, vh: number) {
  const a = marksOf(g);
  if (!a.length) return;
  const dt = g.fdt;
  for (let i = a.length - 1; i >= 0; i--) {
    const m = a[i];
    const age = g.time - m.born;
    if (age < 0 || age > m.life) {
      a.splice(i, 1);
      continue;
    }
    if (m.x < left - 40 || m.x > left + vw + 40 || m.y < top - 40 || m.y > top + vh + 40) continue;
    if (!m.cv) m.cv = paint(m);
    const fadeIn = Math.min(1, age / 2.5);
    const fadeOut = Math.min(1, (m.life - age) / (m.life * 0.28));
    ctx.globalAlpha = Math.max(0, Math.min(1, fadeIn * fadeOut)) * (m.kind === 'ash' ? 0.92 : 1);
    ctx.drawImage(m.cv, Math.round(m.x - m.cv.width / 2), Math.round(m.y - m.cv.height / 2));
    ctx.globalAlpha = 1;
    if (m.kind === 'ash' && age < 50) {
      // тлеющие угольки и тонкий дымок
      const k = 1 - age / 50;
      for (let e = 0; e < 4; e++) {
        const ex = m.x + (hash2(m.seed, e, 21) - 0.5) * m.w * 0.7;
        const ey = m.y + (hash2(m.seed, e, 22) - 0.5) * m.h * 0.6;
        const pulse = 0.5 + 0.5 * Math.sin(g.waterT * 5 + e * 2.1 + m.seed);
        ctx.globalAlpha = k * pulse * 0.9;
        ctx.fillStyle = pulse > 0.6 ? '#ffb040' : '#e8541c';
        ctx.fillRect(Math.round(ex), Math.round(ey), 1, 1);
      }
      ctx.globalAlpha = 1;
      if (Math.random() < dt * 1.6 * k)
        g.particles.push({ x: m.x + (Math.random() - 0.5) * m.w * 0.5, y: m.y - 2, vx: 1.2, vy: -6 - Math.random() * 3, life: 2.4, max: 2.4, color: 'rgba(120,118,126,0.5)', size: 2, grav: 0, grow: 3 });
    }
  }
}
