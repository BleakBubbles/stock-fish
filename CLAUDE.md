# Stock Fish

A web app (installable PWA) that shows a user's investments as pixel-art fish in a tank. Each
fish's face shows how that holding is doing today, so the tank replaces a stock price board at a
glance. Hobby project, open source (MIT), no backend in v1.

Read before working:

- `docs/SPEC.md`: product spec and every design decision so far.
- `art/STYLE.md`: sprite rules. Read it before touching anything visual.

## Stack

TypeScript (strict) + Vite, React for UI outside the tank, PixiJS for the tank, Dexie (IndexedDB)
for storage, Vitest for tests, Cloudflare Workers static assets for hosting (`wrangler.jsonc`). A Cloudflare Worker relay only if a
market data provider blocks browser requests (CORS).

## Firm rules

1. **Market data goes through a provider interface.** Nothing outside `src/data/providers/`
   calls a market data API directly.
   ```ts
   interface MarketDataProvider {
     id: string;
     getQuote(symbol: string): Promise<Quote>;            // price, previous close, timestamp
     getDailyHistory(symbol: string, days: number): Promise<DailyBar[]>;
     getProfile?(symbol: string): Promise<{ sector?: string; name?: string }>;
   }
   ```
   Adapters: `twelvedata` (default) and `mock` (fixture data for tests and offline development).
2. **Bring your own key.** Each user enters their own free API key. It is stored only in the
   browser and sent only to the provider (or the stateless relay, if one is needed). The app never
   operates a server that serves price data.
3. **Theme layer.** No colours, sprites or pixel sizes hard-coded in components. Everything visual
   comes from `art/` (palette, ramps, sprite atlas) through one theme module.
4. **Pixel integrity.** Render the tank at its native resolution into a low-res render texture,
   then upscale by a whole number with nearest-neighbour filtering. The scale is chosen so a
   320 × 180 tank fits, then raised (zoomed in) while every fish keeps enough water, and the native
   size grows in whole art pixels to fill the space (`tankZoom` in `src/tank/arrange.ts`). Never
   scale fish apart from the rest of the tank. Fish labels (text and mood badges) grow with the
   fish but are never smaller than the app's text: each label pixel is a whole number of art pixels, at
   least one UI pixel. Labels are drawn with their fish, so a fish in front covers the fish behind
   and its labels. Round sprite positions
   to whole art pixels. Never rotate or fractionally scale sprites (mirroring is fine). Scales are
   whole numbers of *device* pixels (`src/ui/pixel/scale.ts`). The UI pixel is the tank pixel ×
   the smallest whole number that keeps capitals at least 9 CSS px tall (1 on laptops, 2 on
   phones). UI text is drawn with `PixelText` from the bitmap font in `art/fonts/`, never with
   browser text rendering: browsers blur TrueType pixel fonts at every size. Pixel UI lives inside
   `PixelRoot` (`src/ui/pixel/PixelRoot.tsx`), where 1 CSS px is 1 UI pixel and one transform
   scales everything onto whole device pixels at any screen or zoom. Inside it, every size is a
   whole number of UI pixels (`--sf-px`: no rem, %, or centring without `useSnap`), and lines are
   box-shadows, never `border` or `outline` (Chrome rounds those before the transform). Check
   with `?pixels` in the URL.
5. **Mood is shown by faces; colour may only repeat it.** The fish's face shows it; the optional
   mood badge above a fish repeats the same face, tinted by mood (`palette.json` `moodBadge`). The
   face must read on its own, and a fish's colour never changes with mood.
6. **The mood engine is pure and tested.** Volatility and tier logic are plain functions with unit
   tests, independent of React and PixiJS.
7. **Never execute trades or give advice.** Read-only display; include a "not investment advice"
   note in settings.

## Sprite pipeline

Sprites are text grids in `art/sprites/` (see `art/STYLE.md`). `art/tools/grid2png.py` is the
reference renderer. Port it to a Node build script (`scripts/build-sprites.ts`) that produces a
sprite atlas and frame map at build time, so the app build does not depend on Python. Either bake
one atlas per ramp, or bake role masks and recolour at load time. Both are fine as long as colours
come from `art/palette.json`.

Mapping rules:

- **Sector → body** (the bodies are sharks, `art/STYLE.md`): IT and Communication Services → 1,
  the hammerhead; Financials and Real Estate → 2, the great white; Consumer Discretionary and
  Staples → 3, the nurse shark; Energy and Utilities → 4, the thresher; Industrials and Materials
  → 5, the sawshark; Health Care → 6, the angel shark; funds (ETFs and mutual funds) → 7, the
  whale shark; crypto → 8, the mako
  (any crypto pair such as `BTC/USD`). Unknown sectors and currency pairs → body 3.
- **Sector source,** best first: the user's family choice, the provider's company profile, then
  the built-in table `src/data/sectors.json` (S&P 500 GICS sectors plus common funds; regenerate
  with `scripts/update-sectors.ts`). Twelve Data's free plan has no profiles, so the table does
  most of the work. A symbol none of these know gets a "which family?" picker in the "meet your
  fish" step; the family can be changed later and is saved in backups.
- **Fish colours:** each holding stores optional `primary` (body, `B`) and `secondary` (fins, `F`)
  colours, each one of the 32 palette colours. If unset, use the default: the ticker's entry in
  `palette.json` `brandPresets` if there is one, else a stable hash (e.g. FNV-1a) of the
  upper-cased symbol modulo the number of ramps in `rampOrder`. Community or shared views always
  use the default, never a user's choice. A `tertiary` (pattern) colour comes later.
- **Colour choice is part of the core flow,** not a buried setting. The last step of adding a
  holding shows the new fish with colours pre-filled: one tap to accept, or pick from the
  32-colour palette right there. Tapping any fish also offers "change colours". Any palette colour
  is allowed for either slot, with no warnings.
- **Mood tier** (today's return ÷ typical daily volatility, σ = standard deviation of the last 60
  daily returns): above +2 ecstatic, +0.5 to +2 happy, −0.5 to +0.5 neutral, −2 to −0.5 uneasy,
  below −2 sad. Fewer than 20 days of history → neutral.

## Milestones

Build and verify in this order; each milestone should work on its own.

1. **Scaffold:** Vite + React + TypeScript + PixiJS + Dexie + Vitest, PWA manifest, lint, CI.
2. **Data:** holdings model (ticker, quantity, cost basis optional, pen, optional primary and
   secondary colours), manual entry ending in the "meet your fish" colour step, CSV import
   (simple template: `symbol,quantity,pen`), JSON export/import, provider interface with
   `twelvedata` and `mock` adapters, API key settings screen with a "test key" button. Test one real
   browser request early to settle the CORS question.
3. **Mood engine:** volatility, tiers, portfolio weather. Unit tests.
4. **Tank renderer:** pixel pipeline, sprite atlas, fish swimming within the tank, tap a fish for
   ticker, % change and $ change. Market-closed state: dim the tank (sleeping face not drawn yet).
5. **Pens and territory:** custom pens, drag-and-drop, split holdings across pens, territory sized
   by weight (order-preserving treemap, minimum patch size), multi-pen overview with arrangement
   modes (mood, species, family, weight, pen, free roam; correlation later).
6. **Polish:** installable PWA, empty state and onboarding, accessibility (fish details reachable by
   keyboard and screen reader with the numbers).

All six are done (November 2026). Next work comes from the spec's later phases and its open
questions.

## Placeholders until decided

- Selling a holding: the fish is released (agreed design in the spec, "Care and the daily visit"; not built yet: for now it swims away).
- Default arrangement mode: mood.
- Market data refresh: every 15 minutes during market hours.
