import { useEffect, useMemo, useRef, useState } from 'react';
import { marketOpenNow } from '../data/market';
import {
  DEFAULT_TANK_LABELS,
  DEFAULT_TANK_VIEW,
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
import { WEATHERS, type Weather, temperFor } from '../mood';
import { type DropTarget, Tank, type TankPlacement } from '../tank/Tank';
import {
  type ArrangeFish,
  type Region,
  WATER,
  homeRegions,
  overviewRegions,
} from '../tank/arrange';
import { buildFish, weatherFor } from '../tank/model';
import { measureText, normalizeText, uiFont } from '../theme/pixelFont';
import { applyLayout, reorder } from '../tank/territory';
import { FishDetails } from './FishDetails';
import { FishList } from './FishList';
import { GroupDetails, type GroupSummary } from './GroupDetails';
import { formatChangeRatio, formatMoney } from './format';
import { PenBar } from './PenBar';
import { MoveDialog, PenDialog } from './PenDialogs';
import { PixelButton } from './pixel/PixelButton';
import { PixelText } from './pixel/PixelText';
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

/** UI pixels needed below the tank, and missing beside it, to put details underneath. */
const STACK_BELOW = 100;
const STACK_BESIDE = 210;

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
  // Shown immediately on change, before the settings write comes back.
  const [localView, setLocalView] = useState<TankView>();
  const view = localView ?? settings?.tankView ?? DEFAULT_TANK_VIEW;

  const [localLabels, setLocalLabels] = useState<TankLabels>();
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
  const fish = useMemo(
    () =>
      holdings && profiles
        ? buildFish(holdings, profiles, entries ?? new Map(), { home: homeCurrency, rates })
        : [],
    [holdings, profiles, entries, homeCurrency, rates],
  );
  const shown = useMemo(() => shownPens(pens ?? [], view), [pens, view]);
  const shownIds = useMemo(() => new Set(shown.map((p) => p.id)), [shown]);
  const visible = useMemo(() => fish.filter((f) => shownIds.has(f.penId)), [fish, shownIds]);
  /** A single pen is a home with the user's layout; several are an overview. */
  const home = shown.length === 1 ? shown[0] : undefined;

  const sceneFish = useMemo(
    () =>
      visible.map(({ id, body, mood, primary, secondary, symbol, moodResult }) => ({
        id,
        body,
        mood,
        primary,
        secondary,
        symbol,
        change:
          moodResult && Number.isFinite(moodResult.todayReturn)
            ? formatChangeRatio(moodResult.todayReturn)
            : undefined,
        moodKnown: moodResult !== undefined && moodResult.reason !== 'bad-quote',
        temper: temperFor(moodResult?.sigma),
      })),
    [visible],
  );
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
    }));
    return home ? homeRegions(items, home.layout) : overviewRegions(view.arrange, items, shown);
  }, [visible, holdings, home, view.arrange, shown]);

  const weather = useMemo(() => weatherFor(visible, entries ?? new Map()), [visible, entries]);
  const open = useMemo(() => {
    const recent = [...(entries?.values() ?? [])].flatMap((e) =>
      e.quote && e.quoteAt !== undefined
        ? [{ marketOpen: e.quote.marketOpen, fetchedAt: e.quoteAt }]
        : [],
    );
    return marketOpenNow(now, recent);
  }, [entries, now]);

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
          : ({ pen: 'Pen', family: 'Family', mood: 'Mood', species: 'Species' }[
              view.arrange as 'pen' | 'family' | 'mood' | 'species'
            ] ?? 'Group'),
      name: groupRegion.label ?? '',
      fishCount: members.length,
      weather: pricedMembers.length ? weatherFor(members, entries ?? new Map()) : undefined,
      value: pricedMembers.length ? value : undefined,
      share: pricedMembers.length && total > 0 ? value / total : undefined,
      unpriced: members.length - pricedMembers.length,
      currency: homeCurrency,
    };
  }, [groupRegion, visible, entries, view.arrange, homeCurrency]);
  const groupPen = groupRegion?.penId ? pens?.find((p) => p.id === groupRegion.penId) : undefined;

  /**
   * Phones held upright: no room beside the tank, plenty below. The tank sits
   * at the top and a fish's or group's details go underneath it, so both show.
   * Elsewhere details sit in the tank area's top-left corner.
   */
  const stacked =
    !!placement &&
    placement.slotHeight - placement.height >= STACK_BELOW &&
    placement.slotWidth - placement.width < STACK_BESIDE;
  const detailsTop = stacked && placement ? placement.top + placement.height + 4 : 4;

  /** The pen a region belongs to: the home pen, or (in Pen mode) the pen it shows. */
  const penOfRegion = (region: Region): string | undefined => {
    if (home) return home.id;
    if (view.arrange === 'pen') return region.key.split('/')[0];
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

  /** Keyboard reordering in a single pen: one place earlier or later. */
  const reorderByKey = async (id: string, step: -1 | 1) => {
    if (!home) return undefined;
    const order = penOrder(home.id);
    const i = order.indexOf(id);
    const j = i + step;
    const onto = order[j];
    if (i < 0) return undefined;
    if (!onto) return { place: i + 1, of: order.length };
    await repo.setPenLayout(home.id, reorder(order, id, onto));
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
    const order = penOrder(toPen);
    const onto = target.region.fishIds.length === 1 ? target.region.fishIds[0] : order.at(-1);
    if (!onto || onto === id) return;
    void repo.setPenLayout(toPen, reorder(order, id, onto));
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
          arrange={view.arrange}
          overview={!home}
          dropTarget={dropPen}
          onShowAll={() => {
            setSelectedId(undefined);
            setView({ ...view, pens: 'all' });
          }}
          onPen={onPen}
          onArrange={(arrange) => setView({ ...view, arrange })}
          labels={labels}
          onLabels={setLabels}
          onNewPen={() => setDialog({ kind: 'new-pen' })}
          onEditPen={() => home && setDialog({ kind: 'edit-pen', pen: home })}
        />
      )}

      <div className="tank-bar px-bar" role="status">
        {priced && (
          <>
            <PixelText text={WEATHER_LABEL[weather.weather]} />
            <PixelText text={formatChangeRatio(weather.changeRatio)} />
            <PixelText
              text={`(${formatMoney(weather.change, currency, true)}) today`}
              tone="textMuted"
            />
          </>
        )}
        {!open && <PixelText text="Market closed" tone="textMuted" />}
        <MarketMessage market={market} hasFish={fish.length > 0} onSettings={onSettings} />
      </div>

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
        alignTop={stacked}
        onSelect={setSelectedId}
        onTapWater={(tapX, tapY) => {
          // In an overview, open water belongs to a group: tap it for that
          // group's summary (again to close). Elsewhere it clears the selection.
          // Taps in the thin margins above and below the water (easy to hit
          // with a finger on a phone) count for the nearest area.
          const x = Math.min(WATER.x + WATER.w - 1, Math.max(WATER.x, tapX));
          const y = Math.min(WATER.y + WATER.h - 1, Math.max(WATER.y, tapY));
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
        {!home && placement && (
          <RegionLabels
            regions={regions}
            placement={placement}
            selectedKey={groupRegion?.key}
            onSelect={(key) => selectGroup(key === selectedGroup ? undefined : key)}
          />
        )}
        <div className="fish-list">
          <FishList
            fish={arranged}
            penName={(id) => (home ? undefined : pens?.find((p) => p.id === id)?.name)}
            selectedId={selected?.id}
            onSelect={setSelectedId}
            onReorder={home ? reorderByKey : undefined}
          />
        </div>
        {(summary || selected) && (
          <div className="details-anchor" style={{ top: `calc(var(--sf-px) * ${detailsTop})` }}>
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
  onSelect,
}: {
  regions: readonly Region[];
  placement: TankPlacement;
  selectedKey?: string;
  onSelect: (key: string) => void;
}) {
  const { ui } = usePixelScale();
  const toUi = (art: number) => Math.round((art * placement.scale) / ui);
  /** Label padding (2 each side) plus a pixel of gap to the next region. */
  const chrome = 5;
  return (
    <div className="tank-labels">
      {regions.map((r) => {
        const text = r.label ? fitLabel(r.label, toUi(r.rect.w) - chrome) : '';
        if (!text || !r.group) return null;
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
            aria-label={`${r.label ?? ''} summary`}
            aria-pressed={on}
            onClick={() => onSelect(r.key)}
          >
            <PixelText text={text} />
          </button>
        );
      })}
    </div>
  );
}

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
