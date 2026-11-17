import { useEffect, useMemo, useRef, useState } from 'react';
import { marketOpenNow } from '../data/market';
import { useHoldings, useProfiles } from '../data/store';
import { type MarketStatus, useMarketEntries } from '../data/useMarket';
import type { Weather } from '../mood';
import { Tank } from '../tank/Tank';
import { buildFish, weatherFor } from '../tank/model';
import { FishDetails } from './FishDetails';
import { formatChangeRatio, formatMoney } from './format';
import { PixelButton } from './pixel/PixelButton';
import { PixelText } from './pixel/PixelText';
import { useSnap } from './pixel/useSnap';

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

interface Props {
  market: MarketStatus;
  onAdd: () => void;
  onChangeColours: (holdingId: string) => void;
  onSettings: () => void;
}

export function TankScreen({ market, onAdd, onChangeColours, onSettings }: Props) {
  const holdings = useHoldings();
  const profiles = useProfiles();
  const entries = useMarketEntries();
  const now = useNow(60_000);
  const [selectedId, setSelectedId] = useState<string>();

  const fish = useMemo(
    () => (holdings && profiles ? buildFish(holdings, profiles, entries ?? new Map()) : []),
    [holdings, profiles, entries],
  );
  const sceneFish = useMemo(
    () =>
      fish.map(({ id, body, mood, primary, secondary }) => ({
        id,
        body,
        mood,
        primary,
        secondary,
      })),
    [fish],
  );
  const weather = useMemo(() => weatherFor(fish, entries ?? new Map()), [fish, entries]);
  const open = useMemo(() => {
    const recent = [...(entries?.values() ?? [])].flatMap((e) =>
      e.quote && e.quoteAt !== undefined
        ? [{ marketOpen: e.quote.marketOpen, fetchedAt: e.quoteAt }]
        : [],
    );
    return marketOpenNow(now, recent);
  }, [entries, now]);

  const selected = fish.find((f) => f.id === selectedId);
  const currencies = new Set(fish.flatMap((f) => (f.quote?.currency ? [f.quote.currency] : [])));
  const currency = currencies.size === 1 ? [...currencies][0] : undefined;
  const priced = fish.some((f) => f.quote);

  return (
    <div className="tank-screen">
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
        night={!open}
        selectedId={selected?.id}
        onSelect={setSelectedId}
        label={`Fish tank with ${fish.length} fish`}
      />

      {holdings?.length === 0 && <EmptyTank onAdd={onAdd} />}

      {selected && (
        <FishDetails
          fish={selected}
          onChangeColours={() => onChangeColours(selected.id)}
          onClose={() => setSelectedId(undefined)}
        />
      )}
    </div>
  );
}

function EmptyTank({ onAdd }: { onAdd: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useSnap(ref);
  return (
    <div ref={ref} className="tank-empty px-panel px-stack">
      <PixelText text="Your tank is empty." />
      <PixelButton label="Add your first fish" primary onClick={onAdd} />
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
        <PixelButton label="Settings" onClick={onSettings} />
      </>
    );
  }
  if (market.state === 'updating') return <PixelText text="Updating prices…" tone="textMuted" />;
  if (market.stop === 'auth') {
    return (
      <>
        <PixelText text="Your market data key was rejected." tone="warning" />
        <PixelButton label="Settings" onClick={onSettings} />
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
