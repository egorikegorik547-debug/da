import { B, BUILDINGS, DAY_LENGTH, TH, TW } from './data';
import type { Building, Game } from './game';
import { chron } from './extstate';
import { enlist, lifeEvent, registerPerson } from './life';
import { ITEMS } from './lifeData';
import { ensureTrample } from './paths';
import { SEASONS, seasonInfo } from './seasons';
import { LEGACY, type Deed, type ResBag } from './techlegacy';
import { TECH_BUILD_BY_ID } from './techbuild';
import type { Mods } from './techs';
import { makeObj } from './worldgen';

/* ───────────── Состояние «наследия технологий» (хранится в сохранении) ───────────── */

export interface Buff {
  key: keyof Mods;
  mult: number;
  until: number;
  label: string;
}
export interface TechState {
  cd: Record<string, number>;
  buffs: Buff[];
  insured: number;
  news: number;
  report: string[];
  hazT: number;
  done: Record<string, number>;
  wallT: number;
  healT: number;
}

export function TL(g: Game): TechState {
  const X = g.ext as unknown as { tl?: TechState };
  if (!X.tl) X.tl = { cd: {}, buffs: [], insured: 0, news: 0, report: [], hazT: 900, done: {}, wallT: 0, healT: 0 };
  return X.tl;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const KEYS: (keyof ResBag)[] = ['wood', 'stone', 'food', 'goods', 'gold', 'know'];

const stockOf = (g: Game, k: keyof ResBag) => (k === 'know' ? g.know : (g.res as unknown as Record<string, number>)[k] ?? 0);

function camp(g: Game) {
  return g.buildings.find((b) => b.type === 'camp') ?? g.buildings[0];
}

function pay(g: Game, cost: ResBag) {
  for (const k of KEYS) {
    const n = cost[k];
    if (!n) continue;
    if (k === 'know') g.know -= n;
    else g.spend(k, n);
  }
}
function give(g: Game, bag: ResBag) {
  for (const k of KEYS) if (bag[k]) g.gain(k, bag[k]!);
}

export function deedReady(g: Game, id: string): { ok: boolean; why: string; left: number } {
  const l = LEGACY[id];
  if (!l?.deed) return { ok: false, why: 'Нет действия', left: 0 };
  if (!g.done.has(id)) return { ok: false, why: 'Технология не изучена', left: 0 };
  const st = TL(g);
  const left = Math.max(0, (st.cd[id] ?? 0) - g.time);
  if (left > 0) return { ok: false, why: 'Перезарядка', left };
  for (const k of KEYS) if ((l.deed.cost[k] ?? 0) > stockOf(g, k)) return { ok: false, why: 'Не хватает ресурсов', left: 0 };
  return { ok: true, why: '', left: 0 };
}

function waterNear(g: Game, cx: number, cy: number, r: number) {
  const w = g.world;
  for (let y = Math.max(0, cy - r); y <= Math.min(w.h - 1, cy + r); y++) for (let x = Math.max(0, cx - r); x <= Math.min(w.w - 1, cx + r); x++) if (w.biome[y * w.w + x] <= B.WATER) return true;
  return false;
}

function foreignTowns(g: Game) {
  return g.towns.filter((t) => t.owner !== 'player');
}

function spawnPeople(g: Game, n: number, guard: boolean): number {
  const c = camp(g);
  if (!c) return 0;
  const spots = g.freeTilesNear(c.x + Math.floor(c.w / 2), c.y + c.h + 1, n + 4);
  let made = 0;
  for (let i = 0; i < n; i++) {
    const s = spots[i] ?? spots[0];
    if (!s) break;
    const u = g.newUnit(s.x + 0.5, s.y + 0.5, false);
    g.units.push(u);
    registerPerson(g, u, []);
    if (guard) {
      if (!enlist(g, u)) {
        g.life.items.club = (g.life.items.club ?? 0) + 1;
        enlist(g, u);
      }
    }
    for (let k = 0; k < 6; k++) g.spark(u.x * TW, u.y * TH - 8, '#ffe9a8');
    made++;
  }
  return made;
}

function healAll(g: Game) {
  for (const u of [...g.units, ...g.guards]) u.hp = Math.max(u.hp, 10);
}

function pave(g: Game, n: number): number {
  const c = camp(g);
  if (!c) return 0;
  ensureTrample(g);
  const w = g.world;
  const sx = Math.floor(c.x + c.w / 2);
  const sy = c.y + c.h;
  const targets = g.buildings.filter((b) => b.done && b !== c).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y));
  let left = n;
  const done = new Set<number>();
  for (const b of targets) {
    if (left <= 0) break;
    const gx = Math.floor(b.x + b.w / 2);
    const gy = b.y + b.h;
    if (gx < 1 || gy >= w.h - 1) continue;
    const p = g.pf.find(w.blocked, sx, sy, (x: number, y: number) => x === gx && y === gy, gx, gy, true, 3500);
    if (!p) continue;
    for (const t of p) {
      const i = Math.floor(t.y) * w.w + Math.floor(t.x);
      if (done.has(i) || w.biome[i] < B.STEPPE || w.cliff[i] === 2) continue;
      done.add(i);
      g.trample[i] = Math.max(g.trample[i], 16);
      if (--left <= 0) break;
    }
  }
  return n - left;
}

function plant(g: Game, n: number): number {
  const c = camp(g);
  if (!c) return 0;
  const w = g.world;
  let made = 0;
  for (let tries = 0; tries < n * 20 && made < n; tries++) {
    const a = Math.random() * Math.PI * 2;
    const r = rnd(5, 15);
    const tx = Math.floor(c.x + Math.cos(a) * r);
    const ty = Math.floor(c.y + Math.sin(a) * r * 0.8);
    if (tx < 2 || ty < 2 || tx >= w.w - 2 || ty >= w.h - 2) continue;
    const i = ty * w.w + tx;
    if (w.objs[i] || w.blocked[i] || w.biome[i] < B.STEPPE || w.cliff[i] === 2) continue;
    makeObj(w, 'tree', 'oak' + Math.floor(Math.random() * 3), tx, ty);
    g.spark((tx + 0.5) * TW, (ty + 0.5) * TH, '#7aa84a', 3);
    made++;
  }
  return made;
}

function summary(g: Game) {
  const sn = seasonInfo(g);
  return `${SEASONS[sn.idx].name}, жителей ${g.totalPop()}, воинов ${g.guards.length}, 🪙${Math.floor(g.res.gold)}, технологий ${g.done.size}`;
}

function done(g: Game, text: string, kind: 'good' | 'info' | 'warn' = 'good') {
  g.msg(text, kind);
  g.sfx('built');
}

/** выполнить действие технологии; вернуть текст ошибки или null */
export function runDeed(g: Game, id: string): string | null {
  const l = LEGACY[id];
  const d: Deed | undefined = l?.deed;
  if (!l || !d) return 'Нет действия';
  const r = deedReady(g, id);
  if (!r.ok) return r.why === 'Перезарядка' ? `Перезарядка: ещё ${Math.ceil(r.left)} с` : r.why;
  const op = d.op ?? [];
  const kind = op[0] as string | undefined;
  const c = camp(g);

  // предварительные проверки
  if (kind === 'finish' && !g.buildings.some((b) => !b.done)) return 'Нет заложенных строек';
  if (kind === 'scout' || kind === 'pact' || kind === 'raid') if (!foreignTowns(g).length) return 'Соседних селений пока нет';
  if (kind === 'raid' && g.guards.length < 2) return 'Для налёта нужны хотя бы 2 воина';
  if (kind === 'sea' && !g.buildings.some((b) => b.done && (b.type === 'tb_harbor' || b.type === 'tb_shipyard' || BUILDINGS[b.type].arch === 'dock'))) return 'Постройте пристань или верфь на берегу';
  if (kind === 'raft' && c && !waterNear(g, Math.floor(c.x), Math.floor(c.y), 30)) return 'Рядом с селением нет воды для сплава';
  if (kind === 'guards' && g.guards.length >= 120) return 'Армия уже огромна';

  pay(g, d.cost);
  TL(g).cd[id] = g.time + d.cd;
  let extra = '';
  switch (kind) {
    case 'guards': {
      const n = spawnPeople(g, op[1] as number, true);
      extra = `В строй встали воины: ${n}`;
      break;
    }
    case 'pop': {
      const n = spawnPeople(g, op[1] as number, false);
      extra = `Новые жители пришли в селение: ${n}`;
      break;
    }
    case 'item': {
      const it = op[1] as string;
      const n = op[2] as number;
      g.life.items[it] = (g.life.items[it] ?? 0) + n;
      extra = `Получено: ${ITEMS[it]?.icon ?? ''} ${ITEMS[it]?.name ?? it} ×${n}`;
      break;
    }
    case 'buff': {
      const b: Buff = { key: op[1] as keyof Mods, mult: op[2] as number, until: g.time + (op[3] as number), label: op[4] as string };
      const st = TL(g);
      st.buffs = st.buffs.filter((q) => q.label !== b.label);
      st.buffs.push(b);
      g.refreshMods();
      extra = `«${b.label}» действует ${Math.round((op[3] as number) / 60)} мин.`;
      break;
    }
    case 'heal':
      healAll(g);
      extra = 'Все люди здоровы и бодры';
      break;
    case 'pave': {
      const n = pave(g, op[1] as number);
      extra = n ? `Проложено дорожных клеток: ${n}` : 'Нет новых мест для дорог';
      break;
    }
    case 'finish': {
      const f = op[1] as number;
      let n = 0;
      for (const b of g.buildings)
        if (!b.done) {
          b.progress = Math.min(0.97, b.progress + f);
          n++;
        }
      extra = `Стройки продвинулись: ${n}`;
      break;
    }
    case 'plant': {
      const n = plant(g, op[1] as number);
      extra = `Посажено деревьев: ${n}`;
      break;
    }
    case 'raft': {
      const gain = Math.round(rnd(110, 160));
      g.gain('wood', gain);
      extra = `Брёвна сплавлены к берегу: +${gain} дерева`;
      break;
    }
    case 'caravan': {
      const ins = TL(g).insured > g.time;
      if (ins || Math.random() < 0.8) {
        const gain = Math.round(rnd(85, 150));
        g.gain('gold', gain);
        extra = `Караван вернулся с прибылью: +${gain}🪙`;
      } else {
        extra = 'Караван ограбили в пути — груз потерян';
        chron(g, 'Караван ограблен разбойниками', 'warn');
      }
      break;
    }
    case 'insure':
      TL(g).insured = g.time + 600;
      extra = 'Караваны застрахованы на 10 минут: потери возмещаются';
      chron(g, 'Торговцы застраховали караваны', 'good');
      break;
    case 'sea': {
      const gain = Math.round(rnd(110, 210));
      g.gain('gold', gain);
      extra = `Корабли вернулись из-за моря: +${gain}🪙`;
      chron(g, `Морской рейс принёс ${gain} золота`, 'good');
      break;
    }
    case 'scout': {
      const lines = foreignTowns(g).map((t) => `${t.name}: ${Math.floor(t.soldiers)} воинов, ${Math.floor(t.pop)} жителей`);
      TL(g).report = lines;
      extra = 'Разведка: ' + lines.slice(0, 3).join('; ');
      chron(g, 'Разведка гарнизонов — ' + lines.join('; '), 'info');
      break;
    }
    case 'gems': {
      const mult = (op[1] as number) ?? 1;
      const gain = Math.round(rnd(30, 110) * mult);
      g.gain('gold', gain);
      extra = `Рудознатцы нашли самоцветы: +${gain}🪙`;
      break;
    }
    case 'census':
      extra = 'Перепись: ' + summary(g);
      chron(g, 'Перепись — ' + summary(g), 'info');
      break;
    case 'forecast': {
      const sn = seasonInfo(g);
      const nx = SEASONS[(sn.idx + 1) % 4];
      extra = `Прогноз: ${SEASONS[sn.idx].name}${sn.rainy ? ' (дожди)' : ''}${sn.winter ? ' (холода, вода замерзает)' : ''}, через ~${sn.left} дн. придёт ${nx.name}`;
      chron(g, extra, 'season');
      break;
    }
    case 'news': {
      const st = TL(g);
      st.news++;
      chron(g, `Вестник державы №${st.news}: ${summary(g)}`, 'sci');
      extra = `Вышел «Вестник державы» №${st.news} — читайте в Хрониках`;
      break;
    }
    case 'vote': {
      const lvl = (op[1] as number) ?? 1;
      const pop = g.totalPop();
      const opts: { name: string; need: number; run: () => void }[] = [
        { name: 'налоги', need: g.res.gold < 40 ? 3 : 1, run: () => g.gain('gold', Math.round(30 * lvl + pop * 0.8)) },
        { name: 'общие запасы еды', need: g.res.food < 80 ? 4 : 1, run: () => g.gain('food', 50 * lvl) },
        { name: 'общую стройку', need: g.buildings.some((b) => !b.done) ? 3 : 0, run: () => g.buildings.forEach((b) => !b.done && (b.progress = Math.min(0.97, b.progress + 0.2 * lvl))) },
        { name: 'ополчение', need: g.guards.length < 4 ? 3 : 1, run: () => void spawnPeople(g, lvl, true) },
        { name: 'приём новых семей', need: pop < 15 ? 3 : 1, run: () => void spawnPeople(g, lvl, false) },
        { name: 'науку', need: 1.5, run: () => g.gain('know', 20 * lvl) },
        { name: 'дрова и камень', need: g.res.wood < 60 ? 3 : 1, run: () => (g.gain('wood', 40 * lvl), g.gain('stone', 25 * lvl)) },
      ];
      const tot = opts.reduce((a, o) => a + o.need, 0);
      let rr = Math.random() * tot;
      let pick = opts[0];
      for (const o of opts) {
        rr -= o.need;
        if (rr <= 0) {
          pick = o;
          break;
        }
      }
      pick.run();
      extra = `Голосование: совет выбрал — ${pick.name}`;
      chron(g, extra, 'gov');
      break;
    }
    case 'pact': {
      const ts = foreignTowns(g).sort((a, b) => b.aggr - a.aggr);
      const t = ts[0];
      t.attitude = Math.min(100, t.attitude + 28);
      t.aggr = Math.max(0, t.aggr - 35);
      extra = `Пакт о ненападении с «${t.name}»: отношение растёт, набеги стихают`;
      chron(g, `Заключён пакт о ненападении с «${t.name}»`, 'peace');
      break;
    }
    case 'tax': {
      const gain = Math.round(10 + g.totalPop() * 1.6);
      g.gain('gold', gain);
      extra = `Сборщики подати привезли ${gain}🪙`;
      break;
    }
    case 'festival':
      healAll(g);
      extra = 'Праздник! Люди веселы, раны залечены';
      chron(g, 'В селении устроен большой праздник', 'good');
      break;
    case 'raid': {
      const ts = foreignTowns(g).sort((a, b) => a.soldiers - b.soldiers);
      const t = ts[0];
      const odds = Math.max(0.25, Math.min(0.9, 0.4 + g.guards.length * 0.05 - t.soldiers * 0.015));
      if (Math.random() < odds) {
        const gold = Math.round(rnd(60, 150));
        g.gain('gold', gold);
        g.gain('food', 40);
        t.attitude = Math.max(-100, t.attitude - 25);
        t.aggr = Math.min(100, t.aggr + 15);
        extra = `Грабёж «${t.name}» удался: +${gold}🪙 и припасы`;
        chron(g, `Дружина ограбила «${t.name}»`, 'war');
      } else {
        const lose = Math.min(2, g.guards.length - 1);
        g.guards.splice(0, lose);
        t.aggr = Math.min(100, t.aggr + 20);
        extra = `Налёт на «${t.name}» провалился — потеряно воинов: ${lose}`;
        chron(g, `Налёт на «${t.name}» отбит`, 'war');
      }
      break;
    }
    case 'blast': {
      const gain = d.gain.stone ?? 0;
      if (Math.random() < 0.15) {
        g.res.stone = Math.max(0, g.res.stone - gain * 0.35);
        extra = 'Взрыв прошёл с обвалом — часть камня потеряна';
      } else extra = 'Грохот взрыва: скалы вскрыты';
      break;
    }
    case 'dispute': {
      const x = op[1] as number;
      if (g.research) g.progress[g.research] = (g.progress[g.research] ?? 0) + x;
      else g.gain('know', x);
      extra = g.research ? `Диспут ускорил изучение: +${x}💡 к исследованию` : `Диспут принёс знания: +${x}💡`;
      break;
    }
    default:
      break;
  }
  give(g, d.gain);
  const gainTxt = (Object.keys(d.gain) as (keyof ResBag)[]).map((k) => `+${d.gain[k]}${k === 'wood' ? '🪵' : k === 'stone' ? '🪨' : k === 'food' ? '🍖' : k === 'goods' ? '📦' : k === 'gold' ? '🪙' : '💡'}`).join(' ');
  done(g, `${l.title}: ${[extra, gainTxt].filter(Boolean).join(' · ')}`);
  g.emit(true);
  return null;
}

/** множители от временных указов — вызывается в refreshMods */
export function applyBuffs(g: Game, m: Mods) {
  const st = (g.ext as unknown as { tl?: TechState } | undefined)?.tl;
  if (!st) return;
  for (const b of st.buffs) if (b.until > g.time) m[b.key] *= b.mult;
}

export function activeBuffs(g: Game): Buff[] {
  const st = (g.ext as unknown as { tl?: TechState } | undefined)?.tl;
  return st ? st.buffs.filter((b) => b.until > g.time) : [];
}

/* ───────────── Размещение: берег ───────────── */
export function techPlaceCheck(g: Game, type: string, x: number, y: number): string | null {
  const tb = TECH_BUILD_BY_ID[type];
  if (!tb?.coast) return null;
  return waterNear(g, x + Math.floor(tb.w / 2), y + Math.floor(tb.h / 2), 4) ? null : 'Нужен берег рядом (вода в 4 клетках)';
}

const WALLS = new Set(['tb_palisade', 'tb_stonewall', 'tb_stonegate']);
export const isWall = (b: Building) => WALLS.has(b.type);

function near(g: Game, type: (b: Building) => boolean, x: number, y: number, r: number) {
  return g.buildings.some((b) => b.done && type(b) && Math.hypot(b.x + b.w / 2 - x, b.y + b.h / 2 - y) <= r);
}
const hasSpecial = (b: Building, sp: string) => !!TECH_BUILD_BY_ID[b.type]?.special?.includes(sp as never);

/* ───────────── Ход времени: стены, лазарет, пожары и болезни ───────────── */
export function techUpdate(g: Game, dt: number) {
  if (g.mode !== 'play') return;
  const st = TL(g);

  // истёкшие указы
  if (st.buffs.length && st.buffs.some((b) => b.until <= g.time)) {
    st.buffs = st.buffs.filter((b) => b.until > g.time);
    g.refreshMods();
  }

  // стены: враги и звери ломают их
  st.wallT -= dt;
  if (st.wallT <= 0) {
    st.wallT = 0.5;
    const walls = g.buildings.filter((b) => b.done && isWall(b));
    if (walls.length) {
      const foes: { x: number; y: number; dmg: number }[] = [];
      for (const r of g.life.raiders) foes.push({ x: r.unit.x, y: r.unit.y, dmg: r.kind === 'bandit' ? 5 : 3 });
      for (const a of g.life.animals) if (a.kind !== 'deer' && a.hp > 0) foes.push({ x: a.x, y: a.y, dmg: a.kind === 'bear' ? 7 : 3.5 });
      for (const w of walls) {
        const tb = TECH_BUILD_BY_ID[w.type];
        const wb = w as Building & { hp?: number };
        if (wb.hp === undefined) wb.hp = tb.wallHp ?? 40;
        for (const f of foes) {
          const dx = Math.max(w.x - f.x, 0, f.x - (w.x + w.w));
          const dy = Math.max(w.y - f.y, 0, f.y - (w.y + w.h));
          if (Math.hypot(dx, dy) < 1.15) {
            wb.hp -= f.dmg * 0.5;
            w.hit = 0.28;
            g.spark((w.x + w.w / 2) * TW, (w.y + w.h / 2) * TH, '#caa070');
          }
        }
        // стражники чинят стены неподалёку
        if (wb.hp > 0 && wb.hp < (tb.wallHp ?? 40) && g.guards.some((u) => Math.hypot(u.x - w.x, u.y - w.y) < 3)) wb.hp += 1.5;
        if (wb.hp <= 0) {
          g.msg(`${tb.name} разрушена врагами!`, 'warn');
          chron(g, `${tb.name} пала под ударами врагов`, 'war');
          g.demolish(w.id);
          break;
        }
      }
    }
  }

  // лазарет лечит
  st.healT -= dt;
  if (st.healT <= 0) {
    st.healT = 2;
    for (const b of g.buildings)
      if (b.done && hasSpecial(b, 'heal')) {
        for (const u of [...g.units, ...g.guards]) if (u.hp < 10 && Math.hypot(u.x - b.x - b.w / 2, u.y - b.y - b.h / 2) < 9) u.hp = Math.min(10, u.hp + 2);
      }
  }

  // пожары и болезни (после «Поселения») — колодцы, бани и лазареты защищают
  if (!g.dev.noRaids && g.done.has('town') && g.buildings.length >= 5) {
    st.hazT -= dt;
    if (st.hazT <= 0) {
      st.hazT = rnd(0.9, 1.7) * DAY_LENGTH * 3;
      if (Math.random() < 0.55) hazardFire(g);
      else if (g.totalPop() >= 10) hazardPlague(g);
    }
  }
}

function hazardFire(g: Game) {
  const list = g.buildings.filter((b) => b.done && b.type !== 'camp' && b.type !== 'manor' && !isWall(b));
  if (!list.length) return;
  const b = list[Math.floor(Math.random() * list.length)];
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const sx = (b.x + b.w / 2) * TW;
  const sy = (b.y + b.h) * TH - 8;
  if (near(g, (q) => hasSpecial(q, 'fireward'), cx, cy, 14)) {
    for (let i = 0; i < 12; i++) g.spark(sx + rnd(-8, 8), sy - rnd(0, 12), '#9fd8ff');
    g.msg(`Колодец помог потушить пожар у «${BUILDINGS[b.type].name}»`, 'good');
    chron(g, `Колодец спас «${BUILDINGS[b.type].name}» от пожара`, 'good');
    return;
  }
  const lw = Math.floor(g.res.wood * 0.14);
  const lg = Math.floor(g.res.goods * 0.1);
  g.res.wood -= lw;
  g.res.goods -= lg;
  for (let i = 0; i < 24; i++) g.spark(sx + rnd(-10, 10), sy - rnd(0, 16), i % 2 ? '#ff8a2a' : '#ffd24a');
  b.hit = 0.28;
  g.msg(`Пожар у «${BUILDINGS[b.type].name}»! Сгорело: ${lw}🪵 ${lg}📦. Постройте колодец (технология «Акведук»)`, 'warn');
  chron(g, `Пожар у «${BUILDINGS[b.type].name}»: сгорело ${lw} дерева и ${lg} товаров`, 'warn');
  lifeEvent(g, 'В селении случился пожар', 'warn');
}

function hazardPlague(g: Game) {
  const c = camp(g);
  if (!c) return;
  if (near(g, (q) => hasSpecial(q, 'diseaseward'), c.x + c.w / 2, c.y + c.h / 2, 18)) {
    g.msg('Лазарет и баня остановили болезнь в самом начале', 'good');
    chron(g, 'Болезнь остановлена лекарями', 'good');
    return;
  }
  const lf = Math.floor(g.res.food * 0.12);
  g.res.food -= lf;
  for (const u of g.units) if (!u.child && Math.random() < 0.35) u.hp = Math.min(u.hp, 4);
  g.msg(`Вспышка болезни: слегли люди, пропало ${lf}🍖. Помогут баня и лазарет`, 'warn');
  chron(g, `Вспышка болезни: потеряно ${lf} еды`, 'warn');
  lifeEvent(g, 'В селении вспыхнула болезнь', 'warn');
}

export function wallHp(b: Building): number | null {
  const hp = (b as Building & { hp?: number }).hp;
  return hp === undefined ? null : Math.round(hp);
}
void TH;
