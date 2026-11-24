import { B, TH, TW } from './data';
import type { Game, Unit } from './game';
import { SPECS } from './meta';
import type { Town } from './towns';

function mkFolk(g: Game, t: Town, role: 'folk' | 'guard'): Unit {
  const a = Math.random() * Math.PI * 2;
  const r = 1.5 + Math.random() * 4;
  const u = g.newUnit(t.x + 0.5 + Math.cos(a) * r, t.y + 1.5 + Math.sin(a) * r * 0.7, false);
  u.role = role;
  u.accent = SPECS[t.spec].color;
  if (role === 'guard') {
    u.look.female = false;
    u.look.style = 0;
    u.look.outfit = 0;
    u.look.beard = Math.random() < 0.5;
  }
  u.wander = Math.random() * 3;
  return u;
}

function validTile(g: Game, x: number, y: number) {
  const w = g.world;
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 1 || ty < 1 || tx >= w.w - 1 || ty >= w.h - 1) return false;
  const i = ty * w.w + tx;
  return !w.blocked[i] && w.biome[i] > B.WATER;
}

/** дверь дома, в котором ночует житель селения */
function homeDoor(g: Game, t: Town, u: Unit): { x: number; y: number; id: number; w: number; h: number; bx: number; by: number } {
  const list = t.bld.filter((b) => b.done);
  if (!list.length) return { x: t.x + 0.5, y: t.y + 1.5, id: 0, w: 1, h: 1, bx: t.x, by: t.y };
  const b = list[u.id % list.length];
  let x = b.x + b.w / 2;
  let y = b.y + b.h + 0.5;
  for (let k = 0; k < 3 && !validTile(g, x, y); k++) y += 0.8;
  if (!validTile(g, x, y)) {
    x = b.x - 0.5;
    y = b.y + b.h - 0.5;
  }
  return { x, y, id: b.id, w: b.w, h: b.h, bx: b.x, by: b.y };
}

/** ночью жители чужих селений расходятся по домам и засыпают, как у игрока; true — житель занят сном */
function folkNight(g: Game, t: Town, u: Unit, dt: number): boolean {
  if (u.role === 'guard' && u.id % 2 === 0) {
    // половина стражи несёт ночной караул
    if (u.sleeping) u.sleeping = false;
    return false;
  }
  if (u.sleeping) return true;
  const door = homeDoor(g, t, u);
  const dx = door.x - u.x;
  const dy = door.y - u.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.45 || (u.timer ?? 0) > 14) {
    u.sleeping = true;
    u.moving = false;
    u.path = [];
    u.timer = 0;
    u.home = door.id;
    u.x = door.x;
    u.y = door.y;
    return true;
  }
  const speed = u.role === 'guard' ? 1.4 : 1.9;
  const step = Math.min(dist, speed * dt);
  let nx = u.x + (dx / dist) * step;
  let ny = u.y + (dy / dist) * step;
  if (!validTile(g, nx, ny)) {
    // скользим вдоль препятствия
    if (validTile(g, nx, u.y)) ny = u.y;
    else if (validTile(g, u.x, ny)) nx = u.x;
    else {
      u.timer = (u.timer ?? 0) + dt * 3;
      u.moving = false;
      return true;
    }
  }
  u.path = [];
  u.timer = (u.timer ?? 0) + dt;
  u.x = nx;
  u.y = ny;
  if (Math.abs(dx) > Math.abs(dy) * 0.9) {
    u.dir = dx > 0 ? 2 : 3;
    u.fx = u.dir;
  } else u.dir = dy > 0 ? 0 : 1;
  u.anim += dt * speed * 1.7;
  u.moving = true;
  u.phase = 'goto';
  return true;
}

/** Живые жители в чужих (и ваших присоединённых) селениях: ходят, стоят, патрулируют */
export function updateFolk(g: Game, dt: number) {
  for (const t of g.towns) {
    const folkWant = Math.min(14, Math.max(2, Math.round(t.pop * 0.55)));
    const guardWant = Math.min(6, Math.floor(t.soldiers / 2.2));
    const have = t.folk.filter((u) => u.role === 'folk').length;
    const haveG = t.folk.filter((u) => u.role === 'guard').length;
    if (have < folkWant) t.folk.push(mkFolk(g, t, 'folk'));
    else if (have > folkWant) t.folk.splice(t.folk.findIndex((u) => u.role === 'folk'), 1);
    if (haveG < guardWant) t.folk.push(mkFolk(g, t, 'guard'));
    else if (haveG > guardWant) t.folk.splice(t.folk.findIndex((u) => u.role === 'guard'), 1);
    const night = g.life.sleepTime;
    for (const u of t.folk) {
      if (night) {
        if (folkNight(g, t, u, dt)) {
          if (u.sleeping && Math.random() < dt * 0.12) {
            const hb = t.bld.find((b) => b.id === u.home);
            if (hb) g.floatText(hb.x * TW + hb.w * 8 + (Math.random() - 0.5) * 8, hb.y * TH + 4, 'z', '#cfe0ff');
          }
          continue;
        }
      } else if (u.sleeping) {
        // утро: просыпаются не все сразу
        u.sleeping = false;
        u.timer = 0;
        u.wander = Math.random() * 4;
        u.path = [];
      }
      const speed = u.role === 'guard' ? 1.0 : 1.5;
      if (u.path.length === 0 && u.wander > 0) {
        u.wander -= dt;
        u.moving = false;
        u.phase = 'goto';
        if (u.role === 'folk' && u.wander < 1.4 && u.wander > 0 && (u.id + Math.floor(u.wander * 2)) % 7 === 0) {
          u.phase = 'work';
          u.swing += dt * 1.2;
        }
        continue;
      }
      if (u.path.length === 0) {
        // новая цель вокруг центра селения
        for (let k = 0; k < 8; k++) {
          const a = Math.random() * Math.PI * 2;
          const r = 1 + Math.random() * (u.role === 'guard' ? 6.5 : 5);
          const tx = t.x + 0.5 + Math.cos(a) * r;
          const ty = t.y + 1.5 + Math.sin(a) * r * 0.75;
          if (validTile(g, tx, ty)) {
            u.path = [{ x: Math.floor(tx), y: Math.floor(ty) }];
            break;
          }
        }
        u.wander = 1.5 + Math.random() * 5;
        if (u.path.length === 0) continue;
      }
      const n = u.path[0];
      const tx = n.x + 0.5;
      const ty = n.y + 0.5;
      const dx = tx - u.x;
      const dy = ty - u.y;
      const dist = Math.hypot(dx, dy);
      const step = speed * dt;
      if (dist <= step) {
        u.x = tx;
        u.y = ty;
        u.path.shift();
        u.moving = false;
        continue;
      }
      const nx = u.x + (dx / dist) * step;
      const ny = u.y + (dy / dist) * step;
      if (!validTile(g, nx, ny)) {
        u.path = [];
        u.moving = false;
        continue;
      }
      u.x = nx;
      u.y = ny;
      if (Math.abs(dx) > Math.abs(dy) * 0.9) {
        u.dir = dx > 0 ? 2 : 3;
        u.fx = u.dir;
      } else u.dir = dy > 0 ? 0 : 1;
      u.anim += dt * speed * 1.7;
      u.moving = true;
      u.phase = 'goto';
    }
  }
}

export { TH, TW };
