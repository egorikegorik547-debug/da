import { useMemo, useRef, useState } from 'react';
import type { Game, Snapshot } from '../game/game';
import { TRAITS, type Trait } from '../game/lifeData';
import { personSprite, type Look } from '../game/sprites';
import { rosterOrder, rosterRows, rosterSetSel, rosterToggle, type RosterJob, type RosterRow } from '../game/roster';

const cache = new Map<string, string>();
function portrait(look: Look) {
  const k = JSON.stringify(look);
  let u = cache.get(k);
  if (!u) {
    u = personSprite(look, 0, 0, 0, false).toDataURL();
    cache.set(k, u);
  }
  return u;
}

type Filter = 'all' | 'idle' | 'chop' | 'gather' | 'mine' | 'build' | 'guard' | 'male' | 'female' | 'sel';

const FILTERS: { id: Filter; name: string; icon: string; test: (r: RosterRow) => boolean }[] = [
  { id: 'all', name: 'Все', icon: '👥', test: () => true },
  { id: 'idle', name: 'Свободные', icon: '💤', test: (r) => !r.guard && r.taskType === 'idle' },
  { id: 'chop', name: 'Лесорубы', icon: '🪓', test: (r) => r.taskType === 'chop' },
  { id: 'gather', name: 'Сборщики', icon: '🫐', test: (r) => r.taskType === 'gather' },
  { id: 'mine', name: 'Горняки', icon: '⛏️', test: (r) => r.taskType === 'mine' },
  { id: 'build', name: 'Строители', icon: '🔨', test: (r) => r.taskType === 'build' },
  { id: 'guard', name: 'Воины', icon: '🛡️', test: (r) => r.guard },
  { id: 'male', name: 'Мужчины', icon: '🧔', test: (r) => !r.female },
  { id: 'female', name: 'Женщины', icon: '👩', test: (r) => r.female },
  { id: 'sel', name: 'Выбранные', icon: '✅', test: (r) => r.sel },
];

const ORDERS: { id: RosterJob | 'home' | 'stop' | 'hold'; icon: string; label: string; title: string; tone?: string }[] = [
  { id: 'chop', icon: '🪓', label: 'Рубить', title: 'Каждый выбранный идёт к ближайшему дереву' },
  { id: 'gather', icon: '🫐', label: 'Ягоды', title: 'Каждый выбранный идёт к ближайшему кусту' },
  { id: 'mine', icon: '⛏️', label: 'Камень', title: 'Каждый выбранный идёт к ближайшему камню' },
  { id: 'build', icon: '🔨', label: 'Стройка', title: 'Выбранные строят ближайшую заложенную постройку' },
  { id: 'home', icon: '🏠', label: 'К стоянке', title: 'Собрать выбранных у стоянки' },
  { id: 'hold', icon: '📍', label: 'Стоять', title: 'Воины держат позицию' },
  { id: 'stop', icon: '■', label: 'Стоп', title: 'Остановить выбранных', tone: 'px-btn-red' },
];

export function RosterPanel({ game, snap, onClose }: { game: Game; snap: Snapshot; onClose: () => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [note, setNote] = useState('');
  const last = useRef<number | null>(null);
  void snap.selCount; // перерисовка вместе со снимком состояния

  const rows = rosterRows(game);
  const f = FILTERS.find((x) => x.id === filter)!;
  const ql = q.trim().toLowerCase();
  const list = useMemo(
    () => rows.filter((r) => f.test(r) && (!ql || r.name.toLowerCase().includes(ql) || r.task.toLowerCase().includes(ql))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows.map((r) => `${r.id}${r.task}${r.sel}`).join('|'), filter, ql],
  );
  const selected = rows.filter((r) => r.sel).length;
  const counts = Object.fromEntries(FILTERS.map((x) => [x.id, rows.filter(x.test).length])) as Record<Filter, number>;

  const click = (r: RosterRow, shift: boolean) => {
    if (shift && last.current !== null) {
      const a = list.findIndex((x) => x.id === last.current);
      const b = list.findIndex((x) => x.id === r.id);
      if (a >= 0 && b >= 0) {
        const [i, j] = a < b ? [a, b] : [b, a];
        rosterSetSel(game, list.slice(i, j + 1).map((x) => x.id), true);
        last.current = r.id;
        return;
      }
    }
    rosterToggle(game, r.id);
    last.current = r.id;
  };

  const run = (id: (typeof ORDERS)[number]['id']) => {
    const r = rosterOrder(game, id);
    setNote(r ?? '');
    game.emit(true);
  };

  return (
    <div className="px-panel pointer-events-auto absolute top-[74px] bottom-[210px] left-3 z-20 flex w-[430px] max-w-[94vw] flex-col gap-2 p-3" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-pixel text-[12px] text-[#ffe9a8]">👥 ЛЮДИ</div>
          <div className="mt-1 text-[12px] text-[#c8b088]">
            Отметьте галочками несколько человек — и отдайте им общий приказ. <b>Shift+клик</b> — диапазон.
          </div>
        </div>
        <button onClick={onClose} className="px-btn px-btn-red font-pixel px-2.5 py-2 text-[9px]" title="Закрыть (Y)">
          ✕
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        {FILTERS.map((x) => (
          <button key={x.id} onClick={() => setFilter(x.id)} className={`px-btn flex items-center gap-1 px-1.5 py-1 text-[12px] font-bold ${filter === x.id ? 'active' : ''}`}>
            <span>{x.icon}</span>
            {x.name}
            <span className="text-[#ffcf6a]">{counts[x.id]}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по имени или делу…"
          className="px-inset min-w-0 flex-1 bg-[#1a0f08] px-2 py-1.5 text-[13px] text-[#fff3d0] outline-none placeholder:text-[#8a7658]"
        />
        <button onClick={() => rosterSetSel(game, list.map((r) => r.id), true)} className="px-btn px-btn-green px-2 py-1.5 text-[12px] font-bold" title="Отметить всех в списке">
          ☑ Все ({list.length})
        </button>
        <button onClick={() => rosterSetSel(game, rows.map((r) => r.id), false)} className="px-btn px-2 py-1.5 text-[12px] font-bold" title="Снять выделение">
          ☐ Снять
        </button>
        <button
          onClick={() => {
            const on = new Set(list.filter((r) => !r.sel).map((r) => r.id));
            rosterSetSel(game, list.map((r) => r.id), false);
            rosterSetSel(game, [...on], true);
          }}
          className="px-btn px-2 py-1.5 text-[12px] font-bold"
          title="Инвертировать выбор в списке"
        >
          ⇄
        </button>
      </div>

      <div className="scroll-px flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
        {list.length === 0 && <div className="px-inset p-3 text-center text-[13px] text-[#c8b088]">Никого не найдено</div>}
        {list.map((r) => (
          <button
            key={r.id}
            onClick={(e) => click(r, e.shiftKey)}
            className={`px-inset flex items-center gap-2 px-1.5 py-1 text-left hover:brightness-125 ${r.sel ? 'outline-2 outline-[#8aff9a]' : ''}`}
            style={r.sel ? { background: '#26421f' } : undefined}
          >
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 text-[14px] font-bold ${r.sel ? 'border-[#8aff9a] bg-[#2e6a2e] text-white' : 'border-[#7a5a3a] bg-[#1a0f08] text-transparent'}`}>✓</span>
            <img src={portrait(r.look)} className="pix h-[30px] w-6 shrink-0" />
            <div className="min-w-0 flex-1 leading-none">
              <div className="flex items-center gap-1 text-[13px] font-bold text-[#fff3d0]">
                <span className="truncate">{r.name}</span>
                <span title={TRAITS[r.trait as Trait]?.name}>{TRAITS[r.trait as Trait]?.icon}</span>
                {r.guard && <span title="Воин">🛡️</span>}
                {r.role === 'lord' && <span>👑</span>}
                {r.status === 'slave' && <span>⛓</span>}
                {r.status === 'serf' && <span>🌾</span>}
              </div>
              <div className="mt-1 truncate text-[11px] text-[#c8b088]">
                {r.task}
                {r.carry ? ` · несёт ${r.carry}` : ''}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="px-inset flex flex-col gap-1.5 p-2">
        <div className="flex items-center justify-between text-[13px] font-bold text-[#ffe9a8]">
          <span>Приказ для выбранных: {selected}</span>
          {note && <span className="max-w-[60%] truncate text-[12px] font-normal text-[#9affaa]">{note}</span>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ORDERS.map((o) => (
            <button key={o.id} onClick={() => run(o.id)} disabled={selected === 0} title={o.title} className={`px-btn ${o.tone ?? ''} flex items-center gap-1 px-2 py-1.5 text-[12px] font-bold`}>
              <span className="text-[16px]">{o.icon}</span>
              {o.label}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-[#9fbfe0]">Для точных приказов закройте меню и используйте ПКМ по карте — выбор сохранится.</div>
      </div>
    </div>
  );
}
