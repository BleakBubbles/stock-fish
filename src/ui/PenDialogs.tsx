import { type FormEvent, useState } from 'react';
import { MAX_PEN_NAME, type Pen } from '../data/model';
import { repo } from '../data/store';
import { PixelButton } from './pixel/PixelButton';
import { PixelDialog } from './pixel/PixelDialog';
import { PixelInput } from './pixel/PixelInput';
import { PixelText } from './pixel/PixelText';

/** Text width of name and number fields, in UI pixels. */
const FIELD_WIDTH = 120;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Name a new pen, or rename or delete an existing one. */
export function PenDialog({
  pen,
  pens,
  fishCount,
  onDone,
}: {
  /** Undefined for a new pen. */
  pen?: Pen;
  pens: readonly Pen[];
  /** Fish living in `pen`, for the delete warning. */
  fishCount: number;
  /** Called with the new pen's id (or undefined) when the dialog closes. */
  onDone: (newPenId?: string) => void;
}) {
  const [name, setName] = useState(pen?.name ?? '');
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const others = pens.filter((p) => p.id !== pen?.id);
  const heir = others[0];

  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (pen) {
        await repo.renamePen(pen.id, name);
        onDone();
      } else {
        onDone((await repo.createPen(name)).id);
      }
    } catch (err) {
      setError(message(err));
    }
  };

  const remove = async () => {
    if (!pen || !heir) return;
    try {
      await repo.deletePen(pen.id, heir.id);
      onDone();
    } catch (err) {
      setError(message(err));
    }
  };

  if (pen && confirmDelete && heir) {
    return (
      <PixelDialog title={`Delete ${pen.name}?`} onClose={() => setConfirmDelete(false)}>
        <PixelText
          text={
            fishCount > 0
              ? `Its ${fishCount === 1 ? 'shark moves' : `${fishCount} sharks move`} to ${heir.name}.`
              : 'It has no sharks.'
          }
          wrap={FIELD_WIDTH + 40}
        />
        {error && <PixelText text={error} tone="warning" wrap={FIELD_WIDTH + 40} />}
        <div className="px-row">
          <PixelButton label="Delete pen" icon="delete" primary onClick={() => void remove()} />
          <PixelButton label="Cancel" icon="close" onClick={() => setConfirmDelete(false)} />
        </div>
      </PixelDialog>
    );
  }

  return (
    <PixelDialog title={pen ? 'Edit pen' : 'New pen'} onClose={() => onDone()}>
      <form className="px-stack" onSubmit={(e) => void save(e)}>
        <PixelInput
          label="Pen name"
          value={name}
          onChange={(v) => {
            setName(v);
            setError(undefined);
          }}
          width={FIELD_WIDTH}
          maxLength={MAX_PEN_NAME}
          placeholder="e.g. TFSA"
          enterKeyHint="done"
        />
        {error && <PixelText text={error} tone="warning" wrap={FIELD_WIDTH + 40} />}
        <div className="px-row">
          <PixelButton
            type="submit"
            label={pen ? 'Save' : 'Add pen'}
            icon={pen ? 'check' : 'plus'}
            primary
          />
          <PixelButton label="Cancel" icon="close" onClick={() => onDone()} />
          {pen && heir && (
            <PixelButton label="Delete…" icon="delete" onClick={() => setConfirmDelete(true)} />
          )}
        </div>
      </form>
    </PixelDialog>
  );
}

/** Move a fish to another pen, or split part of the holding off into one. */
export function MoveDialog({
  holding,
  pens,
  onDone,
}: {
  holding: { id: string; symbol: string; quantity: number; penId: string };
  pens: readonly Pen[];
  /** Called with the moved fish's id after a move, or undefined if cancelled. */
  onDone: (movedId?: string) => void;
}) {
  const others = pens.filter((p) => p.id !== holding.penId);
  const [to, setTo] = useState(others[0]?.id);
  const [amount, setAmount] = useState(String(holding.quantity));
  const [error, setError] = useState<string>();

  const move = async (e: FormEvent) => {
    e.preventDefault();
    const quantity = Number(amount.replace(/,/g, ''));
    if (!to) return;
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > holding.quantity) {
      setError(`Enter an amount from 0 to ${holding.quantity.toLocaleString()}.`);
      return;
    }
    try {
      onDone(await repo.moveHolding(holding.id, to, quantity));
    } catch (err) {
      setError(message(err));
    }
  };

  if (!others.length) {
    return (
      <PixelDialog title={`Move ${holding.symbol}`} onClose={() => onDone()}>
        <PixelText text="Make another pen first (the + button)." wrap={FIELD_WIDTH + 40} />
        <PixelButton label="OK" onClick={() => onDone()} />
      </PixelDialog>
    );
  }

  return (
    <PixelDialog title={`Move ${holding.symbol}`} onClose={() => onDone()}>
      <form className="px-stack" onSubmit={(e) => void move(e)}>
        <PixelText text="To pen" tone="textMuted" />
        <div className="px-row" role="radiogroup" aria-label="To pen">
          {others.map((p) => (
            <PixelButton
              key={p.id}
              label={p.name}
              role="radio"
              aria-checked={p.id === to}
              active={p.id === to}
              onClick={() => setTo(p.id)}
            />
          ))}
        </div>
        <PixelText text={`How many (of ${holding.quantity.toLocaleString()})`} tone="textMuted" />
        <PixelInput
          label="How many to move"
          value={amount}
          onChange={(v) => {
            setAmount(v);
            setError(undefined);
          }}
          width={FIELD_WIDTH}
          inputMode="decimal"
          enterKeyHint="done"
        />
        {error && <PixelText text={error} tone="warning" wrap={FIELD_WIDTH + 40} />}
        <div className="px-row">
          <PixelButton type="submit" label="Move" icon="forward" primary />
          <PixelButton label="Cancel" icon="close" onClick={() => onDone()} />
        </div>
      </form>
    </PixelDialog>
  );
}
