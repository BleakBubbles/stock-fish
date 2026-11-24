import { type FormEvent, useState } from 'react';
import { lookUpSymbol } from '../data/lookup';
import { isValidCostBasis, isValidQuantity, isValidSymbol, normalizeSymbol } from '../data/model';
import { providerFromSettings } from '../data/providers';
import { type SectorSource, SOURCE_LABEL } from '../data/sectors';
import { repo, usePens, useSettings } from '../data/store';
import { type FishColours, defaultColours } from '../theme';
import { bodyForSector, familyLabel } from '../theme/bodies';
import { ColourPicker } from './ColourPicker';
import { FamilyPicker } from './FamilyPicker';
import { FishSprite } from './FishSprite';
import { NEW_PEN, PenField } from './PenField';
import { parseNumberInput } from './files';
import { PixelButton } from './pixel/PixelButton';
import { PixelInput } from './pixel/PixelInput';
import { PixelText } from './pixel/PixelText';
import { PixelField, PixelHeading, PixelParagraph } from './pixel/blocks';

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

/** Add a holding: details, then "meet your shark" with colours pre-filled. */
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

  async function submit(e: FormEvent) {
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
    <form className="px-stack px-page-stack" onSubmit={(e) => void submit(e)} noValidate>
      <PixelHeading text="Add a holding" />
      <div className="px-panel px-stack px-wide">
        <PixelField label="Symbol">
          <PixelInput
            label="Symbol"
            value={symbol}
            onChange={setSymbol}
            autoCapitalize="characters"
            placeholder="AAPL"
            maxLength={20}
            autoFocus
          />
        </PixelField>
        <PixelField label="Quantity">
          <PixelInput
            label="Quantity"
            inputMode="decimal"
            value={quantity}
            onChange={setQuantity}
          />
        </PixelField>
        <PixelField label="Average cost per share" hint="optional">
          <PixelInput
            label="Average cost per share (optional)"
            inputMode="decimal"
            value={costBasis}
            onChange={setCostBasis}
          />
        </PixelField>
        <PenField
          pens={pens}
          value={penId}
          newName={newPenName}
          onChange={setPenChoice}
          onNewNameChange={setNewPenName}
        />
        {error && <PixelParagraph text={error} tone="warning" role="alert" />}
        <div className="px-row">
          <PixelButton
            type="submit"
            label={busy ? 'Checking…' : 'Next'}
            icon="forward"
            primary
            disabled={busy}
          />
          <PixelButton label="Cancel" onClick={onCancel} />
        </div>
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
  const source = chosenSector
    ? SOURCE_LABEL.user
    : draft.sectorSource && SOURCE_LABEL[draft.sectorSource];

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
    <section className="px-stack px-page-stack" aria-labelledby="meet-title">
      <PixelHeading text="Meet your shark" id="meet-title" />
      <div className="px-panel px-stack px-wide">
        <div className="meet">
          <FishSprite
            body={body}
            mood="happy"
            primary={colours.primary}
            secondary={colours.secondary}
            scale={3}
            label={`${draft.symbol} shark`}
          />
          <div className="px-stack meet-text">
            <PixelText text={draft.symbol} />
            {draft.name && <PixelParagraph text={draft.name} tone="textMuted" />}
            <PixelParagraph
              text={`Family: ${familyLabel(sector)}${source ? ` (${source})` : ''}`}
              tone="textMuted"
            />
          </div>
        </div>
        {draft.notice && <PixelParagraph text={draft.notice} tone="warning" />}
        <div className="px-row">
          <PixelButton
            label="Add this shark"
            icon="check"
            primary
            onClick={() => void save()}
            autoFocus
          />
          <PixelButton label="Back" icon="back" onClick={onBack} />
        </div>
        {error && <PixelParagraph text={error} tone="warning" role="alert" />}
      </div>

      <div className="px-panel px-stack px-wide">
        <PixelHeading text="Colours" level={3} />
        <ColourPicker value={colours} onChange={setColours} />
      </div>

      <div className="px-panel px-stack px-wide">
        <PixelHeading text="Family" level={3} />
        {choosingFamily ? (
          <>
            {!known && (
              <PixelParagraph
                text={`${draft.symbol} isn't in the built-in list. Pick the closest family: it sets the shark's species. Funds and unsure ones can stay Consumer.`}
                tone="textMuted"
              />
            )}
            <FamilyPicker sector={sector} colours={colours} onChange={setChosenSector} />
          </>
        ) : (
          <div className="px-row">
            <PixelButton label="Change family" onClick={() => setChoosingFamily(true)} />
          </div>
        )}
      </div>
    </section>
  );
}
