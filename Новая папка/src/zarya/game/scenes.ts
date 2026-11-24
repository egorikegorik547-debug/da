/** Живые микро-сценки: беседы свободных жителей лицом к лицу и догонялки детей вокруг домов. */
import { B, BUILDINGS, TH, TW } from './data';
import type { Game, Unit } from './game';
import { hash2 } from './rng';
import { CLOTH, SKIN } from './sprites';

type Ctx = CanvasRenderingContext2D;

interface Talk {
  id: number;
  a: Unit;
  b: Unit;
  t: number;
  dur: number;
  turn: number;
}
interface TrailPt {
  x: number;
  y: number;
  t: number;
}
interface Chase {
  id: number;
  runner: Unit;
  chaser: Unit;
  t: number;
  dur: number;
  loop: { x: number; y: number }[];
  idx: number;
  dir: 1 | -1;
  trail: TrailPt[];
  lag: number;
  tagAt: number;
}
interface Scenes {
  talks: Talk[];
  chases: Chase[];
  scanT: number;
  chaseT: number;
  last: number;
  nextId: number;
}

const S = new WeakMap<Game, Scenes>();
/** юниты, которые сейчас «бегут» (для анимации бега) */
export const chaseRunIds = new Set<number>();

export interface SceneView {
  kind: 'talk' | 'chase';
  /** собеседник */
  partner: Unit;
  /** сейчас говорит */
  speaking: boolean;
  /** 0 — обычный разговор, 1 — восклицание, 2 — смех, 3 — вопрос */
  mood: number;
  /** сдвиг тела по вертикали, px */
  bob: number;
  /** фаза жеста */
  phase: number;
}
const viewById = new Map<number, SceneView>();

export function sceneOf(u: Unit): SceneView | undefined {
  return viewById.get(u.id);
}

const nightNow = (g: Game) => g.life.sleepTime;

function isIdleAdult(u: Unit): boolean {
  return !u.child && u.spawn <= 0 && !u.sleeping && !u.goHome && u.role === 'none' && u.status === 'free' && u.task.type === 'idle' && !u.moving && u.path.length === 0 && !u.visit && !((u.flee ?? 0) > 0);
}
function isIdleFolk(u: Unit): boolean {
  return u.role === 'folk' && !u.sleeping && u.spawn <= 0 && !u.moving && u.path.length === 0 && !((u.flee ?? 0) > 0);
}

function face(u: Unit, o: Unit) {
  const dx = o.x - u.x;
  const dy = o.y - u.y;
  if (Math.abs(dx) > Math.abs(dy) * 0.8) {
    u.fx = dx >= 0 ? 2 : 3;
    u.dir = u.fx;
  } else u.dir = dy > 0 ? 0 : 1;
}

function walkable(g: Game, x: number, y: number): boolean {
  const w = g.world;
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 1 || ty < 1 || tx >= w.w - 1 || ty >= w.h - 1) return false;
  const i = ty * w.w + tx;
  return !w.blocked[i] && w.biome[i] > B.WATER;
}

/* ───────────── Беседы ───────────── */

function scanTalks( sc: Scenes, list: Unit[], idle: (u: Unit) => boolean) {
  const busy = new Set<number>();
  for (const t of sc.talks) {
    busy.add(t.a.id);
    busy.add(t.b.id);
  }
  const free = list.filter((u) => !busy.has(u.id) && idle(u));
  for (let i = 0; i < free.length; i++) {
    const a = free[i];
    if (busy.has(a.id)) continue;
    for (let j = i + 1; j < free.length; j++) {
      const b = free[j];
      if (busy.has(b.id)) continue;
      const d = Math.hypot(a.x - b.x, (a.y - b.y) * 1.4);
      if (d > 2.1 || d < 0.35) continue;
      if (Math.random() > 0.55) continue;
      busy.add(a.id);
      busy.add(b.id);
      sc.talks.push({ id: sc.nextId++, a, b, t: 0, dur: 5 + Math.random() * 7, turn: Math.floor(Math.random() * 2) });
      break;
    }
  }
}

function updateTalks(g: Game, sc: Scenes, dt: number) {
  const night = nightNow(g);
  for (let i = sc.talks.length - 1; i >= 0; i--) {
    const k = sc.talks[i];
    const { a, b } = k;
    k.t += dt;
    const broken = (u: Unit) => u.sleeping || u.moving || u.path.length > 0 || u.task.type !== 'idle' && !(u.role === 'folk') || u.spawn > 0 || (u.flee ?? 0) > 0 || !!u.goHome;
    const gone = Math.hypot(a.x - b.x, a.y - b.y) > 3.4;
    if (night || k.t > k.dur || gone || broken(a) || broken(b)) {
      sc.talks.splice(i, 1);
      continue;
    }
    for (const u of [a, b]) {
      u.moving = false;
      u.wander = Math.max(u.wander, 2.2);
      if (u.role === 'folk') u.phase = 'goto';
    }
    face(a, b);
    face(b, a);
    // чья очередь говорить
    const cyc = 1.8 + hash2(k.id, 1, 3) * 1.2;
    const turnIdx = Math.floor((k.t + k.turn * cyc) / cyc);
    const speaker = turnIdx % 2 === 0 ? a : b;
    const mood = Math.floor(hash2(k.id, turnIdx, 7) * 4);
    const local = (k.t + k.turn * cyc) % cyc;
    for (const u of [a, b]) {
      const sp = u === speaker;
      const phase = g.waterT * (mood === 1 ? 9 : 6.5) + u.id;
      let bob = 0;
      if (sp && mood === 1 && Math.sin(phase * 1.3) > 0.85) bob = -1;
      if (sp && mood === 2 && local < 0.5 && Math.sin(g.waterT * 14 + u.id) > 0) bob = -1;
      if (!sp && Math.sin(g.waterT * 2.6 + u.id * 2) > 0.92) bob = -1; // кивок слушателя
      viewById.set(u.id, { kind: 'talk', partner: u === a ? b : a, speaking: sp, mood, bob, phase });
    }
    // смешок — всплывающая нотка
    if (mood === 2 && local < dt * 1.2 && Math.random() < 0.5) g.floatText(speaker.x * TW, speaker.y * TH - 27, '♪', '#ffe27a');
  }
}

/* ───────────── Догонялки детей ───────────── */

function makeLoop(g: Game, b: { x: number; y: number; w: number; h: number }): { x: number; y: number }[] | null {
  const x0 = b.x - 0.9;
  const x1 = b.x + b.w + 0.9;
  const y0 = b.y - 0.55;
  const y1 = b.y + b.h + 0.95;
  const xm = (x0 + x1) / 2;
  const ym = (y0 + y1) / 2;
  const pts = [
    { x: x0, y: y0 },
    { x: xm, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: ym },
    { x: x1, y: y1 },
    { x: xm, y: y1 },
    { x: x0, y: y1 },
    { x: x0, y: ym },
  ];
  for (const p of pts) if (!walkable(g, p.x, p.y)) return null;
  return pts;
}

function startChase(g: Game, sc: Scenes) {
  if (sc.chases.length >= 2) return;
  const busy = new Set<number>();
  for (const c of sc.chases) {
    busy.add(c.runner.id);
    busy.add(c.chaser.id);
  }
  for (const t of sc.talks) {
    busy.add(t.a.id);
    busy.add(t.b.id);
  }
  const kids = g.units.filter((u) => u.child && u.spawn <= 0 && !u.sleeping && !u.goHome && u.task.type === 'idle' && !busy.has(u.id) && !((u.flee ?? 0) > 0));
  if (kids.length < 2) return;
  const a = kids[Math.floor(Math.random() * kids.length)];
  const near = kids.filter((k) => k !== a && Math.hypot(k.x - a.x, k.y - a.y) < 6);
  if (!near.length) return;
  const b = near[Math.floor(Math.random() * near.length)];
  // дом поблизости
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const homes = g.buildings
    .filter((q) => q.done && q.type !== 'campfire' && q.type !== 'farm' && BUILDINGS[q.type] && Math.hypot(q.x + q.w / 2 - cx, q.y + q.h / 2 - cy) < 7)
    .sort((p, q) => Math.hypot(p.x + p.w / 2 - cx, p.y + p.h / 2 - cy) - Math.hypot(q.x + q.w / 2 - cx, q.y + q.h / 2 - cy));
  for (const h of homes.slice(0, 4)) {
    const loop = makeLoop(g, h);
    if (!loop) continue;
    // стартуем с ближайшей к бегущему точки и проверяем путь до неё
    let bi = 0;
    let bd = 1e9;
    loop.forEach((p, i) => {
      const d = Math.hypot(p.x - a.x, p.y - a.y);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    });
    if (bd > 5) continue;
    let clear = true;
    for (let s = 1; s <= 8 && clear; s++) {
      const k = s / 8;
      if (!walkable(g, a.x + (loop[bi].x - a.x) * k, a.y + (loop[bi].y - a.y) * k)) clear = false;
    }
    if (!clear) continue;
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    sc.chases.push({
      id: sc.nextId++,
      runner: a,
      chaser: b,
      t: 0,
      dur: 14 + Math.random() * 12,
      loop,
      idx: bi,
      dir,
      trail: [{ x: a.x, y: a.y, t: 0 }],
      lag: 1.0,
      tagAt: 6 + Math.random() * 4,
    });
    return;
  }
}

function endChase(c: Chase) {
  for (const u of [c.runner, c.chaser]) {
    u.moving = false;
    u.path = [];
    u.wander = 1 + Math.random() * 3;
    chaseRunIds.delete(u.id);
  }
}

function stepToward(g: Game, u: Unit, tx: number, ty: number, sp: number, dt: number): boolean {
  const dx = tx - u.x;
  const dy = ty - u.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.02) return true;
  const step = Math.min(d, sp * dt);
  const nx = u.x + (dx / d) * step;
  const ny = u.y + (dy / d) * step;
  if (!walkable(g, nx, ny)) return false;
  u.x = nx;
  u.y = ny;
  if (Math.abs(dx) > Math.abs(dy) * 0.9) {
    u.dir = dx > 0 ? 2 : 3;
    u.fx = u.dir;
  } else u.dir = dy > 0 ? 0 : 1;
  u.anim += dt * sp * 1.7;
  u.moving = true;
  u.phase = 'goto';
  return true;
}

function updateChases(g: Game, sc: Scenes, dt: number) {
  const night = nightNow(g);
  for (let i = sc.chases.length - 1; i >= 0; i--) {
    const c = sc.chases[i];
    const { runner, chaser } = c;
    c.t += dt;
    const alive = (u: Unit) => g.units.indexOf(u) >= 0;
    const broken = (u: Unit) => u.sleeping || u.task.type !== 'idle' || u.spawn > 0 || (u.flee ?? 0) > 0 || !!u.goHome;
    if (night || c.t > c.dur || broken(runner) || broken(chaser) || (c.t < 0.3 && (!alive(runner) || !alive(chaser)))) {
      endChase(c);
      sc.chases.splice(i, 1);
      continue;
    }
    for (const u of [runner, chaser]) {
      u.wander = Math.max(u.wander, 3);
      u.path = [];
      chaseRunIds.add(u.id);
    }
    const sp = 3.1;
    // бегущий идёт по кругу вокруг дома
    const wp = c.loop[c.idx];
    if (Math.hypot(wp.x - runner.x, wp.y - runner.y) < 0.3) c.idx = (c.idx + c.dir + c.loop.length) % c.loop.length;
    const tgt = c.loop[c.idx];
    if (!stepToward(g, runner, tgt.x, tgt.y, sp, dt)) {
      endChase(c);
      sc.chases.splice(i, 1);
      continue;
    }
    c.trail.push({ x: runner.x, y: runner.y, t: c.t });
    while (c.trail.length > 2 && c.trail[1].t < c.t - c.lag) c.trail.shift();
    // преследователь бежит по следу с отставанием; перед «салками» сокращает разрыв
    const toTag = c.tagAt - c.t;
    const wantLag = toTag < 1.4 ? 0.12 : 0.85;
    c.lag += (wantLag - c.lag) * Math.min(1, dt * 1.8);
    const tp = c.trail[0];
    if (!stepToward(g, chaser, tp.x, tp.y, sp * 1.18, dt)) {
      endChase(c);
      sc.chases.splice(i, 1);
      continue;
    }
    // «догнал!» — меняются ролями
    if (c.t >= c.tagAt) {
      g.floatText(chaser.x * TW, chaser.y * TH - 26, '😄', '#ffe27a');
      const nr = chaser;
      c.chaser = runner;
      c.runner = nr;
      // новый бегущий продолжает круг в ближайшей точке
      let bi = c.idx;
      let bd = 1e9;
      c.loop.forEach((p, k) => {
        const d = Math.hypot(p.x - nr.x, p.y - nr.y);
        if (d < bd) {
          bd = d;
          bi = k;
        }
      });
      c.idx = bi;
      c.dir = Math.random() < 0.3 ? ((-c.dir) as 1 | -1) : c.dir;
      c.trail = [{ x: nr.x, y: nr.y, t: c.t }];
      c.lag = 0.9;
      c.tagAt = c.t + 5 + Math.random() * 5;
    }
    viewById.set(runner.id, { kind: 'chase', partner: chaser, speaking: false, mood: 2, bob: 0, phase: 0 });
    viewById.set(chaser.id, { kind: 'chase', partner: runner, speaking: false, mood: 2, bob: 0, phase: 0 });
  }
}

/* ───────────── Главный цикл ───────────── */

export function updateScenes(g: Game, dt: number) {
  viewById.clear();
  if (g.mode !== 'play') {
    chaseRunIds.clear();
    return;
  }
  let sc = S.get(g);
  if (!sc) {
    sc = { talks: [], chases: [], scanT: 0, chaseT: 4, last: g.time, nextId: 1 };
    S.set(g, sc);
  }
  if (g.time < sc.last - 0.5) {
    // перемотка (загрузка сохранения): сцены сбрасываем
    for (const c of sc.chases) endChase(c);
    sc.talks = [];
    sc.chases = [];
    chaseRunIds.clear();
  }
  sc.last = g.time;
  const night = nightNow(g);
  sc.scanT -= dt;
  if (sc.scanT <= 0) {
    sc.scanT = 0.6;
    if (!night && sc.talks.length < 14) {
      scanTalks(sc, g.units, isIdleAdult);
      for (const t of g.towns) if (t.folk.length > 1) scanTalks(sc, t.folk, isIdleFolk);
    }
  }
  sc.chaseT -= dt;
  if (sc.chaseT <= 0) {
    sc.chaseT = 2 + Math.random() * 3;
    if (!night && Math.random() < 0.5) startChase(g, sc);
  }
  updateTalks(g, sc, dt);
  updateChases(g, sc, dt);
}

/* ───────────── Отрисовка жестов и «пузырей» речи ───────────── */

function bubble(ctx: Ctx, x: number, y: number, mood: number, t: number) {
  // облачко 11×7 с хвостиком
  ctx.fillStyle = '#2a1c10';
  ctx.fillRect(x - 5, y - 1, 11, 7);
  ctx.fillRect(x - 6, y, 13, 5);
  ctx.fillStyle = '#fffaf0';
  ctx.fillRect(x - 5, y, 11, 5);
  ctx.fillRect(x - 4, y - 1 + 1, 9, 5);
  ctx.fillStyle = '#2a1c10';
  ctx.fillRect(x - 1, y + 6, 3, 1);
  ctx.fillStyle = '#fffaf0';
  ctx.fillRect(x, y + 5, 1, 1);
  if (mood === 0) {
    const n = Math.floor(t * 3.2) % 4;
    ctx.fillStyle = '#4a3a2a';
    for (let i = 0; i < 3; i++) if (i < n) ctx.fillRect(x - 3 + i * 3, y + 3, 2, 1);
  } else if (mood === 1) {
    ctx.fillStyle = '#d83a3a';
    ctx.fillRect(x, y + 1, 1, 2);
    ctx.fillRect(x, y + 4, 1, 1);
  } else if (mood === 2) {
    ctx.fillStyle = '#e0a020';
    ctx.fillRect(x - 1, y + 1, 1, 3);
    ctx.fillRect(x - 3, y + 3, 2, 1);
    ctx.fillRect(x - 1, y + 1, 3, 1);
    ctx.fillRect(x + 1, y + 2, 1, 2);
    ctx.fillRect(x, y + 3, 2, 1);
  } else {
    ctx.fillStyle = '#3a6ad8';
    ctx.fillRect(x - 1, y + 1, 3, 1);
    ctx.fillRect(x + 1, y + 2, 1, 1);
    ctx.fillRect(x, y + 3, 1, 1);
  }
}

/** жесты рук и реплики над головами беседующих */
export function drawSceneFx(ctx: Ctx, g: Game, u: Unit, fx: number, fy: number) {
  const v = viewById.get(u.id);
  if (!v || v.kind !== 'talk' || u.moving) return;
  const t = g.waterT;
  const look = u.look;
  const skin = SKIN[look.skin]?.[0] ?? '#f0c8a0';
  const sleeve = CLOTH[look.cloth]?.[0] ?? '#9a6a3a';
  const side = v.partner.x >= u.x ? 1 : -1;
  const dir = u.dir;
  const kidK = u.child ? 3 : 0;
  const shoulderY = Math.round(fy - 13 + kidK);
  const hand = (hx: number, hy: number) => {
    ctx.fillStyle = sleeve;
    ctx.fillRect(hx - side, hy + 1, 1, 2);
    ctx.fillStyle = skin;
    ctx.fillRect(hx, hy, 2, 2);
  };
  if (v.speaking) {
    const beat = Math.sin(v.phase * 1.7);
    const lift = v.mood === 1 ? Math.round((0.5 + 0.5 * beat) * 5) : Math.round((0.5 + 0.5 * beat) * 3);
    if (dir === 2 || dir === 3) {
      const hx = Math.round(fx + side * 5);
      hand(hx, shoulderY + 3 - lift);
      if (v.mood === 1) hand(Math.round(fx - side * 5), shoulderY + 4 - Math.round((0.5 + 0.5 * Math.sin(v.phase * 1.7 + 2)) * 4));
    } else {
      hand(Math.round(fx - 6), shoulderY + 3 - lift);
      hand(Math.round(fx + 5), shoulderY + 3 - Math.round((0.5 + 0.5 * Math.sin(v.phase * 1.7 + 1.6)) * 3));
    }
    ctx.globalAlpha = 0.97;
    bubble(ctx, Math.round(fx + side * 5), Math.round(fy - (u.child ? 33 : 38)), v.mood, t);
    ctx.globalAlpha = 1;
  } else if (Math.sin(t * 1.7 + u.id) > 0.55) {
    // слушающий иногда машет рукой / разводит руками
    const wave = Math.round(Math.sin(t * 9 + u.id) * 1);
    hand(Math.round(fx + side * 5) + wave, shoulderY + 3);
  }
}
