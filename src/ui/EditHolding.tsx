import { useState } from 'react';
import type { Holding, Pen, SymbolProfile } from '../data/model';
import { SOURCE_LABEL, resolveSector } from '../data/sectors';
import { isValidCostBasis, isValidQuantity } from '../data/model';
import { repo, usePens, useProfiles } from '../data/store';
import { type FishColours, defaultColours, fishColours } from '../theme';
import { bodyForSector, familyLabel } from '../theme/bodies';
import { ColourPicker } from './ColourPicker';
import { FamilyPicker } from './FamilyPicker';
import { FishSprite } from './FishSprite';
import { NEW_PEN, PenField } from './PenField';
import { parseNumberInput } from './files';

interface Props {
  holding: Holding;
  /** Which part to show first. */
  focus: 'details' | 'colours';
  onDone: () => void;
}

export function EditHolding({ holding, focus, onDone }: Props) {
  const pens = usePens();
  const profiles = useProfiles();
  if (!pens || !profiles) return null;

  return focus === 'colours' ? (
    <EditLook holding={holding} profile={profiles.get(holding.symbol)} onDone={onDone} />
  ) : (
    <EditDetails holding={holding} pens={pens} onDone={onDone} />
  );
}

/** Colours (this fish) and family (every fish of this symbol). */
function EditLook({
  holding,
  profile,
  onDone,
}: {
  holding: Holding;
  profile: SymbolProfile | undefined;
  onDone: () => void;
}) {
  const defaults = defaultColours(holding.symbol);
  const [colours, setColours] = useState<FishColours>(fishColours(holding));
  // undefined = automatic (provider or built-in list); a string = the user's choice.
  const [userSector, setUserSector] = useState(profile?.userSector);
  const automatic = resolveSector(holding.symbol, {
    ...profile,
    symbol: holding.symbol,
    userSector: undefined,
  });
  const sector = userSector ?? automatic.sector;
  const source = userSector ? 'user' : automatic.source;

  async function save() {
    await repo.updateHolding(holding.id, {
      primary: colours.primary === defaults.primary ? undefined : colours.primary,
      secondary: colours.secondary === defaults.secondary ? undefined : colours.secondary,
    });
    if (userSector !== profile?.userSector) await repo.setUserSector(holding.symbol, userSector);
    onDone();
  }

  return (
    <section className="panel stack" aria-labelledby="look-title">
      <h2 id="look-title">Change colours: {holding.symbol}</h2>
      <div className="meet">
        <FishSprite
          body={bodyForSector(sector)}
          mood="happy"
          primary={colours.primary}
          secondary={colours.secondary}
          scale={4}
          label={`${holding.symbol} fish`}
        />
      </div>
      <ColourPicker value={colours} onChange={setColours} />
      <div className="actions">
        <button type="button" className="button" onClick={() => setColours(defaults)}>
          Default colours
        </button>
      </div>
      <h3>Family</h3>
      <p className="muted">
        {familyLabel(sector)}
        {source && ` (${SOURCE_LABEL[source]})`}. Changing it reshapes every {holding.symbol} fish.
      </p>
      <FamilyPicker sector={sector} colours={colours} onChange={setUserSector} />
      {userSector && automatic.sector && (
        <div className="actions">
          <button type="button" className="button" onClick={() => setUserSector(undefined)}>
            Use {familyLabel(automatic.sector)} ({SOURCE_LABEL[automatic.source ?? 'builtin']})
          </button>
        </div>
      )}
      <div className="actions">
        <button type="button" className="button is-primary" onClick={save}>
          Save
        </button>
        <button type="button" className="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </section>
  );
}

function EditDetails({
  holding,
  pens,
  onDone,
}: {
  holding: Holding;
  pens: Pen[];
  onDone: () => void;
}) {
  const [quantity, setQuantity] = useState(String(holding.quantity));
  const [costBasis, setCostBasis] = useState(
    holding.costBasis === undefined ? '' : String(holding.costBasis),
  );
  const [penId, setPenId] = useState(holding.penId);
  const [newPenName, setNewPenName] = useState('');
  const [error, setError] = useState<string>();
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const q = parseNumberInput(quantity);
    const c = parseNumberInput(costBasis);
    if (q === undefined || !isValidQuantity(q)) return setError('Quantity must be more than 0.');
    if (!isValidCostBasis(c)) return setError('Cost per share must be a number, 0 or more.');
    if (penId === NEW_PEN && !newPenName.trim()) return setError('Name the new pen.');
    const pen = penId === NEW_PEN ? await repo.findOrCreatePen(newPenName) : { id: penId };
    await repo.updateHolding(holding.id, { quantity: q, costBasis: c, penId: pen.id });
    onDone();
  }

  async function remove() {
    await repo.deleteHolding(holding.id);
    onDone();
  }

  return (
    <form className="panel stack" onSubmit={save} noValidate>
      <h2>Edit {holding.symbol}</h2>
      <div className="field">
        <label htmlFor="quantity">Quantity</label>
        <input
          id="quantity"
          inputMode="decimal"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
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
        onChange={setPenId}
        onNewNameChange={setNewPenName}
      />
      {error && (
        <p className="message is-warning" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit" className="button is-primary">
          Save
        </button>
        <button type="button" className="button" onClick={onDone}>
          Cancel
        </button>
      </div>
      <div className="actions">
        {confirmingRemove ? (
          <>
            <span>Remove {holding.symbol} from your tank?</span>
            <button type="button" className="button" onClick={remove}>
              Yes, remove
            </button>
            <button type="button" className="button" onClick={() => setConfirmingRemove(false)}>
              Keep it
            </button>
          </>
        ) : (
          <button type="button" className="button" onClick={() => setConfirmingRemove(true)}>
            Remove holding…
          </button>
        )}
      </div>
    </form>
  );
}
