/** Эволюция главной «Стоянки»: шатры → деревянный терем → каменная ратуша (по эпохе). */
import type { BuildingSprites, Cv } from './sprites';
import { mk } from './sprites';
import { finishSprite } from './gfx';
import { hash2 } from './rng';
import { chron } from './extstate';
import { TH, TW } from './data';
import type { Game } from './game';

export const CAMP_ERA_NAMES = ['Стоянка (шатры)', 'Деревянный терем', 'Каменная ратуша'];

class Pt {
  c: Cv;
  g: CanvasRenderingContext2D;
  constructor(public w: number, public h: number) {
    this.c = mk(w, h);
    this.g = this.c.getContext('2d')!;
  }
  r(x: number, y: number, w: number, h: number, col: string) {
    this.g.fillStyle = col;
    this.g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  px(x: number, y: number, col: string) {
    this.r(x, y, 1, 1, col);
  }
  line(x0: number, y0: number, x1: number, y1: number, col: string) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, col);
  }
  ell(cx: number, cy: number, rx: number, ry: number, col: string) {
    this.g.fillStyle = col;
    for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) {
      const t = 1 - (y * y) / (ry * ry + 0.001);
      if (t < 0) continue;
      const hw = Math.round(rx * Math.sqrt(t));
      this.g.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2 + 1, 1);
    }
  }
  /** трапеция по строкам: цвет выбирает функция */
  trap(y0: number, y1: number, xl0: number, xr0: number, xl1: number, xr1: number, fn: (x: number, y: number, k: number, xl: number, xr: number) => string) {
    for (let y = y0; y <= y1; y++) {
      const k = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
      const xl = Math.round(xl0 + (xl1 - xl0) * k);
      const xr = Math.round(xr0 + (xr1 - xr0) * k);
      for (let x = xl; x <= xr; x++) this.px(x, y, fn(x, y, k, xl, xr));
    }
  }
}

interface EraSet {
  cv: Cv;
  fire?: { x: number; y: number };
  smoke?: { x: number; y: number };
  flag?: { dx: number; dy: number };
}

/* ───────────── Деревянный терем ───────────── */

function teremSprite(): EraSet {
  const W = 56;
  const H = 60;
  const p = new Pt(W, H);
  const cx = 28;
  const bot = H - 1;
  // двор
  p.ell(cx, bot - 4, 26, 5, 'rgba(70,52,30,0.55)');
  p.ell(cx, bot - 4, 21, 3.5, 'rgba(104,80,46,0.65)');
  for (let i = 0; i < 26; i++) p.px(6 + Math.floor(hash2(i, 1, 41) * 44), bot - 7 + Math.floor(hash2(i, 2, 41) * 8), hash2(i, 3, 41) < 0.5 ? '#5a4228' : '#8a6a40');

  const logWall = (x: number, y: number, w: number, h: number, seed: number) => {
    for (let yy = y; yy < y + h; yy += 3) {
      p.r(x, yy, w, 3, '#8a5e36');
      p.r(x, yy, w, 1, '#b4804a');
      p.r(x, yy + 2, w, 1, '#53341c');
      for (let k = 0; k < 2; k++) {
        const kx = x + 2 + Math.floor(hash2(yy, k, seed) * (w - 4));
        p.px(kx, yy + 1, '#6a4524');
      }
      p.r(x - 1, yy, 2, 3, '#c89a64');
      p.px(x - 1, yy + 1, '#a47848');
      p.r(x + w - 1, yy, 2, 3, '#c89a64');
      p.px(x + w, yy + 1, '#a47848');
    }
  };
  const window7 = (x: number, y: number) => {
    p.r(x - 1, y - 1, 7, 8, '#b8452a'); // резной наличник
    p.r(x, y, 5, 6, '#3a2616');
    p.r(x + 1, y + 1, 3, 4, '#f6d36a');
    p.r(x + 1, y + 3, 3, 2, '#e8a83a');
    p.r(x + 2, y + 1, 1, 4, '#3a2616');
    p.px(x - 1, y - 1, '#e8c860');
    p.px(x + 5, y - 1, '#e8c860');
    p.r(x - 1, y + 7, 7, 1, '#7a3a20');
  };

  // нижний ярус и верхний ярус
  logWall(7, 38, 42, 17, 3);
  logWall(13, 24, 30, 14, 9);
  for (const wx of [17, 26, 35]) {
    p.r(wx - 1, 27, 6, 7, '#b8452a');
    p.r(wx, 28, 4, 5, '#f6d36a');
    p.r(wx, 31, 4, 2, '#e8a83a');
    p.r(wx + 1, 28, 1, 5, '#3a2616');
    p.px(wx - 1, 27, '#e8c860');
    p.px(wx + 4, 27, '#e8c860');
  }
  window7(11, 43);
  window7(39, 43);
  // дверь с аркой
  p.r(23, 43, 10, 12, '#2a180a');
  p.r(24, 45, 8, 10, '#5a3a22');
  p.r(25, 44, 6, 1, '#5a3a22');
  p.r(26, 43, 4, 1, '#5a3a22');
  for (let i = 25; i < 32; i += 2) p.r(i, 44, 1, 11, '#47301c');
  p.px(30, 50, '#e8c860');
  p.r(22, 42, 1, 13, '#b8452a');
  p.r(33, 42, 1, 13, '#b8452a');
  p.r(22, 41, 12, 1, '#b8452a');
  p.px(21, 41, '#e8c860');
  p.px(34, 41, '#e8c860');
  // ступени и фундамент
  p.r(20, 55, 16, 2, '#9a9aa6');
  p.r(20, 55, 16, 1, '#c0c0cc');
  p.r(18, 57, 20, 2, '#7a7a88');
  p.r(18, 57, 20, 1, '#9a9aa6');
  p.r(7, 55, 13, 1, '#6a6a76');
  p.r(36, 55, 13, 1, '#6a6a76');

  // дымоход
  for (let y = 12; y < 34; y++) {
    p.r(40, y, 5, 1, hash2(40, y, 5) < 0.4 ? '#7a7a88' : '#9a9aa6');
    p.px(40, y, '#52525e');
  }
  p.r(39, 11, 7, 2, '#52525e');
  p.r(39, 11, 7, 1, '#7a7a88');

  // нижний скат (подзор)
  p.trap(32, 40, 9, 46, 2, 53, (x, y, _k, xl, xr) => {
    const band = Math.floor((y - 32) / 3);
    if ((y - 32) % 3 === 2) return '#1e4a40';
    const o = (band % 2) * 2;
    if ((x + o) % 4 === 3) return '#2f6a5a';
    return x < (xl + xr) / 2 ? '#4f9a82' : '#3a7e6a';
  });
  p.r(2, 41, 52, 1, '#1e4a40');
  p.r(3, 42, 50, 1, 'rgba(24,14,60,0.36)');
  p.r(4, 43, 48, 1, 'rgba(24,14,60,0.2)');
  for (let x = 4; x < 52; x += 4) {
    p.px(x, 42, '#e8c860');
    p.px(x + 1, 42, '#e8c860');
  }

  // шатровая крыша
  p.trap(5, 28, 27, 29, 10, 46, (x, y, _k, xl, xr) => {
    const band = Math.floor((y - 5) / 3);
    if ((y - 5) % 3 === 2) return '#1e4a40';
    const o = (band % 2) * 2;
    if ((x + o) % 4 === 3) return '#2f6a5a';
    const mid = (xl + xr) / 2;
    return x < mid - 2 ? '#6ab49a' : x > mid + 6 ? '#2f6a5a' : '#4f9a82';
  });
  p.r(9, 29, 38, 1, '#1e4a40');
  p.r(10, 30, 36, 1, 'rgba(24,14,60,0.3)');
  p.r(27, 1, 2, 5, '#c89a30');
  p.r(26, 0, 4, 3, '#e8c040');
  p.px(27, 0, '#fff0a0');
  // слуховое оконце
  p.r(25, 15, 6, 6, '#1e4a40');
  p.r(26, 16, 4, 4, '#f6d36a');
  p.r(27, 16, 2, 4, '#3a2616');
  p.r(26, 17, 4, 1, '#3a2616');
  p.px(25, 14, '#e8c860');
  p.px(30, 14, '#e8c860');

  // очаг во дворе справа
  const fy = bot - 4;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const x = 47 + Math.cos(a) * 4;
    const y = fy + 1 + Math.sin(a) * 2;
    p.r(x - 1, y - 1, 3, 2, '#7a7f8e');
    p.r(x - 1, y - 1, 3, 1, '#b4b9c8');
  }
  p.ell(47, fy + 1, 3, 1, '#1c1410');
  p.line(44, fy, 50, fy - 1, '#5a3a22');
  return { cv: finishSprite(p.c, { ao: true }), fire: { x: 47, y: fy }, smoke: { x: 42, y: 10 }, flag: { dx: 0, dy: 3 } };
}

/* ───────────── Каменная ратуша ───────────── */

function ratushaSprite(): EraSet {
  const W = 62;
  const H = 78;
  const p = new Pt(W, H);
  const cx = 31;
  const bot = H - 1;
  p.ell(cx, bot - 3, 30, 5, 'rgba(90,90,104,0.5)');
  p.ell(cx, bot - 3, 25, 3.5, 'rgba(150,150,166,0.55)');
  for (let i = 0; i < 30; i++) p.px(4 + Math.floor(hash2(i, 1, 77) * 54), bot - 6 + Math.floor(hash2(i, 2, 77) * 7), hash2(i, 3, 77) < 0.5 ? '#6a6a7a' : '#b4b4c4');

  const brick = (x: number, y: number, w: number, h: number, seed: number) => {
    p.r(x, y, w, h, '#b4b4c0');
    for (let yy = y; yy < y + h; yy += 4) {
      p.r(x, yy + 3, w, 1, '#7c7c8c');
      const off = (Math.floor((yy - y) / 4) % 2) * 4;
      for (let xx = x + off; xx < x + w; xx += 8) p.r(xx, yy, 1, 3, '#8a8a9a');
      for (let k = 0; k < 3; k++) p.px(x + Math.floor(hash2(yy, k, seed) * w), yy + 1, '#c8c8d4');
    }
    p.r(x, y, 1, h, '#d0d0dc');
    p.r(x + w - 1, y, 1, h, '#6a6a7a');
  };
  const arch = (x: number, y: number, w: number, h: number, glass: boolean) => {
    p.r(x - 1, y - 1, w + 2, h + 1, '#e0e0ec');
    p.r(x, y, w, h, glass ? '#f6d36a' : '#3a2616');
    if (glass) {
      p.r(x, y + Math.round(h * 0.55), w, Math.round(h * 0.45), '#e8a83a');
      p.r(x + Math.floor(w / 2), y, 1, h, '#3a2616');
      p.r(x, y + Math.floor(h / 2), w, 1, '#3a2616');
    }
    p.r(x - 2, y + h, w + 4, 1, '#8a8a9a');
  };

  brick(4, 48, 54, 26, 5);
  p.r(4, 48, 3, 26, '#d8d8e4');
  p.r(55, 48, 3, 26, '#9a9aa8');
  p.r(5, 48, 1, 26, '#ececf6');
  p.r(3, 46, 56, 2, '#e0e0ec');
  p.r(3, 48, 56, 1, '#6a6a7a');
  for (const wx of [10, 18, 41, 49]) arch(wx, 55, 4, 8, true);
  // герб
  p.r(28, 53, 7, 8, '#e8c040');
  p.r(29, 54, 5, 6, '#b8283a');
  p.r(30, 55, 3, 1, '#e8c040');
  p.px(31, 56, '#e8c040');
  // дверь
  p.r(25, 62, 13, 12, '#e0e0ec');
  p.r(26, 63, 11, 11, '#3a2616');
  p.r(27, 62, 9, 1, '#3a2616');
  p.r(28, 61, 7, 1, '#e0e0ec');
  p.r(31, 63, 1, 11, '#1a0e06');
  for (const dx of [27, 33]) for (let i = 0; i < 3; i++) p.r(dx, 65 + i * 3, 3, 1, '#5a3a22');
  p.px(30, 69, '#e8c860');
  p.px(32, 69, '#e8c860');
  p.r(21, 74, 21, 2, '#d0d0dc');
  p.r(21, 74, 21, 1, '#ececf6');
  p.r(18, 76, 27, 2, '#9a9aa8');
  p.r(18, 76, 27, 1, '#c0c0cc');

  // красная черепица
  p.trap(36, 47, 14, 48, 1, 61, (x, y, _k, xl, xr) => {
    if ((y - 36) % 3 === 2) return '#4a1814';
    const o = (Math.floor((y - 36) / 3) % 2) * 2;
    if ((x + o) % 4 === 3) return '#8e3426';
    return x < (xl + xr) / 2 ? '#e07a50' : '#bc5236';
  });
  p.r(1, 47, 60, 1, '#4a1814');
  p.r(2, 48, 58, 1, 'rgba(24,14,60,0.3)');

  // дымоходы
  for (const [x0, top] of [[7, 28], [52, 26]] as [number, number][]) {
    for (let y = top; y < 40; y++) p.r(x0, y, 5, 1, hash2(x0, y, 8) < 0.4 ? '#8a7a70' : '#b0a49a');
    p.r(x0 - 1, top - 1, 7, 2, '#5a4a44');
  }

  // башня с часами
  brick(22, 18, 18, 30, 11);
  p.r(22, 18, 2, 30, '#d8d8e4');
  p.r(38, 18, 2, 30, '#8a8a9a');
  p.r(20, 15, 22, 3, '#e0e0ec');
  p.r(20, 18, 22, 1, '#6a6a7a');
  p.ell(31, 28, 6, 5.5, '#2a2018');
  p.ell(31, 28, 5, 4.5, '#f4f0e0');
  for (const [dx, dy] of [[0, -4], [0, 4], [-4, 0], [4, 0]] as [number, number][]) p.px(31 + dx, 28 + dy, '#2a2018');
  p.line(31, 28, 31, 25, '#2a2018');
  p.line(31, 28, 34, 29, '#2a2018');
  arch(26, 37, 3, 6, false);
  arch(33, 37, 3, 6, false);
  p.r(27, 38, 1, 2, '#e8c040');
  p.r(34, 38, 1, 2, '#e8c040');
  // шпиль
  p.trap(3, 14, 31, 31, 21, 41, (x, y, _k, xl, xr) => {
    if ((y - 3) % 3 === 2) return '#26325a';
    const o = (Math.floor((y - 3) / 3) % 2) * 2;
    if ((x + o) % 4 === 3) return '#3a4a78';
    return x < (xl + xr) / 2 ? '#8aa0d8' : '#5a6ea8';
  });
  p.r(20, 14, 22, 1, '#26325a');
  p.r(30, 0, 2, 4, '#e8c040');
  p.px(30, 0, '#fff0a0');

  // жаровни у ступеней
  for (const bx of [14, 44]) {
    p.r(bx, 71, 5, 1, '#3a3a46');
    p.r(bx + 1, 72, 3, 3, '#4a4a58');
    p.r(bx - 1, 70, 7, 1, '#2a2a34');
    p.r(bx, 75, 5, 1, '#2a2a34');
  }
  return { cv: finishSprite(p.c, { ao: true }), fire: { x: 16, y: 70 }, smoke: { x: 54, y: 25 }, flag: { dx: 0, dy: 1 } };
}

let built: EraSet[] | null = null;
function eraSets(): EraSet[] {
  if (built) return built;
  built = [{ cv: null as unknown as Cv }, teremSprite(), ratushaSprite()];
  return built;
}

const originals = new WeakMap<BuildingSprites, { cv: Cv; fire?: { x: number; y: number } }>();
const stateOf = new WeakMap<BuildingSprites, number>();

/** стадия Стоянки по эпохе: 0 — шатры, 1 — терем (поселения…железо), 2 — ратуша (средневековье+) */
export function campStageFor(epochIdx: number): number {
  return epochIdx >= 6 ? 2 : epochIdx >= 3 ? 1 : 0;
}

export function campEra(g: Game): number {
  return stateOf.get(g.bspr) ?? 0;
}

/** подставляет нужный спрайт Стоянки; вызывается из игрового цикла */
export function updateCampEra(g: Game) {
  const b = g.bspr;
  if (!b) return;
  if (!originals.has(b)) originals.set(b, { cv: b.cv.camp, fire: b.fire.camp });
  const want = g.mode === 'play' ? campStageFor(g.epochIdx()) : 0;
  const first = !stateOf.has(b);
  const cur = stateOf.get(b) ?? 0;
  if (!first && cur === want) return;
  stateOf.set(b, want);
  const orig = originals.get(b)!;
  if (want === 0) {
    b.cv.camp = orig.cv;
    if (orig.fire) b.fire.camp = orig.fire;
    delete b.smoke.camp;
  } else {
    const s = eraSets()[want];
    b.cv.camp = s.cv;
    b.fire.camp = s.fire;
    if (s.smoke) b.smoke.camp = s.smoke;
  }
  if (!first && cur !== want && g.mode === 'play' && want > cur) {
    g.msg(`Стоянка преобразилась: ${CAMP_ERA_NAMES[want]}!`, 'good');
    chron(g, `Главная Стоянка стала: ${CAMP_ERA_NAMES[want]}`, 'good');
    const camp = g.buildings[0];
    if (camp) {
      for (let i = 0; i < 26; i++) {
        g.particles.push({
          x: (camp.x + 1) * TW + (Math.random() - 0.5) * 36,
          y: (camp.y + 2) * TH - 8 - Math.random() * 20,
          vx: (Math.random() - 0.5) * 20,
          vy: -10 - Math.random() * 14,
          life: 1.3 + Math.random() * 0.8,
          max: 2.1,
          color: i % 3 === 0 ? '#fff2a0' : i % 3 === 1 ? '#e8c040' : '#ffffff',
          size: 1,
          grav: 8,
        });
      }
      g.sfx('tier');
    }
  }
}

/** флаг на вершине Стоянки */
export function campFlag(g: Game): { col: string; dx: number; dy: number; size: number } {
  const st = campEra(g);
  if (st === 1) return { col: '#e8742a', dx: 0, dy: eraSets()[1].flag!.dy, size: 0.9 };
  if (st === 2) return { col: '#c8303a', dx: 0, dy: eraSets()[2].flag!.dy, size: 1 };
  return { col: '#e8742a', dx: -6, dy: 2, size: 0.9 };
}
