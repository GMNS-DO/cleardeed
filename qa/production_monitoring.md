# Production monitoring — per-fetcher dashboards

> **Sprint V4 spec. Build is post-launch; this is the design contract.**
> Per CLAUDE.md §3 — no over-abstraction. One small Supabase table, one
> Vercel dashboard, one alert. If a fetcher goes down, we see it in five
> minutes and we have the evidence to debug it.

## Why this exists

A buyer's report is only as trustworthy as the weakest fetcher. Bhulekh is
fine on Tuesday and 502s on Wednesday. CERSAI rate-limits. IGR EC returns
captcha on a busy day. We need to know **which fetcher degraded, how often,
and how badly** — without reading server logs at 1am.

The pattern: every fetcher call writes one row to `report_fetcher_metrics`.
A SQL view aggregates the rows. Vercel Analytics + Supabase logs surface the
view. A simple alert fires when success rate drops > 10% over a rolling hour.

---

## Schema

A single new table — not a time-series DB, not Datadog. We don't need that
yet. Plain Postgres is enough for the first 500 paid reports.

```sql
create table report_fetcher_metrics (
  id              bigserial primary key,
  report_id       text references reports(id) on delete cascade,
  fetcher         text not null,           -- 'bhulekh' | 'bhunaksha' | 'ecourts' | 'igr-ec' | 'cersai' | 'rccms' | 'nominatim'
  status          text not null,           -- 'ok' | 'failed' | 'skipped' | 'timeout'
  status_summary  text,                    -- the pipeline's own sourceSummary string (e.g. "ok", "captcha", "not_found")
  duration_ms     integer not null,
  http_status     integer,                 -- upstream HTTP code if available
  error_class     text,                    -- 'network' | 'parse' | 'captcha' | 'auth' | 'rate_limit' | 'unknown'
  created_at      timestamptz not null default now()
);

create index idx_fetcher_metrics_fetcher_created on report_fetcher_metrics (fetcher, created_at desc);
create index idx_fetcher_metrics_report on report_fetcher_metrics (report_id);
```

No retention job yet. The table grows ~7 rows per report (one per fetcher).
At 100 reports/day that's 25K rows/month — well within Supabase's free tier
for the first six months. We'll add a 90-day retention job when this becomes
the bottleneck, not before.

---

## Where the rows are written

The pipeline orchestrator already calls each fetcher in a tiered sequence.
Each call site adds one `try { ... }` wrapper that records metrics, e.g.:

```ts
// packages/orchestrator/src/index.ts (illustrative)
const t0 = Date.now();
let status: "ok" | "failed" = "ok";
let errorClass: string | null = null;
try {
  const result = await bhulekhFetch({ ... });
  if (!result.success) {
    status = "failed";
    errorClass = result.errorClass ?? "unknown";
  }
  return result;
} catch (err) {
  status = "failed";
  errorClass = "unknown";
  throw err;
} finally {
  await recordFetcherMetric({
    reportId: input.reportId,
    fetcher: "bhulekh",
    status,
    statusSummary: ...,
    durationMs: Date.now() - t0,
    errorClass,
  });
}
```

`recordFetcherMetric` is a single helper in the orchestrator package that
does the Supabase insert. Not a framework — a function. Per CLAUDE.md §3.

---

## What we measure (per fetcher, rolling 1h window)

| Metric | Definition | Where to compute |
|---|---|---|
| **Success rate** | `count(status = 'ok') / count(*)` | SQL view `v_fetcher_success_1h` |
| **p50 latency** | `percentile_cont(0.5) within group (order by duration_ms)` | SQL view |
| **p95 latency** | `percentile_cont(0.95) within group (order by duration_ms)` | SQL view |
| **Error class distribution** | `count(*) group by error_class` | SQL view |
| **Status summary distribution** | `count(*) group by status_summary` | SQL view |
| **Captcha / rate-limit count** | `count(*) where error_class in ('captcha', 'rate_limit')` | SQL view |

The SQL views look roughly like:

```sql
create view v_fetcher_success_1h as
select
  fetcher,
  count(*) as calls,
  count(*) filter (where status = 'ok') as successes,
  round(100.0 * count(*) filter (where status = 'ok') / count(*), 1) as success_pct,
  percentile_cont(0.5) within group (order by duration_ms) as p50_ms,
  percentile_cont(0.95) within group (order by duration_ms) as p95_ms
from report_fetcher_metrics
where created_at > now() - interval '1 hour'
group by fetcher;
```

A 1-hour and 24-hour view is enough. We don't need minute-level granularity
until we're processing 100+ reports/hour.

---

## What we watch

### Vercel Analytics dashboard

Vercel Analytics shows request count, error rate, and p95 latency per route
out of the box. We add two custom events:

- `report_fetcher_ok` (one per successful fetcher call)
- `report_fetcher_failed` (one per failed fetcher call, with `error_class` as a tag)

This gives us a top-level "fetcher failure spike" view without a separate tool.
For a startup at 10 reports/day, Vercel is plenty.

### Supabase logs

Every `report_fetcher_metrics` insert is visible in the Supabase log explorer.
For ad-hoc queries ("when did bhulekh last fail?"):

```sql
select created_at, fetcher, status_summary, duration_ms, error_class
from report_fetcher_metrics
where fetcher = 'bhulekh' and status != 'ok'
order by created_at desc
limit 20;
```

### Alert: success-rate drop > 10% over 1hr

The simplest possible alert: a Supabase scheduled function (pg_cron + plpgsql)
that runs every 15 minutes, compares the 1h success rate per fetcher to the
24h trailing baseline, and posts to a Discord webhook if the delta is > 10
percentage points. Skeleton:

```sql
-- pseudo-code; concrete plpgsql lives in infra/supabase/migrations/008_fetcher_alerts.sql
with current_1h as (
  select fetcher, count(*) filter (where status = 'ok')::float / count(*) as rate
  from report_fetcher_metrics
  where created_at > now() - interval '1 hour'
  group by fetcher
),
baseline_24h as (
  select fetcher, count(*) filter (where status = 'ok')::float / count(*) as rate
  from report_fetcher_metrics
  where created_at > now() - interval '24 hours'
    and created_at <= now() - interval '1 hour'
  group by fetcher
)
select c.fetcher, c.rate, b.rate, (c.rate - b.rate) as delta
from current_1h c
join baseline_24h b on c.fetcher = b.fetcher
where (c.rate - b.rate) < -0.10
  and c.rate < 0.90;   -- avoid noise on tiny samples
```

Discord is the right channel because the founder already lives in Discord.
The alert message is one line: `bhulekh: success 65% (was 92%, -27pp) — last 1h`.

### Why a > 10% threshold (not 5% or 20%)

- 5% alerts on normal flakiness. You'll mute it within a week.
- 20% misses slow degradations where a fetcher creeps from 95% to 75%.
- 10% over 1 hour catches both sudden outages (90% → 0%) and slow
  degradations (95% → 80%) without flapping on a single bad call.

We tune this after the first 30 days of real traffic, not before.

---

## What we do NOT build (yet)

- **Per-fetcher time-series dashboard (Grafana, Datadog, Honeycomb).** Vercel +
  Supabase is enough for the first 500 reports. We adopt a real observability
  tool when we have a paying B2B customer who asks for SLAs, not before.
- **Synthetic monitoring (cron that pings each fetcher every 5 min).** The
  shadow runner (Sprint V4) already does a periodic end-to-end probe. A
  separate synthetic monitor is duplication.
- **Anomaly detection / ML on the metric stream.** The threshold alert is
  good enough. ML-on-metrics is a "we have a problem we can't see" solution
  to a problem we don't have.
- **Per-buyer SLO tracking.** We don't have enough buyers to compute SLOs
  meaningfully. We have one product and one price point.

---

## Roll-out

1. **Migration `008_fetcher_metrics.sql`** — the table + the 1h/24h views.
   Two weeks post-launch.
2. **Wrapper in orchestrator** — record one row per fetcher call. One day
   of work. Same week as the migration.
3. **Vercel custom events** — fire from the wrapper. Half a day.
4. **Discord alert** — pg_cron + plpgsql + webhook. Half a day.
5. **First real alert fires** — within a week, because something always
   breaks the first week.

If we hit 100 reports/day and the SQL views are slow, we add a materialized
view. Not before.
