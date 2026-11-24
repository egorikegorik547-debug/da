import { BUILDINGS, BUILD_ORDER, type BuildCat, type BuildingDef } from './data';
import { ARCH, SPEC_STYLE } from './specbuild';

/**
 * Постройки, которые открывают технологии. Каждая — настоящее здание на карте
 * (со своим спрайтом, ценой и действием), а не процентный бонус.
 * special: особое поведение, которое обрабатывает techlegacy.ts
 */
export type TechSpecial = 'wall' | 'water' | 'fireward' | 'diseaseward' | 'heal' | 'bees' | 'rails' | 'patrol' | 'shipyard';

export interface TechBuild {
  id: string;
  tech: string;
  arch: string;
  name: string;
  desc: string;
  cat: BuildCat;
  w: number;
  h: number;
  cost: { wood?: number; stone?: number; goods?: number };
  time: number;
  fx: Partial<BuildingDef>;
  /** нужен берег рядом */
  coast?: boolean;
  special?: TechSpecial[];
  /** прочность стены */
  wallHp?: number;
}

const T = (id: string, tech: string, arch: string, name: string, desc: string, cat: BuildCat, w: number, h: number, cost: TechBuild['cost'], time: number, fx: Partial<BuildingDef>, extra: Partial<TechBuild> = {}): TechBuild => ({
  id: 'tb_' + id,
  tech,
  arch,
  name,
  desc,
  cat,
  w,
  h,
  cost,
  time,
  fx,
  ...extra,
});

export const TECH_BUILDS: TechBuild[] = [
  T('palisade', 'palisade', 'palisade', 'Частокол', 'Деревянный забор 1×1. Блокирует проход — воры, волки и разбойники обязаны ломать его (держит ~40 ударов).', 'war', 1, 1, { wood: 4 }, 3, { def: 0.006 }, { special: ['wall'], wallHp: 40 }),
  T('stonewall', 'fortification', 'stonewall', 'Каменная стена', 'Каменная секция 1×1: прочнее частокола, враги ломают её очень долго.', 'war', 1, 1, { stone: 6 }, 5, { def: 0.012 }, { special: ['wall'], wallHp: 140 }),
  T('stonegate', 'fortification', 'gate', 'Крепостные ворота', 'Ворота 3×1 между стенами. Усиливают оборону и порядок.', 'war', 3, 1, { wood: 14, stone: 40, goods: 2 }, 18, { def: 0.1, loyalty: 2, upkeep: 0.02 }, { special: ['wall'], wallHp: 320 }),
  T('guardpost', 'police', 'tower', 'Пост стражи', 'Ночью от поста расходятся патрули с фонарями: воры и разбойники пугаются. Лояльность +.', 'war', 2, 2, { wood: 20, stone: 24, goods: 3 }, 16, { def: 0.04, loyalty: 2, upkeep: 0.02, light: true }, { special: ['patrol'] }),
  T('windmill', 'windmill', 'mill', 'Ветряная мельница', 'Огромные крылья мелют зерно: еда идёт в казну без работников.', 'eco', 2, 2, { wood: 40, stone: 10 }, 18, { food: 0.5, upkeep: 0.01 }),
  T('orchard', 'orchards', 'garden', 'Фруктовый сад', 'Яблони и вишни: еда и хорошее настроение.', 'eco', 2, 2, { wood: 18 }, 12, { food: 0.3, happy: 2 }),
  T('apiary', 'beekeeping', 'garden', 'Пасека', 'Ульи с летающими пчёлами: мёд — еда и золото.', 'eco', 2, 2, { wood: 22 }, 12, { food: 0.18, gold: 0.1, happy: 1 }, { special: ['bees'] }),
  T('pasture', 'husbandry', 'pasture', 'Загон скота', 'Овцы и коровы — живая кладовая.', 'eco', 3, 2, { wood: 22 }, 14, { food: 0.42 }),
  T('dairy', 'dairy', 'lodge', 'Сыроварня', 'Молоко, сыр и масло.', 'eco', 2, 2, { wood: 26, stone: 4 }, 14, { food: 0.36, gold: 0.08 }),
  T('fishery', 'fishing', 'lodge', 'Рыбацкая лодка', 'Рыбаки выходят на воду с берега: нужна вода рядом.', 'eco', 2, 2, { wood: 22 }, 12, { food: 0.34 }, { coast: true }),
  T('granary', 'granary', 'granary', 'Зернохранилище', 'Сухой амбар: запасы не гниют, склады больше.', 'eco', 2, 2, { wood: 30 }, 14, { cap: 120 }),
  T('logcamp', 'logging_camps', 'lodge', 'Лесной лагерь', 'Лесорубы живут у делянки: жильё и дерево.', 'eco', 2, 2, { wood: 26 }, 12, { housing: 5, yield: { wood: 0.1 } }),
  T('sawmill', 'lumber_mill', 'saw', 'Водяная лесопилка', 'Колесо вращает пилы: дерево без людей.', 'ind', 2, 2, { wood: 36, stone: 6 }, 16, { yield: { wood: 0.45 }, upkeep: 0.02 }),
  T('steamsaw', 'steam_saw', 'factory', 'Паровая лесопилка', 'Паровой привод валит и пилит целые делянки.', 'ind', 3, 3, { wood: 70, stone: 50, goods: 10 }, 30, { yield: { wood: 1.1 }, upkeep: 0.05 }),
  T('waterwheel', 'waterwheel', 'saw', 'Мельничное колесо', 'Сила реки: товары из дерева.', 'ind', 2, 2, { wood: 34, stone: 8 }, 16, { yield: { goods: 0.08 }, upkeep: 0.015 }),
  T('kiln', 'kiln', 'smelter', 'Обжиговая печь', 'Печь обжигает кирпич и глину: камень превращается в товары.', 'ind', 2, 2, { wood: 30, stone: 30 }, 16, { jobs: 3, prod: { in: { stone: 0.1, wood: 0.04 }, out: 0.12 } }),
  T('brickyard', 'bricks', 'shop', 'Кирпичный двор', 'Ровный кирпич для больших построек.', 'ind', 2, 2, { wood: 20, stone: 24 }, 14, { jobs: 3, prod: { in: { stone: 0.12 }, out: 0.13 } }),
  T('glassworks', 'glass', 'shop', 'Стекольная мастерская', 'Окна, бутыли, линзы: товары и знания.', 'ind', 2, 2, { wood: 20, stone: 34, goods: 4 }, 18, { jobs: 3, prod: { in: { stone: 0.1, wood: 0.05 }, out: 0.14 }, know: 0.5 }),
  T('mineshaft', 'mine_shafts', 'mine', 'Шахтный ствол', 'Глубокая шахта: камень без людей.', 'ind', 2, 2, { wood: 40, stone: 8 }, 18, { yield: { stone: 0.5 }, upkeep: 0.03 }, { special: ['rails'] }),
  T('coalpit', 'coal', 'mine', 'Угольная копь', 'Уголь для горнов: камень и товары.', 'ind', 2, 2, { wood: 40, stone: 12 }, 20, { yield: { stone: 0.25, goods: 0.08 }, upkeep: 0.03 }, { special: ['rails'] }),
  T('drillrig', 'drills', 'mine', 'Буровая вышка', 'Паровой бур вгрызается в недра.', 'ind', 3, 3, { wood: 60, stone: 60, goods: 14 }, 28, { yield: { stone: 1.3 }, upkeep: 0.06 }),
  T('well', 'aqueduct', 'well', 'Колодец', 'Чистая вода рядом: тушит пожары в радиусе 14 клеток и радует жителей.', 'home', 1, 1, { wood: 8, stone: 10 }, 8, { happy: 2, housing: 2 }, { special: ['water', 'fireward'] }),
  T('bathhouse', 'sanitation', 'bath', 'Общественная баня', 'Защищает от болезней в радиусе 16 клеток; счастье.', 'cult', 2, 2, { wood: 32, stone: 14 }, 15, { happy: 4, loyalty: 1, upkeep: 0.02 }, { special: ['diseaseward'] }),
  T('infirmary', 'medicine', 'home', 'Лазарет', 'Лекари лечат раненых рядом и не дают болезням развернуться.', 'cult', 2, 2, { wood: 24, stone: 6 }, 14, { housing: 4, loyalty: 1, upkeep: 0.02, light: true }, { special: ['heal', 'diseaseward'] }),
  T('school', 'writing', 'school', 'Школа', 'Дети учатся письму: знания и лояльность.', 'cult', 2, 2, { wood: 34, stone: 14, goods: 3 }, 18, { know: 1.2, loyalty: 1, upkeep: 0.03 }),
  T('observatory', 'astronomy', 'obs', 'Обсерватория', 'Звёзды и календарь: знания и свет по ночам.', 'cult', 2, 2, { wood: 30, stone: 56, goods: 10 }, 26, { know: 2.2, light: true, upkeep: 0.04 }),
  T('university', 'university', 'lib', 'Университет', 'Кафедры и лаборатории: самый мощный источник знаний.', 'cult', 3, 2, { wood: 50, stone: 80, goods: 18 }, 36, { know: 4, loyalty: 2, light: true, upkeep: 0.07 }),
  T('cathedral', 'cathedral', 'temple', 'Собор', 'Величественный храм: лояльность и счастье.', 'cult', 3, 2, { wood: 40, stone: 90, goods: 10 }, 36, { loyalty: 8, happy: 5, know: 1, light: true, upkeep: 0.04 }),
  T('council', 'tribal_council', 'court', 'Дом совета', 'Старейшины решают споры: лояльность и налоги.', 'cult', 3, 2, { wood: 40, stone: 18 }, 18, { loyalty: 4, gold: 0.1, upkeep: 0.02 }),
  T('plaza', 'urban_planning', 'statue', 'Городская площадь', 'Фонтан и торги: счастье и золото.', 'cult', 1, 2, { stone: 46, goods: 4 }, 18, { loyalty: 4, happy: 4, gold: 0.15, light: true }),
  T('tenement', 'concrete', 'home', 'Бетонный дом', 'Многоэтажное жильё.', 'home', 3, 2, { wood: 20, stone: 60, goods: 8 }, 22, { housing: 26, upkeep: 0.03 }),
  T('bank', 'banking', 'bank', 'Банк', 'Вклады и кредиты: золото и надёжное хранение.', 'ind', 2, 2, { wood: 20, stone: 60, goods: 8 }, 26, { gold: 0.65, cap: 100, upkeep: 0.04 }),
  T('exchange', 'stock_exchange', 'bank', 'Биржа', 'Котировки и акции: большой доход золота.', 'ind', 3, 2, { wood: 30, stone: 90, goods: 16 }, 34, { gold: 1.3, cap: 120, upkeep: 0.08 }),
  T('harbor', 'harbor', 'dock', 'Пристань', 'Причал на берегу: торговля и рыба. Нужна вода рядом.', 'eco', 3, 2, { wood: 50, stone: 8 }, 22, { gold: 0.3, food: 0.22, upkeep: 0.02 }, { coast: true }),
  T('shipyard', 'sailing', 'dock', 'Верфь', 'Строит корабли для морских походов и караванов. Нужна вода рядом.', 'eco', 3, 2, { wood: 70, stone: 12, goods: 6 }, 28, { gold: 0.35, army: 4, upkeep: 0.03 }, { coast: true, special: ['shipyard'] }),
];

export const TECH_BUILD_BY_ID: Record<string, TechBuild> = Object.fromEntries(TECH_BUILDS.map((t) => [t.id, t]));
export const TECH_BUILD_IDS: string[] = TECH_BUILDS.map((t) => t.id);
export const TECH_BUILDS_BY_TECH: Record<string, TechBuild[]> = {};
for (const t of TECH_BUILDS) (TECH_BUILDS_BY_TECH[t.tech] ??= []).push(t);

TECH_BUILDS.forEach((t, i) => {
  const a = ARCH[t.arch];
  BUILDINGS[t.id] = {
    id: t.id,
    name: t.name,
    desc: t.desc,
    cat: t.cat,
    w: t.w,
    h: t.h,
    cost: { ...t.cost },
    time: t.time,
    housing: 0,
    req: t.tech,
    ...t.fx,
    arch: t.arch,
    tier: 6 + (i % 10),
  };
  void a;
  SPEC_STYLE[t.id] = { spec: 'smith', arch: t.arch, tier: 6 + (i % 10), idx: 40 + i };
  BUILD_ORDER.push(t.id);
});

export const isTechBuild = (id: string) => id in TECH_BUILD_BY_ID;
