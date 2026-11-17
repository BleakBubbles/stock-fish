import Dexie, { type EntityTable } from 'dexie';
import type { Holding, MarketEntry, Pen, SymbolProfile } from './model';

export interface SettingRow {
  key: string;
  value: unknown;
}

export class StockFishDb extends Dexie {
  pens!: EntityTable<Pen, 'id'>;
  holdings!: EntityTable<Holding, 'id'>;
  profiles!: EntityTable<SymbolProfile, 'symbol'>;
  settings!: EntityTable<SettingRow, 'key'>;
  market!: EntityTable<MarketEntry, 'symbol'>;

  constructor(name = 'stock-fish') {
    super(name);
    this.version(1).stores({
      pens: 'id, name',
      holdings: 'id, symbol, penId, [symbol+penId]',
      profiles: 'symbol',
      settings: 'key',
    });
    // v2: cached quotes and daily history per symbol.
    this.version(2).stores({ market: 'symbol' });
  }
}
