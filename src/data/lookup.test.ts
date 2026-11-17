import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { StockFishDb } from './db';
import { lookUpSymbol } from './lookup';
import { MOCK_UNKNOWN, createMockProvider } from './providers/mock';
import { type MarketDataProvider, ProviderError } from './providers/types';
import { createRepo, type Repo } from './repo';

let repo: Repo;

beforeEach(() => {
  repo = createRepo(new StockFishDb(`test-${crypto.randomUUID()}`));
});

/** Wrap a provider to record calls; `profile` replaces getProfile. */
function counting(provider: MarketDataProvider, profile = provider.getProfile) {
  const calls: string[] = [];
  const wrapped: MarketDataProvider = {
    id: provider.id,
    getQuote: (s) => (calls.push(`quote:${s}`), provider.getQuote(s)),
    getDailyHistory: (s, d) => provider.getDailyHistory(s, d),
    getProfile: (s) => (calls.push(`profile:${s}`), profile!(s)),
  };
  return { wrapped, calls };
}

const planError = async () => {
  throw new ProviderError('plan', 'upgrade');
};

describe('lookUpSymbol', () => {
  it('uses the built-in table without asking for a profile', async () => {
    const { wrapped, calls } = counting(createMockProvider());
    expect(await lookUpSymbol(wrapped, repo, 'jnj')).toMatchObject({
      status: 'found',
      sector: 'Health Care',
      source: 'builtin',
      name: 'Johnson & Johnson',
    });
    expect(calls).toEqual(['quote:JNJ']);
  });

  it('asks the provider for symbols the table lacks, once', async () => {
    const { wrapped, calls } = counting(createMockProvider(), async () => ({
      sector: 'Technology',
    }));
    expect(await lookUpSymbol(wrapped, repo, 'ZZZZ')).toMatchObject({
      sector: 'Technology',
      source: 'provider',
    });
    await lookUpSymbol(wrapped, repo, 'ZZZZ');
    expect(calls).toEqual(['quote:ZZZZ', 'profile:ZZZZ', 'quote:ZZZZ']);
  });

  it('stops asking for profiles after a plan refusal, until the key changes', async () => {
    await repo.saveSettings({ provider: 'mock', apiKeys: { mock: 'a' } });
    const { wrapped, calls } = counting(createMockProvider(), planError);
    expect(await lookUpSymbol(wrapped, repo, 'ZZZ1')).toEqual({
      status: 'found',
      sector: undefined,
      source: undefined,
      name: undefined,
    });
    await lookUpSymbol(wrapped, repo, 'ZZZ2');
    expect(calls.filter((c) => c.startsWith('profile'))).toEqual(['profile:ZZZ1']);

    await repo.saveSettings({ apiKeys: { mock: 'b' } });
    await lookUpSymbol(wrapped, repo, 'ZZZ3');
    expect(calls.filter((c) => c.startsWith('profile'))).toHaveLength(2);
  });

  it("the user's choice wins over every source", async () => {
    await repo.setUserSector('JNJ', 'Energy');
    expect(await lookUpSymbol(createMockProvider(), repo, 'JNJ')).toMatchObject({
      sector: 'Energy',
      source: 'user',
    });
  });

  it('reports unknown symbols', async () => {
    const result = await lookUpSymbol(createMockProvider(), repo, MOCK_UNKNOWN);
    expect(result.status).toBe('not-found');
  });

  it('is unchecked without a provider, but still knows built-in sectors', async () => {
    expect(await lookUpSymbol(undefined, repo, 'INTC')).toMatchObject({
      status: 'unchecked',
      sector: 'Information Technology',
    });
  });

  it('is unchecked when the provider fails for other reasons', async () => {
    const failing: MarketDataProvider = {
      ...createMockProvider(),
      getQuote: async () => {
        throw new ProviderError('rate-limit', 'slow down');
      },
    };
    expect(await lookUpSymbol(failing, repo, 'AAPL')).toMatchObject({ status: 'unchecked' });
  });
});
