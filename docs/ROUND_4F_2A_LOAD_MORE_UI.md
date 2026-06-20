# Round 4F.2A-2B Load More UI

## State Model

The Opportunities page separates initial load state from pagination state:

- `initialLoading`
- `initialError`
- `loadMoreLoading`
- `loadMoreError`
- `cursorExpired`
- `invalidCursor`
- `hasMore`
- `nextCursor`
- `totalCount`
- `items`

Only real mode uses cursor pagination. Mock, fallback, and legacy responses without `pageInfo` render normally and do not show fake pagination controls.

## Race Protection

The page uses a request generation ref and a load-more in-flight ref:

- old initial responses are ignored after generation changes;
- old load-more responses are ignored after refresh/source changes;
- repeated load-more clicks cannot create multiple effective requests;
- component cleanup increments generation so late responses do not write state.

## Initial Request

Real mode first load uses:

```ts
fetchOpportunities({ source: 'real', limit: 20 })
```

It does not request legacy 50 and slice on the client.

## Append And Dedup

Load-more uses the current stored `nextCursor`:

```ts
fetchOpportunities({ source: 'real', cursor: nextCursor })
```

Incoming items are appended to the end. The client performs a defensive id-based dedupe that preserves:

```text
existing unique items in original order
+ incoming unseen items in original page order
```

No fuzzy title matching, editorial distance, LLM dedupe, or reordering is used.

## Errors

Generic network or HTTP load-more error:

- keeps existing items;
- keeps the old `nextCursor`;
- shows retry copy;
- retry uses the same cursor.

`invalid_cursor`:

- keeps existing items;
- clears the bad cursor;
- does not auto-retry;
- asks the user to refresh the signal pool.

`cursor_expired`:

- keeps existing items;
- does not silently create a new snapshot;
- asks the user to refresh the signal pool.

Refreshing after cursor expiry explicitly requests a new first page with `limit=20` and replaces the old list instead of appending.

## Counts

When `pageInfo` exists, the UI displays loaded count from unique loaded client items and total count from the backend snapshot:

```text
已加载 20 / 共 81 条信号
已加载 40 / 共 81 条信号
已加载全部 81 条信号
```

When filters are active, the filtered count applies only to already loaded items.

## Compatibility

Load-more does not reset:

- source filter;
- strength filter;
- market filter;
- product type/search sorting state;
- selected opportunity;
- decision brief drawer state;
- Analyze CTA href.

## Legacy ID Test

Server tests now include a mocked-provider legacy real API test proving:

```text
GET /api/opportunities?source=real
```

returns 50 stable unique item ids. No server production code was changed for this verification.

## Manual Acceptance

Verified in local smoke after this implementation:

- first page loads 20 real signals;
- load more appends to 40;
- full load reaches the complete snapshot count with no duplicate ids;
- first 20 order remains stable;
- filter state remains local to already loaded items;
- detail drawer and validation CTA are not reset by load-more;
- invalid cursor and expired cursor are shown as refresh-required states;
- mobile layout has no horizontal overflow.

## Verification Notes

`npx tsx --test` initially failed inside the sandbox because `tsx` is not installed locally and npm cache access was blocked. After explicit approval to run the same test command outside the sandbox, the client test suite passed.

`npm run lint` currently fails on pre-existing unrelated files under Analyze, Report, and Advisor components. This round did not modify those files.
