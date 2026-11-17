import { useRef, useState } from 'react';
import { CSV_TEMPLATE, type CsvError, parseHoldingsCsv } from '../data/csv';
import { repo, useHoldings, usePens, useProfiles } from '../data/store';
import { fishColours } from '../theme';
import { resolveSector } from '../data/sectors';
import { bodyForSector } from '../theme/bodies';
import { FishSprite } from './FishSprite';
import { downloadText } from './files';

interface Props {
  onAdd: () => void;
  onEdit: (id: string) => void;
  onColours: (id: string) => void;
}

interface ImportReport {
  added: number;
  updated: number;
  errors: CsvError[];
}

export function HoldingsScreen({ onAdd, onEdit, onColours }: Props) {
  const holdings = useHoldings();
  const pens = usePens();
  const profiles = useProfiles();
  const fileRef = useRef<HTMLInputElement>(null);
  const [report, setReport] = useState<ImportReport>();

  if (!holdings || !pens || !profiles) return null;

  async function importCsv(file: File) {
    const { rows, errors } = parseHoldingsCsv(await file.text());
    let added = 0;
    let updated = 0;
    for (const row of rows) {
      const pen = await repo.findOrCreatePen(row.pen);
      const result = await repo.upsertHolding(row.symbol, row.quantity, pen.id);
      if (result === 'added') added++;
      else updated++;
    }
    setReport({ added, updated, errors });
  }

  return (
    <section className="stack" aria-labelledby="holdings-title">
      <div className="panel stack">
        <h2 id="holdings-title">Holdings</h2>
        <div className="actions">
          <button type="button" className="button is-primary" onClick={onAdd}>
            Add a holding
          </button>
          <button type="button" className="button" onClick={() => fileRef.current?.click()}>
            Import CSV…
          </button>
          <button
            type="button"
            className="button"
            onClick={() => downloadText('stock-fish-template.csv', CSV_TEMPLATE, 'text/csv')}
          >
            Download CSV template
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void importCsv(file);
            }}
          />
        </div>
        <p className="muted">
          CSV columns: <code>symbol,quantity,pen</code>. Re-importing replaces the quantity of a
          symbol already in that pen. Imported fish get default colours; change them below.
        </p>
        {report && (
          <div role="status" className="stack">
            <p className={`message ${report.errors.length ? 'is-warning' : 'is-success'}`}>
              Imported {report.added} new, updated {report.updated}
              {report.errors.length ? `, skipped ${report.errors.length}` : ''}.
            </p>
            {report.errors.length > 0 && (
              <ul className="message is-warning">
                {report.errors.map((e) => (
                  <li key={e.line}>
                    Line {e.line}: {e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {holdings.length === 0 ? (
        <p className="panel">No fish yet. Add a holding or import a CSV.</p>
      ) : (
        pens.map((pen) => {
          const inPen = holdings.filter((h) => h.penId === pen.id);
          if (inPen.length === 0) return null;
          return (
            <div key={pen.id} className="panel stack">
              <h3>{pen.name}</h3>
              <ul className="holding-list">
                {inPen.map((h) => {
                  const { primary, secondary } = fishColours(h);
                  const profile = profiles.get(h.symbol);
                  return (
                    <li key={h.id} className="holding-row">
                      <FishSprite
                        body={bodyForSector(resolveSector(h.symbol, profile).sector)}
                        mood="neutral"
                        primary={primary}
                        secondary={secondary}
                        scale={2}
                      />
                      <div className="holding-text">
                        <strong>{h.symbol}</strong>
                        <span className="muted">
                          {h.quantity.toLocaleString()} {h.quantity === 1 ? 'share' : 'shares'}
                          {h.costBasis !== undefined &&
                            ` · cost ${h.costBasis.toLocaleString(undefined, { maximumFractionDigits: 4 })}`}
                        </span>
                      </div>
                      <div className="actions">
                        <button
                          type="button"
                          className="button"
                          onClick={() => onColours(h.id)}
                          aria-label={`Change colours of ${h.symbol}`}
                        >
                          Colours
                        </button>
                        <button
                          type="button"
                          className="button"
                          onClick={() => onEdit(h.id)}
                          aria-label={`Edit ${h.symbol}`}
                        >
                          Edit
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })
      )}
    </section>
  );
}
