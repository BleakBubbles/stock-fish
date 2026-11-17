import { useState } from 'react';
import { lookUpSymbol } from '../data/lookup';
import { isValidCostBasis, isValidQuantity, isValidSymbol, normalizeSymbol } from '../data/model';
import { providerFromSettings } from '../data/providers';
import { repo, usePens, useSettings } from '../data/store';
import { type FishColours, defaultColours } from '../theme';
import { type SectorSource, SOURCE_LABEL } from '../data/sectors';
import { bodyForSector, familyLabel } from '../theme/bodies';
import { ColourPicker } from './ColourPicker';
import { FamilyPicker } from './FamilyPicker';
import { FishSprite } from './FishSprite';
import { NEW_PEN, PenField } from './PenField';
import { parseNumberInput } from './files';

interface Props {
  onDone: () => void;
}

interface Draft {
  symbol: string;
  quantity: number;
  costBasis?: number;
  penId: string;
  newPenName: string;
  sector?: string;
  sectorSource?: SectorSource;
  name?: string;
  notice?: string;
}

/** Add a holding: details, then "meet your fish" with colours pre-filled. */
export function AddHolding({ onDone }: Props) {
  const [draft, setDraft] = useState<Draft>();

  return draft ? (
    <MeetYourFish draft={draft} onBack={() => setDraft(undefined)} onDone={onDone} />
  ) : (
    <DetailsStep onNext={setDraft} onCancel={onDone} />
  );
}

function DetailsStep({ onNext, onCancel }: { onNext: (d: Draft) => void; onCancel: () => void }) {
  const pens = usePens();
  const settings = useSettings();
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [costBasis, setCostBasis] = useState('');
  const [penChoice, setPenChoice] = useState<string>();
  const [newPenName, setNewPenName] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (!pens || !settings) return null;
  const provider = providerFromSettings(settings);
  const penId = penChoice ?? pens[0]?.id ?? NEW_PEN;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const s = normalizeSymbol(symbol);
    const q = parseNumberInput(quantity);
    const c = parseNumberInput(costBasis);
    if (!isValidSymbol(s)) return setError('Enter a ticker symbol, like AAPL or BRK.B.');
    if (q === undefined || !isValidQuantity(q)) return setError('Quantity must be more than 0.');
    if (!isValidCostBasis(c)) return setError('Cost per share must be a number, 0 or more.');
    if (penId === NEW_PEN && !newPenName.trim()) return setError('Name the new pen.');

    setError(undefined);
    setBusy(true);
    try {
      const result = await lookUpSymbol(provider, repo, s);
      if (result.status === 'not-found') return setError(result.message);
      onNext({
        symbol: s,
        quantity: q,
        costBasis: c,
        penId,
        newPenName,
        sector: result.sector,
        sectorSource: result.source,
        name: result.name,
        notice: result.status === 'unchecked' ? result.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel stack" onSubmit={submit} noValidate>
      <h2>Add a holding</h2>
      <div className="field">
        <label htmlFor="symbol">Symbol</label>
        <input
          id="symbol"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="AAPL"
          maxLength={20}
          autoFocus
        />
      </div>
      <div className="field">
        <label htmlFor="quantity">Quantity</label>
        <input
          id="quantity"
          inputMode="decimal"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="10"
        />
      </div>
      <div className="field">
        <label htmlFor="cost">
          Average cost per share <span className="muted">(optional)</span>
        </label>
        <input
          id="cost"
          inputMode="decimal"
          value={costBasis}
          onChange={(e) => setCostBasis(e.target.value)}
        />
      </div>
      <PenField
        pens={pens}
        value={penId}
        newName={newPenName}
        onChange={setPenChoice}
        onNewNameChange={setNewPenName}
      />
      {error && (
        <p className="message is-warning" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit" className="button is-primary" disabled={busy}>
          {busy ? 'Checking…' : 'Next'}
        </button>
        <button type="button" className="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function MeetYourFish({
  draft,
  onBack,
  onDone,
}: {
  draft: Draft;
  onBack: () => void;
  onDone: () => void;
}) {
  const defaults = defaultColours(draft.symbol);
  const [colours, setColours] = useState<FishColours>(defaults);
  const [error, setError] = useState<string>();
  const [chosenSector, setChosenSector] = useState<string>();
  const known = draft.sectorSource !== undefined;
  const [choosingFamily, setChoosingFamily] = useState(!known);
  const sector = chosenSector ?? draft.sector;
  const body = bodyForSector(sector);

  async function save() {
    try {
      const pen =
        draft.penId === NEW_PEN
          ? await repo.findOrCreatePen(draft.newPenName)
          : { id: draft.penId };
      if (chosenSector) await repo.setUserSector(draft.symbol, chosenSector);
      await repo.addHolding({
        symbol: draft.symbol,
        quantity: draft.quantity,
        costBasis: draft.costBasis,
        penId: pen.id,
        // Store only real choices, so the fish follows default changes otherwise.
        primary: colours.primary === defaults.primary ? undefined : colours.primary,
        secondary: colours.secondary === defaults.secondary ? undefined : colours.secondary,
      });
      onDone();
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <section className="panel stack" aria-labelledby="meet-title">
      <h2 id="meet-title">Meet your fish</h2>
      <div className="meet">
        <FishSprite
          body={body}
          mood="happy"
          primary={colours.primary}
          secondary={colours.secondary}
          scale={4}
          label={`${draft.symbol} fish`}
        />
        <p>
          <strong>{draft.symbol}</strong>
          {draft.name && <span className="muted"> · {draft.name}</span>}
          <br />
          <span className="muted">
            Family: {familyLabel(sector)}
            {chosenSector
              ? ` (${SOURCE_LABEL.user})`
              : draft.sectorSource && ` (${SOURCE_LABEL[draft.sectorSource]})`}
          </span>
        </p>
      </div>
      {choosingFamily ? (
        <div className="stack">
          <h3>{known ? 'Pick its family' : `Which family is ${draft.symbol}?`}</h3>
          {!known && (
            <p className="muted">
              {draft.symbol} isn't in the built-in list, so pick the closest family. It sets the
              fish's shape; funds and anything unsure can stay Consumer.
            </p>
          )}
          <FamilyPicker sector={sector} colours={colours} onChange={setChosenSector} />
        </div>
      ) : (
        <div className="actions">
          <button type="button" className="button" onClick={() => setChoosingFamily(true)}>
            Change family
          </button>
        </div>
      )}
      {draft.notice && <p className="message is-warning">{draft.notice}</p>}
      <div className="actions">
        <button type="button" className="button is-primary" onClick={save} autoFocus>
          Add this fish
        </button>
        <button type="button" className="button" onClick={onBack}>
          Back
        </button>
      </div>
      <h3>Or pick its colours</h3>
      <ColourPicker value={colours} onChange={setColours} />
      {error && (
        <p className="message is-warning" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
