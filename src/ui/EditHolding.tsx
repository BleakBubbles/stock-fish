import { type FormEvent, useState } from 'react';
import type { Holding, Pen, SymbolProfile } from '../data/model';
import { isValidCostBasis, isValidQuantity } from '../data/model';
import { SOURCE_LABEL, resolveSector } from '../data/sectors';
import { repo, usePens, useProfiles } from '../data/store';
import { type FishColours, defaultColours, fishColours } from '../theme';
import { bodyForSector, familyLabel } from '../theme/bodies';
import { ColourPicker } from './ColourPicker';
import { FamilyPicker } from './FamilyPicker';
import { FishSprite } from './FishSprite';
import { NEW_PEN, PenField } from './PenField';
import { parseNumberInput } from './files';
import { PixelButton } from './pixel/PixelButton';
import { PixelInput } from './pixel/PixelInput';
import { PixelField, PixelHeading, PixelParagraph } from './pixel/blocks';

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
    <section className="px-stack px-page-stack" aria-labelledby="look-title">
      <PixelHeading text={`${holding.symbol} colours`} id="look-title" />
      <div className="px-panel px-stack px-wide">
        <div className="meet">
          <FishSprite
            body={bodyForSector(sector)}
            mood="happy"
            primary={colours.primary}
            secondary={colours.secondary}
            scale={3}
            label={`${holding.symbol} shark`}
          />
        </div>
        <div className="px-row">
          <PixelButton label="Save" icon="check" primary onClick={() => void save()} />
          <PixelButton label="Cancel" onClick={onDone} />
        </div>
      </div>

      <div className="px-panel px-stack px-wide">
        <PixelHeading text="Colours" level={3} />
        <ColourPicker value={colours} onChange={setColours} />
        <div className="px-row">
          <PixelButton label="Default colours" onClick={() => setColours(defaults)} />
        </div>
      </div>

      <div className="px-panel px-stack px-wide">
        <PixelHeading text="Family" level={3} />
        <PixelParagraph
          text={`${familyLabel(sector)}${source ? ` (${SOURCE_LABEL[source]})` : ''}. Changing it changes the species of every ${holding.symbol} shark.`}
          tone="textMuted"
        />
        <FamilyPicker sector={sector} colours={colours} onChange={setUserSector} />
        {userSector && automatic.sector && (
          <div className="px-row">
            <PixelButton
              label={`Use ${familyLabel(automatic.sector)} (${SOURCE_LABEL[automatic.source ?? 'builtin']})`}
              onClick={() => setUserSector(undefined)}
            />
          </div>
        )}
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

  async function save(e: FormEvent) {
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
    <form className="px-stack px-page-stack" onSubmit={(e) => void save(e)} noValidate>
      <PixelHeading text={`Edit ${holding.symbol}`} />
      <div className="px-panel px-stack px-wide">
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
          onChange={setPenId}
          onNewNameChange={setNewPenName}
        />
        {error && <PixelParagraph text={error} tone="warning" role="alert" />}
        <div className="px-row">
          <PixelButton type="submit" label="Save" icon="check" primary />
          <PixelButton label="Cancel" onClick={onDone} />
        </div>
      </div>

      <div className="px-panel px-stack px-wide">
        {confirmingRemove ? (
          <>
            <PixelParagraph text={`Remove ${holding.symbol} from your tank?`} tone="warning" />
            <div className="px-row">
              <PixelButton label="Yes, remove" icon="delete" onClick={() => void remove()} />
              <PixelButton label="Keep it" onClick={() => setConfirmingRemove(false)} />
            </div>
          </>
        ) : (
          <div className="px-row">
            <PixelButton
              label="Remove holding…"
              icon="delete"
              onClick={() => setConfirmingRemove(true)}
            />
          </div>
        )}
      </div>
    </form>
  );
}
