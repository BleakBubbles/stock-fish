import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { US, closedMarketsText, marketOpenNow, marketStates, staleSince } from '../data/market';
import {
  DEFAULT_TANK_LABELS,
  DEFAULT_TANK_VIEW,
  normalizeTankView,
  type PanelSpot,
  type Pen,
  type TankLabels,
  type TankView,
} from '../data/model';
import { SAMPLE_TANK_CSV, importHoldingsCsv } from '../data/importCsv';
import { repo, useHoldings, usePens, useProfiles, useSettings } from '../data/store';
import {
  type MarketStatus,
  useFxRates,
  useHomeCurrency,
  useMarketEntries,
} from '../data/useMarket';
import { WEATHERS, type Weather, type WeatherResult, kinship, temperFor } from '../mood';
import { type DropTarget, Tank, type TankPlacement } from '../tank/Tank';
import {
  type ArrangeFish,
  type Region,
  WATER,
  homeRegions,
  tankGeometry,
  overviewRegions,
  sortFish,
} from '../tank/arrange';
import { buildFish, weatherFor } from '../tank/model';
import { measureText, normalizeText, uiFont } from '../theme/pixelFont';
import { applyLayout, reorder } from '../tank/territory';
import { FishDetails } from './FishDetails';
import {
  SPOT_MARGIN,
  clampInto,
  defaultSpot,
  placeSpot,
  resolveSpot,
  spotAt,
  spotPath,
  withSpot,
} from './panelSpot';
import { FishList } from './FishList';
import { GroupDetails, type GroupSummary } from './GroupDetails';
import { formatChangeRatio, formatMoney } from './format';
import { PenBar } from './PenBar';
import { MoveDialog, PenDialog } from './PenDialogs';
import { PixelButton } from './pixel/PixelButton';
import { PixelText } from './pixel/PixelText';
import { PixelIcon } from './pixel/PixelIcon';
import { TONE_COLOUR } from './pixel/tones';
import { ChangeTicker } from './ChangeTicker';
import { direction, directionTone } from './change';
import { usePixelScale } from './pixel/context';
import { useSnap } from './pixel/useSnap';

/** `?weather=stormy` (or any weather) in the URL previews that weather in the tank. */
const PREVIEW_WEATHER = ((w) =>
  (WEATHERS as readonly string[]).includes(w ?? '') ? (w as Weather) : undefined)(
  new URLSearchParams(window.location.search).get('weather'),
);

const WEATHER_LABEL: Record<Weather, string> = {
  sunny: 'Sunny',
  fair: 'Fair',
  calm: 'Calm',
  rainy: 'Rainy',
  stormy: 'Stormy',
};

/** Re-render every `ms` so time-based state (market open) stays current. */
function useNow(ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}

/** The pens a view shows, in pen order; unknown ids drop out and none means all. */
function shownPens(pens: readonly Pen[], view: TankView): Pen[] {
  if (view.pens === 'all') return [...pens];
  const ids = view.pens;
  const shown = pens.filter((p) => ids.includes(p.id));
  return shown.length ? shown : [...pens];
}

/** Narrower than this (UI pixels: phones held upright), details sit over the tank's bottom. */
const NARROW_SLOT = 300;
/** Two taps on a panel's title within this many milliseconds put it back in its default spot. */
const DOUBLE_TAP_MS = 350;

type Dialog =
  { kind: 'new-pen' } | { kind: 'edit-pen'; pen: Pen } | { kind: 'move'; holdingId: string };

interface Props {
  /** False while another site tab is showing: the tank pauses. */
  active: boolean;
  market: MarketStatus;
  onAdd: () => void;
  onChangeColours: (holdingId: string) => void;
  onSettings: () => void;
}

export function TankScreen({ active, market, onAdd, onChangeColours, onSettings }: Props) {
  const holdings = useHoldings();
  const pens = usePens();
  const profiles = useProfiles();
  const settings = useSettings();
  const entries = useMarketEntries();
  const now = useNow(60_000);
  const [selectedId, setSelectedFish] = useState<string>();
  /** A group label tapped in an overview (its region key). Fish and group selections exclude each other. */
  const [selectedGroup, setSelectedGroupKey] = useState<string>();
  const setSelectedId = (id: string | undefined) => {
    setSelectedFish(id);
    setSelectedGroupKey(undefined);
  };
  const selectGroup = (key: string | undefined) => {
    setSelectedGroupKey(key);
    setSelectedFish(undefined);
  };
  const [dialog, setDialog] = useState<Dialog>();
  const [dropPen, setDropPen] = useState<string>();
  const [placement, setPlacement] = useState<TankPlacement>();
  const { ui, dpr } = usePixelScale();
  /**
   * The hood's height in UI pixels: the tank leaves this much room above it.
   * Measured whenever the hood appears or changes size (it wraps on phones).
   */
  const [hoodHeight, setHoodHeight] = useState(0);
  const hoodNode = useRef<HTMLDivElement>(null);
  const hoodObserver = useRef<ResizeObserver>(undefined);
  // Inside PixelRoot one CSS pixel is one UI pixel, and every size is whole.
  const measureHood = useCallback(() => {
    const node = hoodNode.current;
    if (node) setHoodHeight(Math.round(node.offsetHeight));
  }, []);
  const hoodRef = useCallback(
    (node: HTMLDivElement | null) => {
      hoodObserver.current?.disconnect();
      hoodObserver.current = undefined;
      hoodNode.current = node;
      if (!node) return;
      hoodObserver.current = new ResizeObserver(measureHood);
      hoodObserver.current.observe(node);
    },
    [measureHood],
  );
  // Also after every render: the hood rewraps when the tank's width arrives,
  // which the observer doesn't always report. Settles once the height stops changing.
  useLayoutEffect(measureHood);
  // Shown immediately on change, before the settings write comes back.
  const [localView, setLocalView] = useState<TankView>();
  const view = useMemo(
    () => normalizeTankView(localView ?? settings?.tankView ?? DEFAULT_TANK_VIEW),
    [localView, settings?.tankView],
  );

  const [localLabels, setLocalLabels] = useState<TankLabels>();
  /** Panel spots just saved, ahead of the settings read catching up. */
  const [localSpots, setLocalSpots] = useState<Record<string, PanelSpot>>();
  /** The panel's place while it's being dragged. */
  const [panelDrag, setPanelDrag] = useState<{ left: number; top: number }>();
  const lastTitleTap = useRef(0);
  /** The details panel's size in UI pixels, to keep it inside the tank. */
  const [panelSize, setPanelSize] = useState({ w: 0, h: 0 });
  const panelObserver = useRef<ResizeObserver>(undefined);
  const panelRef = useCallback((node: HTMLDivElement | null) => {
    panelObserver.current?.disconnect();
    if (!node) return;
    // Inside PixelRoot one CSS pixel is one UI pixel.
    const measure = () =>
      setPanelSize((s) =>
        s.w === node.offsetWidth && s.h === node.offsetHeight
          ? s
          : { w: node.offsetWidth, h: node.offsetHeight },
      );
    measure();
    panelObserver.current = new ResizeObserver(measure);
    panelObserver.current.observe(node);
  }, []);
  const labels = localLabels ?? settings?.tankLabels ?? DEFAULT_TANK_LABELS;
  const setLabels = (next: TankLabels) => {
    setLocalLabels(next);
    void repo.saveSettings({ tankLabels: next });
  };

  const setView = (next: TankView) => {
    // Group keys belong to one arrangement; never carry one into another.
    setSelectedGroupKey(undefined);
    setLocalView(next);
    void repo.saveSettings({ tankView: next });
  };

  // Totals are in one home currency (fish details keep each stock's own).
  const homeCurrency = useHomeCurrency();
  const rates = useFxRates();
  /** Each holding's market, whether it's open and its latest day: fish sleep on their own market's hours. */
  const markets = useMemo(
    () =>
      marketStates(
        now,
        (holdings ?? []).map((h) => h.symbol),
        entries ?? new Map(),
      ),
    [now, holdings, entries],
  );
  const fish = useMemo(
    () =>
      holdings && profiles
        ? buildFish(
            holdings,
            profiles,
            entries ?? new Map(),
            { home: homeCurrency, rates },
            (symbol, quote) => staleSince(quote, markets.get(symbol)),
          )
        : [],
    [holdings, profiles, entries, homeCurrency, rates, markets],
  );
  const shown = useMemo(() => shownPens(pens ?? [], view), [pens, view]);
  const shownIds = useMemo(() => new Set(shown.map((p) => p.id)), [shown]);
  const visible = useMemo(() => fish.filter((f) => shownIds.has(f.penId)), [fish, shownIds]);
  /** A single pen is a home with the user's layout; several are an overview. */
  const home = shown.length === 1 ? shown[0] : undefined;
  const upColour = settings?.upColour;
  const sceneFish = useMemo(
    () =>
      visible.map(({ id, body, mood, primary, secondary, symbol, moodResult, stale }) => {
        // A day-old price shows no move and no mood today: the fish sleeps until it's priced.
        const today = stale ? undefined : moodResult;
        return {
          id,
          body,
          mood,
          primary,
          secondary,
          symbol,
          change:
            today && Number.isFinite(today.todayReturn)
              ? formatChangeRatio(today.todayReturn)
              : undefined,
          changeColour: today
            ? TONE_COLOUR[directionTone(direction(today.todayReturn), upColour)]
            : undefined,
          moodKnown: today !== undefined && today.reason !== 'bad-quote',
          temper: temperFor(moodResult?.sigma),
          asleep: stale !== undefined || markets.get(symbol)?.open === false,
        };
      }),
    [visible, upColour, markets],
  );
  // The water the tank has now (it grows to fill its space); the reference size until placed.
  const artWidth = placement?.artWidth;
  const artHeight = placement?.artHeight;
  const water = useMemo(
    () => (artWidth && artHeight ? tankGeometry(artWidth, artHeight).water : WATER),
    [artWidth, artHeight],
  );
  // Which of the shown holdings move together (history changes once a day).
  const kin = useMemo(() => {
    const histories = new Map(
      visible.map((f) => {
        const entry = entries?.get(f.symbol);
        return [f.symbol, { bars: entry?.bars ?? [], asOf: entry?.quote?.tradingDay }] as const;
      }),
    );
    const k = kinship(histories);
    const groupOf = new Map<string, string>();
    for (const g of k.groups) for (const s of g.symbols) groupOf.set(s, `kin:${g.symbols[0]}`);
    for (const s of k.alone) groupOf.set(s, 'alone');
    const tightness = new Map(k.groups.map((g) => [`kin:${g.symbols[0]}`, g.tightness]));
    return { groupOf, tightness, closest: k.closest };
  }, [visible, entries]);
  const regions = useMemo(() => {
    // Oldest first, so a new fish's patch is added at the end (no reshuffle).
    const added = new Map(holdings?.map((h) => [h.id, h.createdAt]));
    const byAge = [...visible].sort((a, b) => (added.get(a.id) ?? 0) - (added.get(b.id) ?? 0));
    const items: ArrangeFish[] = byAge.map((f) => ({
      id: f.id,
      symbol: f.symbol,
      penId: f.penId,
      mood: f.mood,
      body: f.body,
      value: f.home?.value,
      change: f.stale ? undefined : f.moodResult?.todayReturn,
      z: f.stale ? undefined : f.moodResult?.z,
      kin: kin.groupOf.get(f.symbol),
    }));
    // The user's own order: each shown pen's layout, pen by pen.
    const custom = shown.flatMap((p) =>
      applyLayout(
        byAge.filter((f) => f.penId === p.id).map((f) => f.id),
        p.layout,
      ),
    );
    if (home) {
      const order = sortFish(items, view.homeSort, custom).map((f) => f.id);
      return homeRegions(items, order, water);
    }
    return overviewRegions(view.group, view.sort, items, shown, custom, water);
  }, [visible, holdings, home, view.group, view.sort, view.homeSort, shown, water, kin]);

  const weather = useMemo(() => weatherFor(visible, entries ?? new Map()), [visible, entries]);
  // Each pen's weather, and all pens', for the pens bar (only where some fish is priced).
  const penWeather = useMemo(() => {
    const out = new Map<string, WeatherResult>();
    for (const p of pens ?? []) {
      const members = fish.filter((f) => f.penId === p.id);
      if (members.some((f) => f.home)) out.set(p.id, weatherFor(members, entries ?? new Map()));
    }
    return out;
  }, [pens, fish, entries]);
  const allWeather = useMemo(
    () => (fish.some((f) => f.home) ? weatherFor(fish, entries ?? new Map()) : undefined),
    [fish, entries],
  );
  // Each group's weather over an overview, for its label.
  const groupWeather = useMemo(() => {
    const out = new Map<string, Weather>();
    for (const r of regions) {
      if (!r.group) continue;
      const ids = new Set(r.group.fishIds);
      const members = visible.filter((f) => ids.has(f.id));
      if (members.some((f) => f.home)) {
        out.set(r.key, weatherFor(members, entries ?? new Map()).weather);
      }
    }
    return out;
  }, [regions, visible, entries]);
  // The light goes off when every shown fish's market is closed (an empty
  // tank follows US hours); the hood says which markets are closed.
  const shownMarkets = useMemo(
    () => visible.flatMap((f) => markets.get(f.symbol) ?? []),
    [visible, markets],
  );
  const open = useMemo(
    () => (shownMarkets.length > 0 ? shownMarkets.some((m) => m.open) : marketOpenNow(now, [], US)),
    [shownMarkets, now],
  );
  const closedText = useMemo(
    () =>
      shownMarkets.length > 0
        ? closedMarketsText(shownMarkets)
        : open
          ? undefined
          : 'Market closed',
    [shownMarkets, open],
  );

  const selected = visible.find((f) => f.id === selectedId);
  const currency = homeCurrency;
  const priced = visible.some((f) => f.home);

  const groupRegion = home ? undefined : regions.find((r) => r.key === selectedGroup && r.group);
  const summary = useMemo((): GroupSummary | undefined => {
    const group = groupRegion?.group;
    if (!groupRegion || !group) return undefined;
    const ids = new Set(group.fishIds);
    const members = visible.filter((f) => ids.has(f.id));
    // Priced = has a quote and an exchange rate into the home currency.
    const pricedMembers = members.filter((f) => f.home);
    const valueOf = (list: typeof visible) => list.reduce((a, f) => a + (f.home?.value ?? 0), 0);
    const value = valueOf(pricedMembers);
    const total = valueOf(visible);
    return {
      kind:
        groupRegion.key === 'other'
          ? 'Group'
          : ({
              pen: 'Pen',
              family: 'Family',
              mood: 'Mood',
              species: 'Species',
              correlation: 'Correlation',
            }[view.group as 'pen' | 'family' | 'mood' | 'species' | 'correlation'] ?? 'Group'),
      name: groupRegion.label ?? '',
      fishCount: members.length,
      weather: pricedMembers.length ? weatherFor(members, entries ?? new Map()) : undefined,
      value: pricedMembers.length ? value : undefined,
      share: pricedMembers.length && total > 0 ? value / total : undefined,
      unpriced: members.length - pricedMembers.length,
      currency: homeCurrency,
      // A kin group's tightness, found through its fish (region keys aren't group keys).
      ...(view.group === 'correlation' && {
        together: kin.tightness.get(kin.groupOf.get(members[0]?.symbol ?? '') ?? ''),
      }),
    };
  }, [groupRegion, visible, entries, view.group, homeCurrency, kin]);
  const groupPen = groupRegion?.penId ? pens?.find((p) => p.id === groupRegion.penId) : undefined;

  /**
   * Where a fish's or group's details go. By default over the tank's top-left
   * corner, or on phones held upright (where the tank fills the screen) over
   * its bottom, closer to the thumb. The user can drag it by its title; the
   * spot is kept per screen size, then per grouping (or per sort in a single
   * pen), each inheriting the one above until moved (src/ui/panelSpot.ts).
   */
  const narrowSlot = placement !== undefined && placement.slotWidth < NARROW_SLOT;
  const spotKeys = spotPath(
    narrowSlot,
    home ? { kind: 'pen', sort: view.homeSort } : { kind: 'overview', group: view.group },
  );
  const spots = localSpots ?? settings?.panelSpots;
  const tankBox = placement && {
    x: placement.left,
    y: placement.top,
    w: placement.width,
    h: placement.height,
  };
  const panelAt =
    panelDrag ??
    (tankBox
      ? placeSpot(resolveSpot(spots, spotKeys, narrowSlot), tankBox, panelSize)
      : { left: SPOT_MARGIN, top: SPOT_MARGIN });
  const detailsAt = {
    left: `calc(var(--sf-px) * ${panelAt.left})`,
    top: `calc(var(--sf-px) * ${panelAt.top})`,
  };
  const savePanelSpot = (spot: PanelSpot) => {
    const next = withSpot(spots, spotKeys, spot);
    setLocalSpots(next);
    void repo.saveSettings({ panelSpots: next });
  };
  /** Drag the panel by its title (not its buttons); double-tap the title to put it back. */
  const onPanelPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = e.target as Element;
    if (e.button !== 0 || !tankBox || !el.closest('.panel-title') || el.closest('button')) return;
    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const box = tankBox;
    const size = panelSize;
    const startX = e.clientX;
    const startY = e.clientY;
    const from = panelAt;
    let last = from;
    let moved = false;
    const onMove = (ev: PointerEvent) => {
      // Pointer movement in UI pixels; a few pixels' wobble is still a tap.
      const dx = (ev.clientX - startX) / (ui / dpr);
      const dy = (ev.clientY - startY) / (ui / dpr);
      if (!moved && Math.hypot(dx, dy) < 3) return;
      moved = true;
      last = clampInto(from.left + dx, from.top + dy, box, size);
      setPanelDrag(last);
    };
    const onUp = () => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
      if (moved) {
        savePanelSpot(spotAt(last.left, last.top, box, size));
        setPanelDrag(undefined);
        lastTitleTap.current = 0;
        return;
      }
      const now = performance.now();
      if (now - lastTitleTap.current < DOUBLE_TAP_MS) {
        savePanelSpot(defaultSpot(narrowSlot));
        lastTitleTap.current = 0;
      } else {
        lastTitleTap.current = now;
      }
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  };

  /** The pen a region belongs to: the home pen, or (in Pen mode) the pen it shows. */
  const penOfRegion = (region: Region): string | undefined => {
    if (home) return home.id;
    if (view.group === 'pen') return region.key.split('/')[0];
    return undefined;
  };

  /** The fish on screen in the order they're arranged (patch order, or group by group). */
  const arranged = useMemo(() => {
    const byId = new Map(visible.map((f) => [f.id, f]));
    const ids = [...new Set(regions.flatMap((r) => r.fishIds))];
    return ids.flatMap((id) => {
      const f = byId.get(id);
      return f ? [f] : [];
    });
  }, [visible, regions]);

  /** A pen's patch order: its saved layout, then the rest oldest first. */
  const penOrder = (penId: string) =>
    applyLayout(
      (holdings ?? [])
        .filter((h) => h.penId === penId)
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((h) => h.id),
      pens?.find((p) => p.id === penId)?.layout,
    );

  /** The sort in force here: a single pen's, or the overview's. */
  const activeSort = home ? view.homeSort : view.sort;

  /**
   * A pen's patch order as shown: its own layout when sorted by Custom, else
   * the sorted order on screen (so a drag starts from what the user sees).
   */
  const shownOrder = (penId: string) =>
    activeSort === 'custom'
      ? penOrder(penId)
      : applyLayout(
          penOrder(penId),
          arranged.filter((f) => f.penId === penId).map((f) => f.id),
        );

  /** Save a pen's new order; reordering by hand switches the sort to Custom. */
  const saveOrder = async (penId: string, order: string[]) => {
    await repo.setPenLayout(penId, order);
    if (activeSort !== 'custom') {
      setView(home ? { ...view, homeSort: 'custom' } : { ...view, sort: 'custom' });
    }
  };

  /** Keyboard reordering in a single pen: one place earlier or later. */
  const reorderByKey = async (id: string, step: -1 | 1) => {
    if (!home) return undefined;
    const order = shownOrder(home.id);
    const i = order.indexOf(id);
    const j = i + step;
    const onto = order[j];
    if (i < 0) return undefined;
    if (!onto) return { place: i + 1, of: order.length };
    await saveOrder(home.id, reorder(order, id, onto));
    return { place: j + 1, of: order.length };
  };

  const onDrop = (id: string, target: DropTarget | undefined) => {
    const f = fish.find((x) => x.id === id);
    if (!f || !target || !pens) return;
    const toPen = target.kind === 'pen' ? target.penId : penOfRegion(target.region);
    if (!toPen) return;
    if (toPen !== f.penId) {
      void repo.moveHolding(id, toPen).then(setSelectedId);
      return;
    }
    if (target.kind !== 'region' || !target.region.patch) return;
    // Reorder: take the slot of the fish dropped on (the communal patch means last).
    const order = shownOrder(toPen);
    const onto = target.region.fishIds.length === 1 ? target.region.fishIds[0] : order.at(-1);
    if (!onto || onto === id) return;
    void saveOrder(toPen, reorder(order, id, onto));
  };

  const onPen = (penId: string, toggle: boolean) => {
    setSelectedId(undefined);
    if (!toggle) return setView({ ...view, pens: [penId] });
    const current = shown.map((p) => p.id);
    const next = current.includes(penId)
      ? current.filter((id) => id !== penId)
      : [...current, penId];
    setView({ ...view, pens: next.length ? next : [penId] });
  };

  const moving =
    dialog?.kind === 'move' ? holdings?.find((h) => h.id === dialog.holdingId) : undefined;

  return (
    <div className="tank-screen">
      {pens && (
        <PenBar
          pens={pens}
          shown={shown.map((p) => p.id)}
          group={view.group}
          sort={home ? view.homeSort : view.sort}
          overview={!home}
          dropTarget={dropPen}
          onShowAll={() => {
            setSelectedId(undefined);
            // Remember what was shown, for unticking "All pens" later.
            const current = shown.map((p) => p.id);
            const all = current.length === (pens?.length ?? 0);
            setView({ ...view, pens: 'all', ...(!all && { beforeAll: current }) });
          }}
          onUnshowAll={() => {
            setSelectedId(undefined);
            // Back to the pens shown before "All pens", those that still exist, else the first pen.
            const ids = new Set(pens?.map((p) => p.id));
            const before = (view.beforeAll ?? []).filter((id) => ids.has(id));
            const first = pens?.[0]?.id;
            const next = before.length && before.length < ids.size ? before : first ? [first] : [];
            if (next.length) setView({ ...view, pens: next });
          }}
          onPen={onPen}
          onGroup={(group) => setView({ ...view, group })}
          onSort={(sort) => setView(home ? { ...view, homeSort: sort } : { ...view, sort })}
          labels={labels}
          onLabels={setLabels}
          onNewPen={() => setDialog({ kind: 'new-pen' })}
          onEditPen={() => home && setDialog({ kind: 'edit-pen', pen: home })}
          penWeather={penWeather}
          allWeather={allWeather}
        />
      )}

      <Tank
        fish={sceneFish}
        active={active}
        view={shown.map((p) => p.id).join(',')}
        decorSeed={home ? `pen/${home.id}` : 'overview'}
        labels={labels}
        regions={regions}
        night={!open}
        weather={PREVIEW_WEATHER ?? (priced ? weather.weather : 'calm')}
        selectedId={selected?.id}
        groupOutline={groupRegion?.group?.rect}
        fishCount={visible.length}
        regroupSpeed={settings?.regroupSpeed ?? 'normal'}
        hood={hoodHeight}
        onSelect={setSelectedId}
        onTapWater={(tapX, tapY) => {
          // In an overview, open water belongs to a group: tap it for that
          // group's summary (again to close). Elsewhere it clears the selection.
          // Taps in the thin margins above and below the water (easy to hit
          // with a finger on a phone) count for the nearest area.
          const x = Math.min(water.x + water.w - 1, Math.max(water.x, tapX));
          const y = Math.min(water.y + water.h - 1, Math.max(water.y, tapY));
          const r = regions.find(
            ({ group: g }) =>
              g &&
              x >= g.rect.x &&
              x < g.rect.x + g.rect.w &&
              y >= g.rect.y &&
              y < g.rect.y + g.rect.h,
          );
          selectGroup(!home && r && r.key !== selectedGroup ? r.key : undefined);
        }}
        onDrop={onDrop}
        onDragOverPen={setDropPen}
        onPlacement={setPlacement}
        label={`Fish tank with ${visible.length} fish`}
      >
        {/*
          The hood: the tank's weather, today's change and market state on a
          strip sitting on the tank's lid (drawn in the same panel colours).
        */}
        <div
          ref={hoodRef}
          className="tank-hood px-bar"
          role="status"
          style={
            placement
              ? {
                  left: `calc(var(--sf-px) * ${placement.left})`,
                  top: `calc(var(--sf-px) * ${placement.top - hoodHeight})`,
                  width: `calc(var(--sf-px) * ${placement.width})`,
                }
              : { visibility: 'hidden' }
          }
        >
          {priced && (
            <>
              <span className="tank-bar-weather">
                <PixelIcon name={weather.weather} />
                <PixelText text={WEATHER_LABEL[weather.weather]} />
              </span>
              <ChangeTicker
                change={weather.changeRatio}
                text={`${formatChangeRatio(weather.changeRatio)} (${formatMoney(weather.change, currency, true)})`}
              />
              <PixelText text="today" tone="textMuted" />
            </>
          )}
          {closedText && <PixelText text={closedText} tone="textMuted" />}
          <MarketMessage market={market} hasFish={fish.length > 0} onSettings={onSettings} />
        </div>
        {!home && placement && (
          <RegionLabels
            regions={regions}
            placement={placement}
            selectedKey={groupRegion?.key}
            weatherOf={(key) => groupWeather.get(key)}
            onSelect={(key) => selectGroup(key === selectedGroup ? undefined : key)}
          />
        )}
        <div className="fish-list">
          <FishList
            fish={arranged}
            penName={(id) => (home ? undefined : pens?.find((p) => p.id === id)?.name)}
            closedMarket={(symbol) => {
              const m = markets.get(symbol);
              return m && !m.open ? m.exchange.name : undefined;
            }}
            selectedId={selected?.id}
            onSelect={setSelectedId}
            onReorder={home ? reorderByKey : undefined}
          />
        </div>
        {(summary || selected) && (
          <div
            ref={panelRef}
            className="details-anchor"
            style={detailsAt}
            onPointerDown={onPanelPointerDown}
          >
            {summary && (
              <GroupDetails
                summary={summary}
                onOpen={groupPen && (() => setView({ ...view, pens: [groupPen.id] }))}
                onEdit={groupPen && (() => setDialog({ kind: 'edit-pen', pen: groupPen }))}
                onClose={() => selectGroup(undefined)}
              />
            )}

            {selected && (
              <FishDetails
                fish={selected}
                penName={home ? undefined : pens?.find((p) => p.id === selected.penId)?.name}
                homeCurrency={homeCurrency}
                closest={kin.closest.get(selected.symbol)}
                onChangeColours={() => onChangeColours(selected.id)}
                onMove={() => setDialog({ kind: 'move', holdingId: selected.id })}
                onClose={() => setSelectedId(undefined)}
              />
            )}
          </div>
        )}
      </Tank>

      {holdings?.length === 0 && <EmptyTank onAdd={onAdd} />}
      {home && holdings && holdings.length > 0 && visible.length === 0 && (
        <EmptyPen name={home.name} />
      )}

      {pens && dialog?.kind === 'new-pen' && (
        <PenDialog
          pens={pens}
          fishCount={0}
          onDone={(id) => {
            setDialog(undefined);
            if (id) setView({ ...view, pens: [id] });
          }}
        />
      )}
      {pens && dialog?.kind === 'edit-pen' && (
        <PenDialog
          pen={dialog.pen}
          pens={pens}
          fishCount={fish.filter((f) => f.penId === dialog.pen.id).length}
          onDone={() => setDialog(undefined)}
        />
      )}
      {pens && moving && (
        <MoveDialog
          holding={moving}
          pens={pens}
          onDone={(id) => {
            setDialog(undefined);
            if (id) setSelectedId(id);
          }}
        />
      )}
    </div>
  );
}

/**
 * Group names over an overview, aligned to the tank's art pixels (rounded to
 * UI pixels). Tapping one selects the group, like tapping a fish.
 */
function RegionLabels({
  regions,
  placement,
  selectedKey,
  weatherOf,
  onSelect,
}: {
  regions: readonly Region[];
  placement: TankPlacement;
  selectedKey?: string;
  /** A group's weather today, when any of its fish is priced. */
  weatherOf: (key: string) => Weather | undefined;
  onSelect: (key: string) => void;
}) {
  const { ui } = usePixelScale();
  const toUi = (art: number) => Math.round((art * placement.scale) / ui);
  /** Label padding (2 each side) plus a pixel of gap to the next region. */
  const chrome = 5;
  return (
    <div className="tank-labels">
      {regions.map((r) => {
        if (!r.group) return null;
        const weather = weatherOf(r.key);
        // The label may run across the whole group (a pen spans several
        // patches), less the weather icon: 7 pixels and a 3-pixel gap.
        const groupRight = r.group.rect.x + r.group.rect.w;
        const room = toUi(groupRight - r.rect.x) - chrome - (weather ? ICON_ROOM : 0);
        const text = r.label ? fitLabel(r.label, room) : '';
        if (!text) return null;
        const on = r.key === selectedKey;
        return (
          <button
            key={r.key}
            type="button"
            className={on ? 'tank-label is-selected' : 'tank-label'}
            style={{
              left: `calc(var(--sf-px) * ${placement.left + toUi(r.rect.x) + 1})`,
              top: `calc(var(--sf-px) * ${placement.top + toUi(r.rect.y) + 1})`,
            }}
            aria-label={`${r.label ?? ''}${weather ? `, ${weather}` : ''} summary`}
            aria-pressed={on}
            onClick={() => onSelect(r.key)}
          >
            {weather ? (
              <span className="tank-label-content">
                <PixelIcon name={weather} outline />
                <PixelText text={text} outline />
              </span>
            ) : (
              <PixelText text={text} outline />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** UI pixels a group label's weather icon takes: the 7-pixel icon and a 3-pixel gap. */
const ICON_ROOM = 10;

/** The label, cut short with an ellipsis if it's wider than `width` UI pixels. */
function fitLabel(label: string, width: number): string {
  const text = normalizeText(uiFont, label);
  if (measureText(uiFont, text) <= width) return label;
  for (let n = text.length - 1; n > 0; n--) {
    const cut = `${text.slice(0, n).trimEnd()}…`;
    if (measureText(uiFont, cut) <= width) return cut;
  }
  return '';
}

/** First run: what the app is, and two ways to start. */
function EmptyTank({ onAdd }: { onAdd: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useSnap(ref);
  const { cols } = usePixelScale();
  // Text width: up to 190 UI pixels, less on narrow phones (panel chrome is 12).
  const wrap = Math.min(190, cols - 24);
  return (
    <section ref={ref} className="tank-empty px-panel px-stack" aria-label="Welcome">
      <PixelText text="Welcome to Stock Fish" tone="heading" />
      <PixelText
        text="Each fish is one of your holdings. Its face shows how today is going, compared with a normal day for that stock."
        wrap={wrap}
      />
      <PixelText
        text="Prices need a free market data key (in Settings). The sample works with demo data too."
        tone="textMuted"
        wrap={wrap}
      />
      <div className="px-row">
        <PixelButton label="Add your first fish" icon="plus" primary onClick={onAdd} />
        <PixelButton
          label="Load sample tank"
          onClick={() => void importHoldingsCsv(repo, SAMPLE_TANK_CSV)}
        />
      </div>
      <PixelText
        text="Not investment advice. Stock Fish never trades."
        tone="warning"
        wrap={wrap}
      />
    </section>
  );
}

function EmptyPen({ name }: { name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useSnap(ref);
  return (
    <div ref={ref} className="tank-empty px-panel px-stack">
      <PixelText text={`No fish in ${name} yet.`} />
      <PixelText
        text="Drag a fish onto this pen's tab, or tap a fish and choose Move."
        tone="textMuted"
        wrap={160}
      />
    </div>
  );
}

function MarketMessage({
  market,
  hasFish,
  onSettings,
}: {
  market: MarketStatus;
  hasFish: boolean;
  onSettings: () => void;
}) {
  if (!hasFish) return null;
  if (market.state === 'no-provider') {
    return (
      <>
        <PixelText text="Add a market data key to see today's moods." tone="warning" />
        <PixelButton label="Settings" icon="settings" onClick={onSettings} />
      </>
    );
  }
  if (market.state === 'updating') return <PixelText text="Updating prices…" tone="textMuted" />;
  if (market.stop === 'auth') {
    return (
      <>
        <PixelText text="Your market data key was rejected." tone="warning" />
        <PixelButton label="Settings" icon="settings" onClick={onSettings} />
      </>
    );
  }
  if (market.stop === 'rate-limit') {
    return <PixelText text="Request limit reached; retrying in a minute." tone="textMuted" />;
  }
  if (market.failed.length > 0) {
    return <PixelText text={`Couldn't update ${market.failed.join(', ')}.`} tone="warning" />;
  }
  return null;
}
