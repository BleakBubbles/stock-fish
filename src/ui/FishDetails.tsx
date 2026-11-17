import type { Mood } from '../mood/types';
import type { FishView } from '../tank/model';
import { formatChangeRatio, formatMoney } from './format';

const MOOD_LABEL: Record<Mood, string> = {
  ecstatic: 'Ecstatic',
  happy: 'Happy',
  neutral: 'Calm',
  uneasy: 'Uneasy',
  sad: 'Sad',
};

interface Props {
  fish: FishView;
  onChangeColours: () => void;
  onClose: () => void;
}

/** The numbers behind one fish: what a price board would show. */
export function FishDetails({ fish, onChangeColours, onClose }: Props) {
  const quote = fish.quote;
  const result = fish.moodResult;
  const currency = quote?.currency;

  return (
    <section
      className="fish-details panel stack"
      aria-labelledby="fish-details-title"
      aria-live="polite"
    >
      <h2 id="fish-details-title">
        {fish.symbol}
        {fish.name && <span className="muted"> · {fish.name}</span>}
      </h2>
      {quote && result ? (
        <dl className="numbers">
          <div>
            <dt>Today</dt>
            <dd>
              {formatChangeRatio(result.todayReturn)}{' '}
              <span className="muted">({formatMoney(fish.change ?? NaN, currency, true)})</span>
            </dd>
          </div>
          <div>
            <dt>Price</dt>
            <dd>{formatMoney(quote.price, currency)}</dd>
          </div>
          <div>
            <dt>Holding</dt>
            <dd>
              {fish.quantity.toLocaleString()} × {formatMoney(quote.price, currency)} ={' '}
              {formatMoney(fish.quantity * quote.price, currency)}
            </dd>
          </div>
          <div>
            <dt>Mood</dt>
            <dd>
              {MOOD_LABEL[fish.mood]}
              <span className="muted">
                {result.sigma !== undefined && result.reason === 'ok'
                  ? ` · a typical day moves about ±${(result.sigma * 100).toFixed(2)}%`
                  : result.reason === 'short-history'
                    ? ' · not enough history yet to know a typical day'
                    : ''}
              </span>
            </dd>
          </div>
        </dl>
      ) : (
        <p className={fish.state === 'error' ? 'message is-warning' : 'muted'}>
          {fish.state === 'error' ? `Couldn't get prices: ${fish.error}` : 'Waiting for prices…'}
        </p>
      )}
      {quote && fish.error && (
        <p className="message is-warning">Last update failed: {fish.error}</p>
      )}
      <div className="actions">
        <button type="button" className="button" onClick={onChangeColours}>
          Change colours
        </button>
        <button type="button" className="button" onClick={onClose}>
          Close
        </button>
      </div>
    </section>
  );
}
