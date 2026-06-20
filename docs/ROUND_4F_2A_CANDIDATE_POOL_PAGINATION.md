# Round 4F.2A-2A Candidate Pool Pagination

## 1. Legacy vs Cursor

Legacy request:

```text
GET /api/opportunities?source=real
```

This keeps the existing behavior: it does not require pagination parameters, returns at most 50 items, and keeps `count === items.length`.

Cursor mode starts only when `limit` or `cursor` is present:

```text
GET /api/opportunities?source=real&limit=20
GET /api/opportunities?source=real&cursor=<opaque-cursor>
```

Legacy calls are not silently changed to 20 items.

## 2. Candidate Pool vs Page Size

The candidate pool is a backend snapshot, not the number shown on one page.

- `CANDIDATE_POOL_HARD_LIMIT = 120`
- `DEFAULT_PAGE_SIZE = 20`
- `MAX_PAGE_SIZE = 30`
- `LEGACY_HARD_LIMIT = 50`

Cursor mode builds a fixed ordered snapshot, then each page slices that snapshot. Page slicing is not a drop reason.

## 3. Provider Quotas

Cursor candidate pool mode uses provider maximums:

- Apple App Store: 40
- GitHub: 40
- Hacker News: 40
- Product Hunt: 20
- GDELT: 10

These are maximums, not minimums. Failed or unavailable providers do not generate fallback items.

## 4. HN Low Signal Cap

Low-signal Hacker News items are identified from existing evidence strength and interaction metadata. The cursor candidate pool keeps at most 10 low-signal HN items.

Extra real HN records are counted as:

```text
low_signal_cap
```

They are not counted as `mapping_failed`, `irrelevant`, or `global_limit`.

## 5. Stable Ordering

Cursor mode uses deterministic round-robin merging over available providers. The priority order is:

```text
Apple App Store -> GitHub -> Product Hunt -> Hacker News -> GDELT
```

Unavailable providers are skipped. Once a snapshot is created, all later cursor pages slice the same item order and do not refetch providers.

## 6. Snapshot Lifecycle

Snapshots are single-process in-memory objects:

```ts
{
  id: string;
  createdAt: string;
  expiresAt: string;
  items: OpportunityItem[];
  providerStats: ProviderStats;
  poolStats: PoolStats;
}
```

Rules:

- TTL is 10 minutes.
- At most 20 snapshots are retained.
- Expired snapshots are removed on create/access.
- When the limit is exceeded, the oldest snapshot is removed first.
- Render process restart clears snapshots; the API returns `cursor_expired` instead of silently rebuilding a different page.

Redis or a database is intentionally not used in this round.

## 7. Cursor Format

Cursor is an opaque base64url string over:

```ts
{
  v: 1;
  snapshotId: string;
  offset: number;
  pageSize: number;
}
```

It does not contain item titles, URLs, evidence text, or tokens. Version, snapshot id, offset, and page size are validated. A cursor request with a separate `limit` is rejected to avoid page boundary drift.

## 8. Errors

Invalid cursor:

```json
{
  "error": "invalid_cursor",
  "message": "The pagination cursor is invalid."
}
```

Expired or missing snapshot:

```json
{
  "error": "cursor_expired",
  "message": "The opportunity snapshot has expired. Start a new request."
}
```

Invalid limit returns:

```json
{
  "error": "invalid_limit",
  "message": "limit must be an integer between 1 and 30."
}
```

## 9. Observability

Cursor response keeps:

```ts
{
  source,
  count,
  items,
  providerStats,
  poolStats
}
```

And adds:

```ts
pageInfo: {
  mode: 'cursor_v1';
  pageSize: number;
  returnedCount: number;
  totalCount: number;
  offset: number;
  hasMore: boolean;
  nextCursor: string | null;
  snapshotId: string;
  generatedAt: string;
  expiresAt: string;
}
```

Invariants:

- `count === items.length`
- `pageInfo.returnedCount === items.length`
- `pageInfo.totalCount === snapshot.items.length`
- `sum(provider.finalCount) === response.count`
- `sum(provider.candidatePoolCount) === pageInfo.totalCount`
- `poolStats.candidatePoolCount === pageInfo.totalCount`
- `poolStats.finalCount === response.count`

Request-level failures do not create record-level `dropReasons`.

## 10. Frontend Follow-Up

The client helper now supports:

```ts
fetchOpportunities({ source: 'real', limit: 20 })
fetchOpportunities({ source: 'real', cursor })
```

No UI is implemented in this round. A later frontend round can use `pageInfo.nextCursor` for a Load More action.

## 11. Out of Scope

This round does not:

- add new data sources;
- configure Product Hunt tokens;
- install Redis or a database;
- install new npm packages;
- modify opportunity cards, details, CSS, or page copy;
- modify Analyze or LLM behavior;
- perform cross-source opportunity topic clustering.

Cross-source topic aggregation remains for Round 4F.2B.
