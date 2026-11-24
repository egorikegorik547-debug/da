import type { Game, Unit } from './game';

/* ───────────── Меню «Люди»: массовый выбор и приказы ───────────── */

export type RosterJob = 'chop' | 'gather' | 'mine' | 'build';

export interface RosterRow {
  id: number;
  name: string;
  task: string;
  taskType: string;
  carry: number;
  kid: boolean;
  female: boolean;
  sel: boolean;
  guard: boolean;
  status: string;
  role: string;
  trait: string;
  look: Unit['look'];
  hp: number;
}

/** все жители и воины (без гостей и воров) — для таблицы меню */
export function rosterRows(g: Game): RosterRow[] {
  const out: RosterRow[] = [];
  const add = (u: Unit, guard: boolean) => {
    if (u.spawn > 0) return;
    out.push({
      id: u.id,
      name: u.name,
      task: g.taskText(u),
      taskType: guard ? 'guard' : u.task.type,
      carry: u.carry.n,
      kid: u.child,
      female: u.look.female,
      sel: !!u.sel,
      guard,
      status: u.status,
      role: u.role,
      trait: u.trait,
      look: u.look,
      hp: u.hp,
    });
  };
  for (const u of g.units) if (u.role !== 'visitor' && u.role !== 'thief' && u.role !== 'bandit') add(u, false);
  for (const u of g.guards) add(u, true);
  return out;
}

export function rosterSetSel(g: Game, ids: number[], on: boolean, only = false) {
  if (only) g.clearSel();
  const set = new Set(ids);
  for (const u of [...g.units, ...g.guards]) {
    if (!set.has(u.id) || u.spawn > 0) continue;
    if (u.child) continue;
    u.sel = on;
  }
  g.selBuilding = null;
  g.emit(true);
}

/** переключить одного человека */
export function rosterToggle(g: Game, id: number) {
  const u = [...g.units, ...g.guards].find((q) => q.id === id);
  if (!u || u.child) return;
  rosterSetSel(g, [id], !u.sel);
}

/** ближайший объект нужного рода вокруг точки */
function nearestObj(g: Game, kind: RosterJob, x: number, y: number, taken: Set<number>) {
  const w = g.world;
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  let best: { tx: number; ty: number; id: number } | null = null;
  let bd = 1e9;
  const R = 46;
  for (let ty = Math.max(0, cy - R); ty <= Math.min(w.h - 1, cy + R); ty++) {
    for (let tx = Math.max(0, cx - R); tx <= Math.min(w.w - 1, cx + R); tx++) {
      const o = w.objs[ty * w.w + tx];
      if (!o || taken.has(o.id) || o.amount <= 0) continue;
      const ok = kind === 'chop' ? g.isChoppable(o) && o.kind !== 'cactus' : kind === 'gather' ? o.kind === 'bush' : o.kind === 'rock';
      if (!ok) continue;
      if (g.bad.has(ty * w.w + tx)) continue;
      const d = Math.hypot(tx - x, ty - y);
      if (d < bd) {
        bd = d;
        best = { tx, ty, id: o.id };
      }
    }
  }
  return best;
}

/** отправить выбранных людей на работу: каждый — к ближайшей цели */
export function rosterOrder(g: Game, kind: RosterJob | 'stop' | 'hold' | 'home'): string | null {
  const sel = g.selUnits();
  const gs = g.selGuards();
  if (!sel.length && !gs.length) return 'Сначала отметьте людей галочками';
  if (kind === 'stop') {
    g.stopSelected();
    return `Приказ «стоп»: ${sel.length + gs.length} чел.`;
  }
  if (kind === 'hold') {
    if (!gs.length) return 'Среди выбранных нет воинов';
    g.holdSelected();
    return `Воины держат позицию: ${gs.length}`;
  }
  if (kind === 'home') {
    const camp = g.buildings.find((b) => b.type === 'camp');
    if (!camp) return 'Нет стоянки';
    const tx = camp.x + 1;
    const ty = camp.y + camp.h + 1;
    if (sel.length) g.orderMove(sel, tx, ty);
    if (gs.length) g.guardMove(gs, (tx + 0.5) * 16, (ty + 0.5) * 12);
    return `Выбранные идут к стоянке: ${sel.length + gs.length}`;
  }
  if (!sel.length) return 'Для работы нужны жители (воины работать не будут)';
  if (kind === 'mine' && !g.done.has('stone_tools')) return 'Для добычи камня изучите «Каменные орудия»';
  if (kind === 'build') {
    const sites = g.buildings.filter((b) => !b.done);
    if (!sites.length) return 'Нет заложенных строек — выберите «Строить» (B)';
    let n = 0;
    for (const u of sel) {
      let best = sites[0];
      let bd = 1e9;
      for (const s of sites) {
        const d = Math.hypot(s.x - u.x, s.y - u.y);
        if (d < bd) {
          bd = d;
          best = s;
        }
      }
      g.setTask(u, { type: 'build', tx: best.x, ty: best.y, site: best.id, auto: false });
      n++;
    }
    return `На стройку отправлено: ${n}`;
  }
  const taken = new Set<number>();
  let n = 0;
  for (const u of sel) {
    const t = nearestObj(g, kind, u.x, u.y, taken);
    if (!t) continue;
    taken.add(t.id);
    if (kind === 'chop') g.orderChop([u], t.tx, t.ty, true);
    else if (kind === 'gather') g.orderGather([u], t.tx, t.ty);
    else g.orderMine([u], t.tx, t.ty);
    n++;
  }
  if (!n) return kind === 'chop' ? 'Рядом не осталось деревьев' : kind === 'gather' ? 'Рядом нет ягодных кустов' : 'Рядом нет камней';
  const label = kind === 'chop' ? 'рубят лес' : kind === 'gather' ? 'собирают ягоды' : 'добывают камень';
  return `${n} чел. ${label}`;
}
