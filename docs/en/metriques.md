---
title: Metrics & estimation
description: How the dashboard computes the cost (IN/OUT convention, formula, cache 1 h TTL) and the durations (active time) it displays.
order: 4
---

# Metrics & estimation

This page explains how the dashboard computes the two least obvious numbers: the
**estimated cost** and the **durations**. Everything is computed **locally** from the
transcripts.

## Cost

The cost shown is a **local estimate** (indicative rates per model family), **not real
billing**. The default rates come from `lib/analytics.ts`; you can adjust them in
**Preferences → Estimation rates** (overrides are stored in `data/claudeboard.json` and
applied to every estimation).

### IN / OUT convention

Throughout the dashboard, the display follows this convention:

- **IN** ⬆ = what you send (your prompt: instructions, history, files…).
- **OUT** ⬇ = what you receive (the model's generated response).

### How the cost is computed

For each assistant response, we read its `usage` block and apply:

```
cost = (input        × price_in
      + output       × price_out
      + cache_read   × price_cacheRead
      + cache_write  × price_cacheWrite) / 1,000,000
```

The rate depends on the **model family** (inferred from the id, e.g. `claude-opus-4-8` →
Opus). Unknown or synthetic models are billed at 0.

### Cache write: 1 h TTL

The cache-write price uses the **1 h TTL** rate (the one used by Claude Code). All
`cache_creation_input_tokens` tokens are billed at this rate.

## Durations (active time)

The durations shown (per session, per project and in total) measure **active time**, not
the wall-clock span between the first and the last message.

For a session, we sort its message timestamps and sum the gaps between consecutive messages,
**ignoring any idle gap longer than 30 minutes**:

```
active_time(session) = Σ (msg[i] − msg[i−1])   for each gap ≤ 30 min
```

This 30-minute threshold prevents a session left open (long silence then resumed) from
inflating the duration with its raw start→end span. A single-message session has a duration
of 0.

- **Project total duration** = the sum of the active times of all its sessions
  (`getProjectStats`).
- **Total duration (dashboard)** = the sum of the active times of all sessions in the active
  window; the dashboard also derives the per-session **average** and **median** from it.

See also: [Features](./fonctionnalites.md) for the analytics dashboard (rates are edited from
**Preferences → Estimation rates** in the app).
