import { useEffect, useMemo, useState } from 'react';
import { marketOpenNow } from '../data/market';
import { useHoldings, useProfiles } from '../data/store';
import { type MarketStatus, useMarketEntries } from '../data/useMarket';
import type { Weather } from '../mood';
import { Tank } from '../tank/Tank';
import { buildFish, weatherFor } from '../tank/model';
import { FishDetails } from './FishDetails';
import { formatChangeRatio, formatMoney } from './format';

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
      <Tank
        fish={sceneFish}
        night={!open}
        selectedId={selected?.id}
        onSelect={setSelectedId}
        label={`Fish tank with ${fish.length} fish`}
      />

      <div className="tank-bar panel" role="status">
        {priced && (
          <span>
            <strong>{WEATHER_LABEL[weather.weather]}</strong>{' '}
            {formatChangeRatio(weather.changeRatio)}{' '}
            <span className="muted">({formatMoney(weather.change, currency, true)}) today</span>
          </span>
        )}
        {!open && <span className="muted">Market closed</span>}
        <MarketMessage market={market} hasFish={fish.length > 0} onSettings={onSettings} />
      </div>

      {holdings?.length === 0 && (
        <div className="tank-empty panel stack">
          <p>Your tank is empty.</p>
          <button type="button" className="button is-primary" onClick={onAdd}>
            Add your first fish
          </button>
        </div>
      )}

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
      <span className="message is-warning">
        Add a market data key in{' '}
        <button type="button" className="link" onClick={onSettings}>
          Settings
        </button>{' '}
        to see today's moods.
      </span>
    );
  }
  if (market.state === 'updating') return <span className="muted">Updating prices…</span>;
  if (market.stop === 'auth') {
    return (
      <span className="message is-warning">
        Your market data key was rejected. Check{' '}
        <button type="button" className="link" onClick={onSettings}>
          Settings
        </button>
        .
      </span>
    );
  }
  if (market.stop === 'rate-limit') {
    return <span className="muted">Request limit reached; retrying in a minute.</span>;
  }
  if (market.failed.length > 0) {
    return <span className="message is-warning">Couldn't update {market.failed.join(', ')}.</span>;
  }
  return null;
}
