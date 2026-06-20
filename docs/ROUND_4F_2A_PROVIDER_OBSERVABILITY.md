# Round 4F.2A-1 Provider Observability

## 1. Scope

This round adds observability for `/api/opportunities?source=real` without changing the hard limit, provider query semantics, ranking semantics, UI, scoring, LLM, or data sources.

The real API keeps the existing response fields:

- `source`
- `generatedAt`
- `count`
- `items`
- `providerStats`

It also adds an optional `poolStats` object only for the real provider response path. Mock and fallback responses do not synthesize real provider pool statistics.

## 2. poolStats

`poolStats` is calculated from the provider aggregation chain instead of being inferred from the final item count.

```ts
poolStats: {
  hardLimit: number;
  rawCount: number;
  mappedCount: number;
  validCount: number;
  deduplicatedCount: number;
  primarySelectedCount: number;
  finalCount: number;
}
```

- `hardLimit`: current global real API limit. It remains `50`.
- `rawCount`: sum of provider raw result counts.
- `mappedCount`: sum of provider-mapped opportunity counts before provider quota and global limit.
- `validCount`: mapped candidates that passed required field and evidence validation before provider quota and global limit.
- `deduplicatedCount`: cross-provider merged and deterministically deduplicated candidate count before the global hard limit.
- `primarySelectedCount`: first-pass provider quota selection, currently up to 10 per provider.
- `finalCount`: final returned API item count after global limit.

Stage definition:

| Field | Counted at | Before provider quota | Before global hard limit | May be undefined |
| --- | --- | --- | --- | --- |
| `requestedCount` | planned upstream request size or target size | yes | yes | yes |
| `rawCount` | upstream response records actually received | yes | yes | no, when provider ran |
| `mappedCount` | raw records converted to internal candidate structures | yes | yes | no, when provider can map |
| `validCount` | mapped candidates that pass required shape, URL, timestamp, and evidence checks | yes | yes | no, when provider can validate |
| `selectedCount` | provider-sorted, provider-deduped, provider-quota-selected candidates handed to the global pool | no | yes | no |
| `finalCount` | final attributable API items after cross-provider merge, deterministic dedupe, and hard limit | no | no | no |

`dropReasons` are terminal and mutually exclusive for record-level processing after records actually exist. `droppedCount` must equal the sum of all values in `dropReasons`. `requestedCount` is only a planned request target and never contributes to `droppedCount`.

## 3. providerStats

Each provider now reports the extended optional shape:

```ts
{
  ok: boolean;
  configured: boolean;
  requestedCount: number;
  rawCount: number;
  mappedCount: number;
  validCount: number;
  selectedCount: number;
  finalCount: number;
  droppedCount: number;
  dropReasons: Record<string, number>;
  latencyMs: number;
  httpStatus?: number;
  errorClass?: string;
  rateLimited?: boolean;
  cacheHit?: boolean;
  lastSuccessAt?: string;
  message?: string;
}
```

Backward-compatible fields are preserved:

- `fetchedCount`
- `returnedCount`
- `error`
- `skippedReason`

Fields that cannot be measured by a provider are omitted rather than fabricated, except where the provider explicitly reports zero.

## 4. Failure Classes

The aggregation layer and provider source files classify failures into:

- `not_configured`
- `rate_limited`
- `timeout`
- `network_error`
- `http_error`
- `invalid_payload`
- `mapping_failed`
- `no_results`
- `no_usable_items`
- `quota_truncated`
- `global_limit_truncated`
- `unknown`

Product Hunt token absence is treated as:

```ts
configured: false
ok: false
errorClass: 'not_configured'
```

No Product Hunt request is sent when the token is missing.

GDELT distinguishes HTTP 429, timeout, zero raw results, raw articles with no usable opportunity, and usable items that are not finally selected.

GitHub reports raw result count separately from mapped, valid, selected, and final counts. A provider returning 30 raw GitHub items but only 10 final API items is no longer reported as if GitHub only returned 10.

## 5. Drop Reasons

The current tracked drop reasons are:

- `missing_title`
- `missing_url`
- `invalid_url`
- `missing_timestamp`
- `invalid_shape`
- `duplicate`
- `provider_quota`
- `global_limit`
- `irrelevant`
- `unknown`

Only reasons that actually occur are recorded in a provider's `dropReasons`.

`provider_quota` means a valid provider candidate was not handed to the global pool because the provider's own quota had already been reached. `global_limit` means a cross-provider deduplicated candidate reached the global pool but was outside the real API hard limit. The two reasons are not double-counted for the same record.

Request-level failures are reported through `errorClass`, `httpStatus`, `rateLimited`, `message`, and `latencyMs`; they do not create record-level `dropReasons` unless the provider received an enumerable payload with actual raw records. This applies to `not_configured`, `rate_limited`, `timeout`, `network_error`, `http_error`, and `invalid_payload` when no raw records were formed.

## 6. Current Local Smoke Result

Local smoke endpoint:

```text
http://127.0.0.1:3011/api/opportunities?source=real
```

Result summary:

- `count`: 50
- `poolStats.hardLimit`: 50
- `poolStats.rawCount`: 158
- `poolStats.mappedCount`: 156
- `poolStats.validCount`: 156
- `poolStats.deduplicatedCount`: 55
- `poolStats.primarySelectedCount`: 30
- `poolStats.finalCount`: 50
- Provider final sum: 50
- Source distribution: Hacker News 20, Apple App Store 20, GitHub 10

Provider summary:

| Provider | ok | configured | requested | raw | mapped | valid | selected | final | dropped | errorClass |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Hacker News | true | true | 60 | 60 | 60 | 60 | 20 | 20 | 40 |  |
| Apple App Store | true | true | 75 | 68 | 66 | 66 | 20 | 20 | 48 |  |
| GitHub | true | true | 30 | 30 | 30 | 30 | 15 | 10 | 20 | `global_limit_truncated` |
| Product Hunt | false | false | 0 | 0 | 0 | 0 | 0 | 0 | 0 | `not_configured` |
| GDELT | false | true | 30 | 0 | 0 | 0 | 0 | 0 | 0 | `timeout` |

Observed drop reasons:

- Hacker News: `provider_quota: 40`
- Apple App Store: `duplicate: 2`, `provider_quota: 46`
- GitHub: `provider_quota: 15`, `global_limit: 5`
- Product Hunt: none
- GDELT: none; timeout/HTTP 429 are request-level metadata, not record-level data loss.

For every provider in this smoke run, `droppedCount` equals the sum of `dropReasons`.

## 7. How 40/50 Is Formed

The real response chain is now observable as:

```text
provider request
-> provider rawCount
-> provider mappedCount before provider quota
-> provider validCount before provider quota
-> provider selectedCount after provider sorting, dedupe, and quota
-> primary provider selection, currently up to 10 each
-> remaining selected items appended in provider order
-> cross-provider deterministic dedupe
-> global hardLimit slice, still 50
-> API count/items
```

In the smoke run, the final 50 came from:

- HN 60 valid items, 20 provider-selected, all 20 final.
- App Store 66 valid items after 2 provider duplicates, 20 provider-selected, all 20 final.
- GitHub 30 valid items, 15 provider-selected, 10 final because the global hard limit was reached.
- Product Hunt 0 because it was not configured.
- GDELT 0 in this smoke because the provider timed out before raw records were formed.

## 8. Knowledge Base Handling

HotPulse Market Knowledge remains internal evidence only:

- It is not counted as an independent provider.
- It does not increase external source count.
- It does not enter `rawCount`.
- It does not increase `finalCount`.

The tests cover this by adding HotPulse Market Knowledge evidence to a provider item and verifying that only the provider item is counted.

## 9. Files Changed

- `server/index.js`
- `server/sources/hackerNewsOpportunities.js`
- `server/sources/appStoreOpportunities.js`
- `server/sources/githubOpportunities.js`
- `server/sources/productHuntOpportunities.js`
- `server/sources/gdeltOpportunities.js`
- `server/test/provider-observability.test.js`
- `client/src/api/fetchOpportunities.ts`
- `client/src/types/hot.ts`
- `docs/ROUND_4F_2A_PROVIDER_OBSERVABILITY.md`

## 10. Verification

Server test:

```text
npm test
tests 45
pass 45
fail 0
```

Client TypeScript:

```text
npm exec tsc -- --noEmit
pass
```

Client build:

```text
npm run build
pass
```

API smoke:

```text
count 50
provider finalCount sum 50
source distribution Hacker News 20, Apple App Store 20, GitHub 10
```

## 11. Guardrails

This round did not:

- change the hard limit from 50;
- add a provider;
- change UI;
- change scoring;
- change sorting semantics;
- change LLM or Analyze behavior;
- configure or expose a Product Hunt token;
- commit or push.
