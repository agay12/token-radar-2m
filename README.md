# Token Radar 2M

A token launch radar built for [make.fun's token-radar-01 bounty](https://make.fun/bounty/token-radar-01).

The radar reads make.fun's sealed DefiLlama snapshot, finds the protocols that record no token and are not a wrapped, staked or bridged product of one that trades, and ranks them by the value a launch would inherit today: `tvl_usd × category_ratio × growth × maturity × chain_spread`. Every protocol on the snapshot's watchlist is covered, 160 smaller pre-token protocols are added below the floor, and every row carries a concrete farm plan (actions, costs, timings).

## Run it

```sh
node main.ts --input /input/snapshot.json        # writes /output (or MAKEFUN_OUTPUT_DIR)
```

Node 22, standard library only — no install, no build. The program writes `board.json` (200 ranked rows), `data.js`, the static `dashboard/` (no network, sortable, filterable, per-protocol detail view), `screenshots/` and `dossier.json`.

## Files

- `main.ts` — the entrypoint: read the snapshot, score it, write the output set.
- `lib/model.ts` — the model: implied value, farm plans, board assembly, gate self-check.
- `vendor/makefun-board.ts` — make.fun's dossier library, vendored unchanged.
- `dashboard/` — the page a reader uses: board, filters, detail view.
- `screenshots/` — the board, a protocol detail view, a filtered view.

## Model radar-2-m

Implied value is one function of the snapshot's own figures, applied to every protocol alike:

```
implied = tvl_usd
        × category_ratio        (what $1 of TVL earns in that business; 0.10 default)
        × growth multiplier     (1 + clamp(change_7d, -50, 100)/100 × 0.6)
        × maturity multiplier   (0.55 + min(age_days, 1460)/1460 × 0.45)
        × chain spread          (1 + min(chains, 6) × 0.015)
```

It is a claim of this entry, not make.fun's: it does not predict whether or when a token is issued.

![token-radar-01](https://make.fun/badge/token-radar-01.svg)
![rank](https://make.fun/badge/token-radar-01/agay12/token-radar-2m/rank.svg)
![reward](https://make.fun/badge/token-radar-01/agay12/token-radar-2m/reward.svg)

## License

MIT — see [LICENSE](LICENSE).
