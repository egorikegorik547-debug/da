import { BUILDINGS, TH, TW } from './data';
import type { Building, Game, Unit } from './game';
import { lightOf } from './fx';
import { hash2 } from './rng';
import { TECH_BUILD_BY_ID } from './techbuild';

type Ctx = CanvasRenderingContext2D;
const R = (ctx: Ctx, x: number, y: number, w: number, h: number, c: string) => {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
};

const FLAG = ['#d94a4a', '#e8a33a', '#4a8ad9', '#58b85a', '#b362ff', '#e86aa0'];

/** Видимые перемены в быту зданий: кувшины, знамёна, вагонетки, пчёлы, патрули с фонарями */
export function drawTechProps(ctx: Ctx, g: Game, b: Building, dx: number, dy: number, w: number, h: number) {
  const def = BUILDINGS[b.type];
  if (!def) return;
  const t = g.waterT;
  const base = dy + h - 1;
  const home = def.housing > 0 && b.type !== 'camp';

  // гончарное дело: кувшины у домов
  if (home && g.done.has('pottery')) {
    const jx = dx + 3 + Math.floor(hash2(b.id, 3, 5) * 4);
    R(ctx, jx, base - 5, 4, 5, '#a8643a');
    R(ctx, jx + 1, base - 7, 2, 2, '#8a4e2a');
    R(ctx, jx, base - 4, 1, 3, '#c98a56');
    if (w > 30) {
      R(ctx, dx + w - 8, base - 4, 3, 4, '#b8744a');
      R(ctx, dx + w - 8, base - 5, 3, 1, '#8a4e2a');
    }
  }
  // ткачество: знамёна на крышах
  if ((home || b.type === 'hall' || b.type === 'market') && g.done.has('weaving')) {
    const col = FLAG[Math.floor(hash2(b.id, 9, 1) * FLAG.length)];
    const px = dx + Math.floor(w * 0.72);
    const top = dy + 2;
    R(ctx, px, top, 1, 9, '#3a2a1a');
    const wave = Math.round(Math.sin(t * 3 + b.id) * 1);
    R(ctx, px + 1, top, 6, 4, col);
    R(ctx, px + 1 + wave, top + 4, 4, 1, col);
    R(ctx, px + 1, top, 6, 1, 'rgba(255,255,255,0.35)');
  }
  // рельсы и вагонетки у шахт
  const tb = TECH_BUILD_BY_ID[b.type];
  const isMine = def.arch === 'mine' || tb?.special?.includes('rails');
  if (isMine && g.done.has('mine_carts')) {
    const y0 = base + 1;
    R(ctx, dx - 6, y0, w + 12, 1, '#5a5048');
    R(ctx, dx - 6, y0 + 2, w + 12, 1, '#5a5048');
    for (let i = -6; i < w + 6; i += 4) R(ctx, dx + i, y0 - 0, 1, 3, '#6a4a2a');
    const k = (Math.sin(t * 0.8 + b.id) + 1) / 2;
    const cx = dx - 4 + k * (w + 6);
    R(ctx, cx, y0 - 5, 8, 5, '#6a6a74');
    R(ctx, cx + 1, y0 - 7, 6, 2, '#2a2a30');
    R(ctx, cx + 1, y0 - 1, 2, 2, '#222');
    R(ctx, cx + 5, y0 - 1, 2, 2, '#222');
  }
  // пчёлы вокруг пасеки
  if (tb?.special?.includes('bees')) {
    for (let i = 0; i < 7; i++) {
      const a = t * (1.6 + i * 0.13) + i * 1.9;
      const bx = dx + w / 2 + Math.cos(a) * (8 + (i % 3) * 4);
      const by = dy + h * 0.55 + Math.sin(a * 1.3) * (5 + (i % 2) * 4);
      R(ctx, bx, by, 2, 1, '#ffd23a');
      R(ctx, bx, by - 1, 1, 1, 'rgba(255,255,255,0.8)');
    }
    for (let i = 0; i < 3; i++) {
      R(ctx, dx + 5 + i * 8, base - 6, 5, 6, '#e0b050');
      R(ctx, dx + 5 + i * 8, base - 7, 5, 1, '#8a5a24');
    }
  }
  // пост стражи: патруль с фонарём
  if (tb?.special?.includes('patrol')) {
    const night = 1 - lightOf(g);
    const a = t * 0.35 + b.id;
    const px = (b.x + b.w / 2) * TW + Math.cos(a) * (b.w * TW * 0.9);
    const py = (b.y + b.h) * TH + Math.sin(a) * 5 + 4;
    R(ctx, px - 1, py - 8, 3, 7, '#3a4a6a');
    R(ctx, px - 1, py - 10, 3, 2, '#e8c8a0');
    R(ctx, px + 2, py - 6, 2, 3, '#ffd870');
    if (night > 0.25) {
      ctx.globalAlpha = 0.18 * night;
      ctx.fillStyle = '#ffd870';
      ctx.beginPath();
      ctx.arc(px + 3, py - 5, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  // колодец: ведро и вода
  if (b.type === 'tb_well') R(ctx, dx + 1, dy + 3, 2, 2, '#9fd8ff');
}

/** Тележки у работников и носильщиков */
export function drawTechUnit(ctx: Ctx, g: Game, u: Unit) {
  if (!g.done.has('wheel') || u.child || u.carry.n <= 0 || u.sleeping) return;
  const fx = Math.round(u.x * TW);
  const fy = Math.round(u.y * TH);
  const side = u.fx > 2 ? -1 : 1;
  const cx = fx + side * 8 - 4;
  R(ctx, cx, fy - 7, 8, 4, '#8a5a30');
  R(ctx, cx, fy - 8, 8, 1, '#5a3a1e');
  const col = u.carry.type === 'stone' ? '#b4bccc' : u.carry.type === 'food' ? '#e86a7a' : u.carry.type === 'goods' ? '#7fd8e0' : '#c8975a';
  R(ctx, cx + 1, fy - 9, 6, 2, col);
  R(ctx, cx + 1, fy - 3, 2, 2, '#2a1a10');
  R(ctx, cx + 5, fy - 3, 2, 2, '#2a1a10');
  R(ctx, cx + (side > 0 ? -3 : 8), fy - 5, 3, 1, '#5a3a1e');
}
