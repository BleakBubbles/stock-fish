import type { ProviderId, Settings } from '../model';
import { createMockProvider } from './mock';
import { createTwelveDataProvider } from './twelvedata';
import { type MarketDataProvider, ProviderError } from './types';

export * from './types';

export const PROVIDERS: readonly { id: ProviderId; name: string; needsKey: boolean }[] = [
  { id: 'twelvedata', name: 'Twelve Data', needsKey: true },
  { id: 'mock', name: 'Demo data (offline, made up)', needsKey: false },
];

/** The provider the settings select, or undefined if it needs a key that isn't set. */
export function providerFromSettings(settings: Settings): MarketDataProvider | undefined {
  switch (settings.provider) {
    case 'mock':
      return createMockProvider();
    case 'twelvedata': {
      const apiKey = settings.apiKeys.twelvedata?.trim();
      return apiKey ? createTwelveDataProvider({ apiKey }) : undefined;
    }
  }
}

export type KeyTestResult = { ok: true; detail: string } | { ok: false; detail: string };

/** One cheap request (one credit) to check a key works from this browser. */
export async function testProvider(provider: MarketDataProvider): Promise<KeyTestResult> {
  try {
    const q = await provider.getQuote('AAPL');
    return { ok: true, detail: `Works. AAPL is ${q.price.toFixed(2)}.` };
  } catch (e) {
    return { ok: false, detail: describeProviderError(e) };
  }
}

export function describeProviderError(e: unknown): string {
  if (!(e instanceof ProviderError)) return `Something went wrong: ${String(e)}`;
  switch (e.kind) {
    case 'auth':
      return 'The provider rejected this key. Check it was copied in full.';
    case 'rate-limit':
      return 'Too many requests for now. Free keys allow 8 a minute; try again shortly.';
    case 'plan':
      return 'This needs a paid plan with the provider.';
    case 'not-found':
      return "The provider doesn't recognise that symbol.";
    case 'network':
      return 'Could not reach the provider. Are you online?';
    case 'unknown':
      return `Provider error: ${e.message}`;
  }
}
