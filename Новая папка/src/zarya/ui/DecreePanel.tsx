import { useState } from 'react';
import { BUILDINGS } from '../game/data';
import type { Game, Snapshot } from '../game/game';
import { ITEMS, RECIPES } from '../game/lifeData';
import { KIND_INFO, LEGACY, bagText, type LegKind } from '../game/techlegacy';
import { TECH_BY_ID, techsFor } from '../game/techs';
import { activeBuffs, deedReady, runDeed } from '../game/techrun';

type Tab = 'all' | LegKind;

const TABS: { id: Tab; name: string; icon: string }[] = [
  { id: 'all', name: 'Всё', icon: '📚' },
  { id: 'building', name: 'Постройки', icon: KIND_INFO.building.icon },
  { id: 'order', name: 'Приказы', icon: KIND_INFO.order.icon },
  { id: 'craft', name: 'Крафт', icon: KIND_INFO.craft.icon },
  { id: 'look', name: 'Быт', icon: KIND_INFO.look.icon },
  { id: 'decree', name: 'Указы', icon: KIND_INFO.decree.icon },
  { id: 'class', name: 'Классовые', icon: KIND_INFO.class.icon },
];

export function DecreePanel({ game, snap, onClose }: { game: Game; snap: Snapshot; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('all');
  const [openOnly, setOpenOnly] = useState(true);
  const [note, setNote] = useState('');
  void snap.res;
  const list = techsFor(game.spec)
    .map((t) => ({ t, l: LEGACY[t.id] }))
    .filter((x) => x.l && (tab === 'all' || x.l.kind === tab) && (!openOnly || game.done.has(x.t.id)));
  const total = techsFor(game.spec).filter((t) => LEGACY[t.id]).length;
  const learned = techsFor(game.spec).filter((t) => LEGACY[t.id] && game.done.has(t.id)).length;
  const buffs = activeBuffs(game);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-3" onClick={onClose}>
      <div className="px-panel flex max-h-[96vh] w-full max-w-[1180px] flex-col p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-pixel text-[14px] text-[#ffe9a8]">📜 ДЕЛА И УКАЗЫ ТЕХНОЛОГИЙ</h2>
            <div className="mt-2 text-[14px] text-[#e8d4a8]">
              Каждая технология даёт настоящее продолжение: постройку, приказ, предмет, перемену в быту или указ. Открыто: <b className="text-[#ffcf6a]">{learned}</b> из {total}.
            </div>
          </div>
          <button onClick={onClose} className="px-btn px-btn-red font-pixel px-4 py-3 text-[10px]">
            ЗАКРЫТЬ ✕
          </button>
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {TABS.map((x) => (
            <button key={x.id} onClick={() => setTab(x.id)} className={`px-btn flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-bold ${tab === x.id ? 'active' : ''}`}>
              <span>{x.icon}</span>
              {x.name}
            </button>
          ))}
          <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[13px] text-[#e8d4a8]">
            <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} /> только открытые
          </label>
        </div>

        {(buffs.length > 0 || note) && (
          <div className="px-inset mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1.5 text-[13px]">
            {buffs.map((b) => (
              <span key={b.label} className="text-[#9affaa]">
                ✨ {b.label} · ещё {Math.ceil((b.until - game.time) / 60)} мин.
              </span>
            ))}
            {note && <span className="text-[#ffe9a8]">{note}</span>}
          </div>
        )}

        <div className="scroll-px grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
          {list.length === 0 && <div className="px-inset col-span-full p-4 text-center text-[14px] text-[#c8b088]">Здесь пока пусто — изучайте технологии [T]</div>}
          {list.map(({ t, l }) => {
            const known = game.done.has(t.id);
            const ki = KIND_INFO[l.kind];
            const ready = l.deed ? deedReady(game, t.id) : null;
            return (
              <div key={t.id} className={`px-panel-dark flex flex-col gap-1.5 p-2.5 ${known ? '' : 'opacity-50'}`} style={{ borderLeft: `4px solid ${ki.color}` }}>
                <div className="flex items-start gap-2">
                  <span className="text-[24px] leading-none">{t.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold tracking-wide text-[#c8a060] uppercase">
                      {ki.icon} {ki.name} · {t.name}
                    </div>
                    <div className="text-[15px] font-bold text-[#fff3d0]">{l.title}</div>
                    <div className="text-[12px] leading-tight text-[#d8c498]">{l.desc}</div>
                  </div>
                </div>

                {l.kind === 'building' && l.bld && (
                  <div className="flex flex-wrap gap-1">
                    {l.bld.map((id) => (
                      <button
                        key={id}
                        disabled={!known}
                        onClick={() => {
                          game.setBuildType(id);
                          onClose();
                        }}
                        title={BUILDINGS[id].desc}
                        className="px-btn px-btn-gold px-2 py-1 text-[12px] font-bold"
                      >
                        🏗 {BUILDINGS[id].name}
                      </button>
                    ))}
                  </div>
                )}

                {l.kind === 'craft' && l.item && (
                  <div className="text-[12px] text-[#bfe0ff]">
                    {ITEMS[l.item]?.icon} {ITEMS[l.item]?.name}: {RECIPES.find((r) => r.item === l.item) ? `в «${BUILDINGS[RECIPES.find((r) => r.item === l.item)!.bld]?.name ?? 'мастерской'}»` : ''} · в запасе {Math.floor(game.life.items[l.item] ?? 0)} · панель «Жизнь» [N]
                  </div>
                )}

                {l.kind === 'look' && <div className="text-[12px] font-bold text-[#9affaa]">{known ? '● Активно — посмотрите на селение' : '○ Не изучено'}</div>}

                {l.deed && (
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <div className="text-[12px] text-[#ffcf6a]">
                      {bagText(l.deed.cost) || 'бесплатно'}
                      {Object.keys(l.deed.gain).length ? ` → ${bagText(l.deed.gain)}` : ''}
                    </div>
                    <button
                      disabled={!ready?.ok}
                      onClick={() => setNote(runDeed(game, t.id) ?? '')}
                      className={`px-btn ${ready?.ok ? 'px-btn-green' : ''} px-2.5 py-1.5 text-[12px] font-bold`}
                      title={ready?.why}
                    >
                      {!known ? '🔒' : ready && ready.left > 0 ? `⏳ ${Math.ceil(ready.left)}с` : ready?.ok ? 'ВЫПОЛНИТЬ' : 'Нет ресурсов'}
                    </button>
                  </div>
                )}
                {!known && <div className="text-[11px] text-[#ffa08a]">🔒 Изучите «{TECH_BY_ID[t.id].name}»</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
