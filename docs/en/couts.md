---
title: Costs & estimation
description: IN / OUT convention, cost formula and the cache-write rate (1 h TTL).
order: 4
---

# Costs & estimation

The dashboard shows an **estimated cost** of your usage. It is a **local estimate**
(indicative rates per model family), **not real billing**. The default rates come from
`lib/analytics.ts`; you can adjust them in **Preferences → Estimation rates** (overrides are
stored in `data/claudeboard.json` and applied to every estimation).

## IN / OUT convention

Throughout the dashboard, the display follows this convention:

- **IN** ⬆ = what you send (your prompt: instructions, history, files…).
- **OUT** ⬇ = what you receive (the model's generated response).

## How the cost is computed

For each assistant response, we read its `usage` block and apply:

```
cost = (input        × price_in
      + output       × price_out
      + cache_read   × price_cacheRead
      + cache_write  × price_cacheWrite) / 1,000,000
```

The rate depends on the **model family** (inferred from the id, e.g. `claude-opus-4-8` →
Opus). Unknown or synthetic models are billed at 0.

## Cache write: 1 h TTL

The cache-write price uses the **1 h TTL** rate (the one used by Claude Code). All
`cache_creation_input_tokens` tokens are billed at this rate.

See also: [Features](./fonctionnalites.md) for the analytics dashboard (rates are edited
from **Preferences → Estimation rates** in the app).
