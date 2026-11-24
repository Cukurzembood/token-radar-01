# Token Launch Radar — radar-2

A token launch radar built for the make.fun bounty
[Build the best token launch radar](https://make.fun/bounty/token-radar-01).

[![Competition](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![Rank](https://make.fun/badge/token-radar-01/CukurZembood/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01)
[![Reward](https://make.fun/badge/token-radar-01/CukurZembood/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01)

Entry by [@cukurzembood](https://make.fun/bounty/token-radar-01) on make.fun
(GitHub: [CukurZembood](https://github.com/CukurZembood/token-radar-01)).

## What it does

The radar ranks 200 token launches from a frozen snapshot of 758 protocols
(DefiLlama, as of 2026-11-14): the full 40-protocol watchlist of pre-token
protocols with TVL ≥ $50M, 160 early pre-token rows below that floor, and a
clearly separated live-token segment. Every row carries an implied launch
valuation and a concrete farm plan.

## The model (radar-2)

Implied value is calibrated from the snapshot itself, not a fixed multiple:

1. **Peer power law.** A log-log regression of market cap on TVL over the
   snapshot's live-token peers (fitted at runtime, peers ordered by slug so
   the result is deterministic) gives the base value. Large protocols trade
   at far lower mcap/TVL ratios than small ones, so a flat 0.25×TVL multiple
   (the starter baseline) systematically overvalues the giants.
2. **Momentum tilt.** 7-day TVL change, clamped to −30%…+30% with a modest
   weight — in the snapshot its correlation with peer residuals is weak, so
   it tilts the ranking instead of driving it.
3. **Maturity tilt.** A log-scaled age factor (0.80–1.00 over 3 years), so
   young protocols are not taxed linearly for being new.

No protocol names are hardcoded. The build is deterministic: two runs of
`main.ts` produce byte-identical output, using only the Node.js standard
library and no network access.

## Run it

Requires Node.js 22.18 or later.

```sh
node main.ts
```

This writes `out/board.json` (200 ranked rows), `out/data.js`,
`out/dashboard/` (sortable/filterable board, detail view, live-token view),
`out/screenshots/`, and `out/dossier.json`.

## Farm plans

Every board row includes an 8-step farm plan: verify official addresses,
use a dedicated wallet, take the category-specific core action sized to a
$50–$250 tier, add a second action or chain, keep a weekly cadence, log
transaction hashes, review risk mid-hold against the protocol's own TVL
trend with a −25% exit trigger, and hold 30–60 days before claiming or
unwinding in two tranches.

## License

MIT — see `LICENSE`.
