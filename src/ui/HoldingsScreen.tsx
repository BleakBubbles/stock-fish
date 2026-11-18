import { useState } from 'react';
import { CSV_TEMPLATE } from '../data/csv';
import { type ImportReport, SAMPLE_TANK_CSV, importHoldingsCsv } from '../data/importCsv';
import { resolveSector } from '../data/sectors';
import { repo, useHoldings, usePens, useProfiles } from '../data/store';
import { fishColours } from '../theme';
import { bodyForSector } from '../theme/bodies';
import { FishSprite } from './FishSprite';
import { downloadText } from './files';
import { PixelButton } from './pixel/PixelButton';
import { PixelText } from './pixel/PixelText';
import { PixelFileButton, PixelHeading, PixelParagraph } from './pixel/blocks';

interface Props {
  onAdd: () => void;
  onEdit: (id: string) => void;
  onColours: (id: string) => void;
}

const formatCost = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 });

export function HoldingsScreen({ onAdd, onEdit, onColours }: Props) {
  const holdings = useHoldings();
  const pens = usePens();
  const profiles = useProfiles();
  const [report, setReport] = useState<ImportReport>();

  if (!holdings || !pens || !profiles) return null;

  const importText = async (text: string) => setReport(await importHoldingsCsv(repo, text));

  return (
    <section className="px-stack px-page-stack" aria-labelledby="holdings-title">
      <PixelHeading text="Holdings" id="holdings-title" />

      <div className="px-panel px-stack px-wide">
        <div className="px-row">
          <PixelButton label="Add a holding" icon="plus" primary onClick={onAdd} />
          <PixelFileButton
            label="Import CSV…"
            icon="import"
            accept=".csv,text/csv"
            onFile={(f) => void f.text().then(importText)}
          />
          <PixelButton
            label="CSV template"
            icon="export"
            onClick={() => downloadText('stock-fish-template.csv', CSV_TEMPLATE, 'text/csv')}
          />
          <PixelButton label="Load sample tank" onClick={() => void importText(SAMPLE_TANK_CSV)} />
        </div>
        <PixelParagraph
          text="CSV columns: symbol, quantity, pen. Importing again updates quantities instead of adding fish twice."
          tone="textMuted"
        />
        <PixelParagraph
          text="The sample is made-up fish in three Sample pens, for trying things out."
          tone="textMuted"
        />
        {report && (
          <div role="status" className="px-stack px-wide">
            <PixelParagraph
              text={`Added ${report.added}, updated ${report.updated}${report.errors.length ? `, skipped ${report.errors.length}` : ''}.`}
              tone={report.errors.length ? 'warning' : 'success'}
            />
            {report.errors.map((e) => (
              <PixelParagraph key={e.line} text={`Line ${e.line}: ${e.message}`} tone="warning" />
            ))}
          </div>
        )}
      </div>

      {holdings.length === 0 ? (
        <div className="px-panel px-stack px-wide">
          <PixelParagraph text="No fish yet. Add a holding, import a CSV or load the sample." />
        </div>
      ) : (
        pens.map((pen) => {
          const inPen = holdings.filter((h) => h.penId === pen.id);
          if (inPen.length === 0) return null;
          return (
            <section key={pen.id} className="px-panel px-stack px-wide" aria-label={pen.name}>
              <PixelHeading text={pen.name} level={3} />
              <ul className="holding-list">
                {inPen.map((h) => {
                  const { primary, secondary } = fishColours(h);
                  const profile = profiles.get(h.symbol);
                  const shares = `${h.quantity.toLocaleString()} ${h.quantity === 1 ? 'share' : 'shares'}`;
                  return (
                    <li key={h.id} className="holding-row">
                      <FishSprite
                        body={bodyForSector(resolveSector(h.symbol, profile).sector)}
                        mood="neutral"
                        primary={primary}
                        secondary={secondary}
                        scale={1}
                      />
                      <div className="holding-text">
                        <PixelText text={h.symbol} />
                        <PixelText
                          text={
                            h.costBasis === undefined
                              ? shares
                              : `${shares} · cost ${formatCost(h.costBasis)}`
                          }
                          tone="textMuted"
                        />
                      </div>
                      <div className="px-row">
                        <PixelButton
                          label={`Change colours of ${h.symbol}`}
                          icon="colours"
                          iconOnly
                          onClick={() => onColours(h.id)}
                        />
                        <PixelButton
                          label={`Edit ${h.symbol}`}
                          icon="edit"
                          iconOnly
                          onClick={() => onEdit(h.id)}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </section>
  );
}
