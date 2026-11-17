import { type ProviderId, normalizeSymbol } from './model';
import { type MarketDataProvider, ProviderError, describeProviderError } from './providers';
import type { Repo } from './repo';
import { type ResolvedSector, builtinSector, resolveSector } from './sectors';

interface Known extends ResolvedSector {
  name?: string;
}

export type LookupResult =
  /** The provider knows the symbol. */
  | ({ status: 'found' } & Known)
  /** The provider says the symbol doesn't exist. */
  | { status: 'not-found'; message: string }
  /** No provider, or it couldn't answer; the holding can still be added. */
  | ({ status: 'unchecked'; message: string } & Known);

/**
 * Check a symbol before adding a holding and work out its sector (which picks
 * the fish body). Costs one request for the quote, plus one for the provider's
 * company profile only when nothing else knows the sector and the plan allows
 * profiles. What it learns is cached per symbol.
 */
export async function lookUpSymbol(
  provider: MarketDataProvider | undefined,
  repo: Repo,
  rawSymbol: string,
): Promise<LookupResult> {
  const symbol = normalizeSymbol(rawSymbol);
  const cached = await repo.getProfile(symbol);
  const known = (): Known => ({ ...resolveSector(symbol, cached), name: cached?.name });

  if (!provider) {
    return {
      status: 'unchecked',
      message: 'No market data key is set, so this symbol was not checked.',
      ...known(),
    };
  }

  let name: string | undefined;
  try {
    name = (await provider.getQuote(symbol)).name;
  } catch (e) {
    if (e instanceof ProviderError && e.kind === 'not-found') {
      return { status: 'not-found', message: `${symbol}: ${describeProviderError(e)}` };
    }
    return {
      status: 'unchecked',
      message: `Couldn't check ${symbol}. ${describeProviderError(e)}`,
      ...known(),
    };
  }
  if (name && name !== cached?.name) await repo.saveProfile({ symbol, name });

  const settings = await repo.getSettings();
  const providerId = provider.id as ProviderId;
  const skipProfile =
    !provider.getProfile ||
    cached?.fetchedAt !== undefined ||
    cached?.userSector !== undefined ||
    builtinSector(symbol) !== undefined ||
    settings.profileUnavailable?.[providerId] === true;

  if (!skipProfile && provider.getProfile) {
    try {
      const profile = await provider.getProfile(symbol);
      await repo.saveProfile({ symbol, ...profile, fetchedAt: Date.now() });
    } catch (e) {
      if (e instanceof ProviderError && e.kind === 'plan') {
        // Profiles need a paid plan: stop asking until the key changes.
        await repo.saveSettings({
          profileUnavailable: { ...settings.profileUnavailable, [providerId]: true },
        });
      }
      // Other errors may be temporary; try again next time.
    }
  }

  const profile = await repo.getProfile(symbol);
  return { status: 'found', ...resolveSector(symbol, profile), name: profile?.name ?? name };
}
