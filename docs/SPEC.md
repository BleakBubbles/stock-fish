# Stock Fish — Spec

Exported from the living design doc: https://claude.ai/artifact/NM3FRSjZvLxCKt4m8ep8Je
If the two disagree, the design doc wins; update this file when it changes.

## Overview

Stock Fish turns each investment into a pixel-art fish whose face shows how that holding is doing
today. It is a fun alternative to stock price boards and ticker lists: users read their day at a
glance, without parsing numbers.

- **Core loop:** open the app → see your fish's moods → tap a fish for the real numbers.
- **What it is not:** a broker, a trading tool, or a competitive game. It never executes trades.

## Mood model

Each fish's mood reflects that holding's move today, scaled to how much the asset normally moves.
A sad fish always means "unusual for this one," not just "red."

- **Volatility scaling:** mood = today's return ÷ the asset's typical daily volatility (standard
  deviation of the last 60 daily returns). A −2% day is nothing for a volatile stock but big for a
  bond ETF.
- **Five tiers with a wide neutral band:** most days most fish look calm, which is accurate.
- **Mood is shown by the face** (eye and mouth). A fish's colour never changes with mood. The
  optional mood badge above a fish (tank labels) repeats the face, tinted green up, silver flat
  and pink or red down; the tint only repeats what the face says.
- **Territory = portfolio weight:** each fish claims a patch of the tank sized by its share, so one
  sad fish owning half the tank reads as a bad day.
- **Portfolio weather:** a tank-level summary (sunny → stormy) of total daily change, also drawn in
  the water: light shafts on sunny and fair days (faint moonlight when the market is closed), nothing
  when calm, rain streaks and darker water when rainy, heavier slanting rain when stormy. No
  lightning or flashes. `?weather=stormy` (or any weather) in the URL previews one.
  Pens compare at a glance: each pen's weather icon (sun, sun and cloud, cloud, rain, heavy rain)
  sits on its tab and on group labels over an overview, and the pens menu lists every pen's icon
  and today's % in one column on the dark ticker strip.
  The same green and red repeat the sign of today's change on fish labels in the tank (the ticker
  stays white) and on the total in the tank's hood: a strip on the tank's lid, in the lid's colours, holding
  the weather, today's change and the market state (and any data message), wrapping on phones.
- **Zoom:** with only a few fish the whole tank zooms in (a bigger whole-number scale, up to twice
  the normal one) as far as every fish keeps a few patches' worth of water, so a small pen looks
  close up; adding fish zooms out. Fish swim proportionally slower in art pixels when zoomed. Labels
  and mood badges grow with the fish, but never below the UI's text size, and stack with their fish:
  a fish in front covers the fish behind and its labels. On phones held upright, details sit over the tank's bottom.
- **Tap for numbers:** ticker, % change and $ change, so the app fully replaces a price board.
  A range bar under the mood shows why: a band for a calm day, ticks where strong moves begin, and
  a marker for today, with the typical day's size (±σ) written under it.
  Each details panel leads with today's % change at double size on a dark strip like a price
  board's, with an arrow (▲/▼) and green or red repeating its sign, the mood's face (or a group's
  weather) beside it, and the money change under it. Which colour means up is a setting (red is up
  in China, Japan, Korea and Taiwan).
- **Market closed:** fish sleep after hours and on weekends, each on its own market's hours (a
  London fish sleeps while New York still trades). The market comes from the quote's exchange
  code, else the symbol's suffix (`RY:TSX`, `RY.TO`); unknown markets keep US hours. Crypto pairs
  (`BTC/USD`) never sleep, and their day runs on UTC; currency pairs (`EUR/USD`) trade from Sunday
  to Friday, 17:00 New York time. Holidays come from the provider's "market is open" flag. The tank light goes off only when
  every shown market is closed, and the hood names what is closed ("London closed"). Sleeping also
  signals stale data.

| Tier | Move vs. typical (σ) |
| --- | --- |
| Ecstatic | above +2 |
| Happy | +0.5 to +2 |
| Neutral | −0.5 to +0.5 |
| Uneasy | −2 to −0.5 |
| Sad | below −2 |

Thresholds are a starting proposal, to tune with real data.

## Later phases: traits, events and relationships

Not in v1. Recorded so the architecture leaves room for them.

- **Traits:** temperament by volatility (jittery vs sleepy swimming), dividend payers drop pearls on
  payout days, ETFs lead a small school representing top holdings.
  - *Temperament is built* (November 2026): typical daily volatility σ sets it on a log scale from
    calm (σ ≤ 0.5 %: slow, long glides with long rests) to jittery (σ ≥ 4 %: quick short darts,
    hardly stopping). It never depends on today's move, which is the mood's job. Unknown σ swims
    the middle way. Asleep, every fish drifts the same.
- **Events (tap the fish to learn why):** earnings (nervous before, reacts after), stock split (the
  fish splits in two), ex-dividend and payout dates, trading halts. Only structured calendar events;
  no news feeds.
- **Relationships:** correlated holdings school together; sector habitats.

| Phase | Adds | Data needed |
| --- | --- | --- |
| v1 | Mood, body by sector | Daily prices, sector |
| 2 | Events, tap-to-explain, temperament, dividend pearls | Earnings/dividend/split calendars |
| 3 | Correlation schooling, habitats, ETF schools | Price history, ETF holdings |

## Organizing fish

An investment is a **species**; each fish is an **individual** of that species living in a
specific pen (tank). The same ticker can have fish in several pens, all sharing one mood because
they share one price.

| Level | Maps to | Example |
| --- | --- | --- |
| Family | Sector | Tech |
| Species | Ticker | AAPL |
| Individual | A holding (or slice of one) in a pen | The AAPL fish in your TFSA tank |

**Pens are homes, not filters.** Fish live in them, users arrange them, and each pen gets its own
weather.

- **Custom pens:** user-made, with drag-and-drop. A holding can be split across pens.
- **Territory:** every fish is the same drawn size; weight is the area of the tank it claims, like
  a treemap. Very small holdings share a communal area. When weights change, patches shift gently
  (order-preserving treemap), never a full reshuffle.

**One screen, three controls:** which pens (one, several, or all), how to group them, and the
order.

- **A single pen is a home.** Sorted by Custom (its default), the user's own layout persists there;
  dragging a fish (or Alt+arrows) reorders it, and reordering by hand under another sort switches
  back to Custom, starting from the order on screen.
- **Several or all pens is an overview.** Grouping takes over and fish swim into formation. Each
  group's area is sized by its weight, and every fish in it has its own patch. This never changes
  pen layouts.

| Group by | Fish gather by | Answers |
| --- | --- | --- |
| Mood | Happy to sad, left to right | What's winning and losing today? (default) |
| Pen | The user's pens | How is each pen doing? |
| Family | Sector | What's my sector mix? |
| Species | Ticker | What do I own? |
| None | Nothing: every fish its own patch | Where is my money concentrated? (with Weight) |
| Free roam | Nothing, no patches | Just vibes |
| Correlation (later) | Similar price behaviour | How diversified am I really? |

**Sort by** orders the patches, top-left first like reading a price board, and the groups by the
same measure (Mood columns always run happiest to saddest): Weight (default in an overview),
Today's change, Mood (today's move in typical days), Name, or Custom (the pens' own layouts; the
default in a single pen). Fish without a price sort last. Sorting by change or mood reshuffles as
prices refresh; keyboard order and screen readers follow the sort. A **rearranging speed** setting (Slow,
Normal, Fast, Instant) sets how fast fish swim to their new places when the grouping, sort or pens
change; Instant puts them there at once. Everyday swimming is unaffected.

## Design principles

1. **Glanceable first.** Mood readable in a second; numbers one tap away.
2. **Honest, not hype.** Calm is the default; strong emotions only for genuinely unusual moves.
3. **Reward care, not luck** (for future currency): nothing depends on market performance.
4. **Never show the money socially** (for future social features): share what you hold, never how much.
5. **Borrow familiar patterns:** aquariums, Animal Crossing visits, Tamagotchi care loops.
6. **Cooperative, not competitive.** No leaderboards.

## Aquarium concept

| System | Aquarium version |
| --- | --- |
| Pens | Tanks |
| Cosmetics (later) | Tank decoration: plants, castles, gravel, backgrounds |
| Correlation (later) | Schooling |
| Market closed | Its fish sleep; tank light off when every shown market is |
| Dividends (later) | Pearls |
| Mood | The fish's face |

## Art

Flat pixel art, ENDESGA 32 palette, no shading. Full rules in `art/STYLE.md`.

- **Pixel integrity:** one shared pixel grid for tank and UI; a native low-res render (the scale
  fits a 320 × 180 tank, then the tank grows in whole art pixels to fill its space with a 4-pixel
  margin, no wider than 2.4 × its height or taller than 1.5 × its width), integer upscaling, no rotation, positions rounded to art pixels; pixel font at integer scale; pixel-art
  borders and panels rather than off-the-shelf component styling.
- **Black outline** on every fish; **white outline only for hover and selection.**
- **What each visual encodes:**

| Encodes | Visual | Chosen by |
| --- | --- | --- |
| Sector | Body shape | Sector lookup (6 bodies for 11 GICS sectors) |
| Ticker | Primary (body) + secondary (fin) colours | The user, pre-filled from a brand preset or a hash of the ticker |
| Mood | Eye + mouth | Volatility-scaled daily move |
| Weight | Territory | Share of portfolio |

- **Water:** navy 262b44.
- **Fish colours are part of the core flow.** Adding a holding ends with a "meet your fish" step:
  colours pre-filled (brand preset if one exists, colours only and never logos; otherwise the
  hashed default), one tap to accept or pick from the 32-colour palette. Tap any fish to change
  colours later. Any palette colour is allowed, with no warnings. Community views always use default colours. A tertiary (pattern)
  colour comes later.
- No image-generator art: sprites are hand-specified pixel grids, drafted by Claude and reviewed by
  Max. Final art direction may later move to a human artist; every visual stays swappable.

## MVP scope (v1)

v1 tests one thing: do fish beat a price board for the daily check-in?

| Area | In v1 | Later |
| --- | --- | --- |
| Platform | Web app / PWA | Native Android, then iOS |
| Holdings input | Manual entry + CSV import + JSON export/import | Brokerage connection unlikely (aggregators charge per user) |
| Market data | User's own free API key, stored in the browser | More providers |
| Backend | None (a stateless relay only if CORS blocks the provider) | Social features via a managed service; never price data |
| Mood | Daily move, volatility-scaled tiers, weather, market-closed state | Events, tap-to-explain |
| Fish | Species per ticker, body by sector, colour choice when adding a holding, tap for numbers | Temperament, dividend pearls, ETF schools |
| Pens | Custom pens, drag-and-drop, split holdings, multi-pen overview, arrangement modes | Correlation mode |
| Art | Flat sprites: 6 bodies × 5 moods | Animation frames, patterns, sleeping face, cosmetics |
| Currency, cosmetics, social | — | Phase 2+ |

## Market data

Stock Fish is a hobby project, so it never pays for market data. Delay is not the constraint;
licensing is: serving prices to the public needs a display licence (roughly $150–$400/month).
Instead, **each user brings their own free API key**, so each user is on their own personal-use
account and the app is just a client.

- **What moods need:** previous close, a delayed current price, and about 60 days of daily history
  per ticker, fetched in the browser with the user's key. Volatility is computed locally.
- **Budget:** a 20-ticker portfolio refreshing every 15 minutes in market hours uses roughly 560
  calls a day, within Twelve Data's free cap of 800/day (8/min). Cache history daily. The schedule
  plans for 80% of the cap (the rest covers exchange rates, retries and key tests): each stock
  gets what its session needs, and crypto and currencies, which never close, share what's left,
  refreshing every 15 minutes at most and every 6 hours at least (`refreshPlan` in
  `src/data/refresh.ts`). Settings shows their pace, and warns when the holdings need more than
  the cap.
- **Provider interface** (`getQuote`, `getDailyHistory`), Twelve Data as default, a mock adapter
  for development; at least one TSX-capable provider should be supported eventually.
- **CORS:** Twelve Data allows browser requests (checked 2026-11-17), so no relay is needed for
  it. Other providers still need checking; if one is blocked, add a stateless relay that forwards
  the user's request with their key and stores nothing.
- **Sectors:** Twelve Data's company profile (sector) is paid-only. The app ships a public-domain
  table of S&P 500 sectors plus common funds; for anything else the user picks the fish's family
  when adding it, and can change it later.
- **yfinance / Yahoo:** personal use only under Yahoo's terms. Fine for Max's own testing, never
  shipped.
- **Storage:** holdings, pens and layouts live in IndexedDB. Clearing browser data wipes the tank,
  so export/import is essential in v1. No logins in v1.

## Tech stack (v1)

| Layer | Choice |
| --- | --- |
| Language and build | TypeScript + Vite |
| UI (outside the tank) | React |
| Tank rendering | PixiJS (WebGL 2D) |
| Storage | IndexedDB via Dexie |
| Tests | Vitest |
| Hosting | Cloudflare Workers (static assets) |
| Relay (only if needed) | Cloudflare Workers |
| Licence | MIT |

## Open questions

Placeholders are fine during the build:

- What happens when a holding is sold (placeholder: the fish swims away).
- CSV import format (placeholder: `symbol,quantity,pen`).
- Special bodies for ETFs, funds and crypto (placeholder: body 3).
- Neglect: no consequences.

Before a public launch:

- Notifications: event-based only, never price-based nudges.
- Mood edge cases: 24/7 crypto, foreign-currency holdings, mutual funds pricing once a day, new
  listings without volatility history.
- Accessibility: numbers available to screen readers; mood never conveyed by colour alone.
- Privacy: data stays in the browser; "not investment advice" disclaimer.
- Final name and branding (working name: Stock Fish).
