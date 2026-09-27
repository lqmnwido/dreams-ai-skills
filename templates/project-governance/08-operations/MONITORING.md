<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# MONITORING — {{MODULE_NAME}}

What is watched, and what a change to a number means.

`{{MODULE_NAME}}` is a static bundle. It has no server to monitor — so what is
monitored is **the experience it produces**, from outside, and the errors the
browser reports.

---

## 1. The four signals

| Signal | What it is | Where it comes from | Why it matters most |
| --- | --- | --- | --- |
| **Availability** | Can a user reach and use the module? | Synthetic check + uptime | The first question |
| **Container reachability** | Is `remoteEntry.js` served correctly? | HTTP probe | Its failure is silent |
| **Client errors** | JavaScript errors, failed requests, federation failures | Browser error reporting | Usually the only source |
| **Performance** | Load, interact, and API latency | Real user monitoring | Degradation is felt before it is noticed |

> **There is no server log for a remote.** A defect in this module is invisible
> until a browser reports it or a user complains. That is why the browser error
> signal is the most important one here, and why a synthetic check that only
> confirms "the page loads" is not sufficient.

---

## 2. Synthetic checks

Run these on a schedule, and after every deployment. A synthetic check that only
loads the Shell's home page proves nothing about this module.

| # | Check | Pass | Why |
| --- | --- | --- | --- |
| 1 | `GET <module-base>/remoteEntry.js` | `200`, `application/javascript` | No container, no module |
| 2 | The CORS header on that response | allows the exact Shell origin | A wrong origin is a container the Shell cannot load |
| 3 | The Shell route | renders the remote view, not the fallback | Proves the whole path |
| 4 | An authenticated user can load the page | the primary data region populates | Proves the API path too |
| 5 | A failed API request | the error panel is visible and persistent | Proves the failure path still works |
| 6 | Every menu entry for this module | resolves, no 404 | A `capaianUrl` drift is invisible otherwise |
| 7 | The role-denied path | redirects to `/forbidden` | Proves the guard still denies |

```sh
# 1 and 2, the two that must never fail
curl -sS -o /dev/null -w 'status=%{http_code} type=%{content_type}\n' \
  "$MODULE_BASE/remoteEntry.js"
curl -sSI "$MODULE_BASE/remoteEntry.js" | grep -i access-control-allow-origin
```

| Check | Interval |
| --- | --- |
| 1, 2 | Every minute |
| 3, 6 | Every 5 minutes, authenticated |
| 4, 5, 7 | Every 15 minutes, authenticated |

---

## 3. Client error signals

Collected from the browser, not from a server. Aggregate by **route and by
federation component**, not just by message.

| Signal | Threshold | Likely cause |
| --- | --- | --- |
| `Module … does not exist in container` | Any | An expose key and a Shell import have diverged |
| The fallback view rendered | Any | The container is unreachable, or the import resolved to a stub |
| A blank route | Any | The loader is not in place, or the fallback failed |
| A CORS error | Any | The module origin or the API's allowed origin changed |
| A URL containing `undefined` | Any | A missing environment variable in the build |
| `getActivePinia() was called…` | Any | A duplicated singleton |
| A `403` spike | > 5% of requests | A role change, or an authorization defect |
| A `401` spike | > 2% | Token refresh failing, or an adapter ordering problem |
| A `5xx` spike | > 1% | A backend problem — not a frontend one |
| An unhandled rejection | Any | A swallowed error became visible |

> **The first five are frontend deployment failures**, and each has a distinct
> cause. Treat them as release-blocking, not as noise. A page that shows the
> fallback looks like a working site to an uptime check.

---

## 4. Performance

| Metric | Target | Measured at |
| --- | --- | --- |
| Container load (`remoteEntry.js` + the view's chunks) | < 2s on a 4G profile | First visit |
| Largest Contentful Paint | < 2.5s | First visit |
| Interaction to Next Paint | < 200ms | First input |
| Cumulative Layout Shift | < 0.1 | First load |
| The primary data region populated | < 3s | Authenticated |
| API p95 | < 800ms | Per endpoint |
| The module's share of the bundle | < {{BUNDLE_BUDGET_KB}} KB | Per build |

| Rule | Why |
| --- | --- |
| Measure on the first visit | A warm cache hides the cost everyone else pays |
| Measure per route | An average across routes hides the one that is slow |
| Set a budget and fail the build | A budget nobody enforces is a wish |
| Check the layout shift | A skeleton that does not match the content is a CLS regression |

---

## 5. Dashboards

Per module:

| Panel | Shows |
| --- | --- |
| Synthetic checks | Availability, per check, over 24h |
| Container probe | Status, content type, CORS header |
| Client errors | Rate, by route, by federation component |
| Performance | LCP, INP, CLS, per route |
| API latency | p50/p95/p99 per endpoint, with the error rate |
| Release markers | A deploy annotated on every chart |

**A chart without a deploy marker cannot be read.** A latency rise is only
attributable if the release that caused it is visible on the same axis.

---

## 6. Alerting

| Alert | Condition | Severity | Response |
| --- | --- | --- | --- |
| Container down | Probe fails twice | **Page** | `08-operations/INCIDENT.md` |
| CORS rejected | The header does not allow the Shell origin | **Page** | The Shell cannot load the module at all |
| Federation error | Any `does not exist in container` | **Page** | A key has diverged |
| Fallback rendered | Any, sustained | High | The container is unreachable or broken |
| Route blank | Any | High | The loader failed |
| `undefined` in a URL | Any | High | A build is missing an environment variable |
| Auth errors | 401 > 2% for 5 min | High | Session handling |
| Authorization errors | 403 > 5% for 5 min | High | A role or an authorization defect |
| Latency | p95 > 2s for 15 min | Medium | Performance regression |
| Bundle budget exceeded | On build | Medium | Fail the build |
| Certificate expiry | < 14 days | Medium | Renew |

### Two rules

1. **Every page alert has a link to the runbook.** An alert nobody can act on at
   3am is worse than no alert, because it trains people to ignore them.
2. **Every alert is tied to a symptom, not a cause.** "CPU high" is a cause.
   "Users cannot open the program list" is a symptom. Page on the symptom.

---

## 7. Log and error hygiene

| Rule | Reason |
| --- | --- |
| No token, password, or `Authorization` header in an error report | `02-governance/SECURITY.md` |
| No personal data in an error report | Same |
| Include the correlation id and the route | Without them a report is unactionable |
| Include the module and UI package versions | Half of all reports are version mismatches |
| Never log the full payload of a failed request | It may contain another user's data |
| Source maps to the error tracker only | Never to a public static host |

---

## 8. Review

| Cadence | Review |
| --- | --- |
| Daily | Overnight alerts; anything that woke someone |
| Weekly | Client error trends; new failure modes |
| Monthly | Alert noise — tune, or delete. An alert with no action is deleted. |
| Per release | The dashboards before and after, with the deploy marker visible |
| Quarterly | The synthetic checks still test something real |

---

## 9. Current state

| Signal | Baseline | Target | Last measured |
| --- | --- | --- | --- |
| Availability | | | {{REVIEW_DATE}} |
| Container probe | | 100% | |
| Client error rate | | < 0.5% | |
| LCP | | < 2.5s | |
| API p95 | | < 800ms | |
| Bundle size | | < {{BUNDLE_BUDGET_KB}} KB | |
