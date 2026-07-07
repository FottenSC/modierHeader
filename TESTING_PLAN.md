# modierHeaders End-to-End Testing Plan

This plan adds browser-level coverage around modierHeaders using Selenium WebDriver plus a local HTTP server. Unit tests still own schema validation and compiler edge cases; these tests prove the built MV3 extension modifies real browser traffic.

## Goals

- Load the built Chrome MV3 extension in an isolated browser profile.
- Serve deterministic test pages from a local web server.
- Seed modierHeaders profiles directly into `chrome.storage.local` from an extension page.
- Verify request header mutation, response header mutation, redirect rules, profile disabling, and no unsolicited tabs.
- Keep production permissions strict while allowing deterministic localhost host access in the test build only.

## Primary Stack

- Test runner: Vitest or Node test runner.
- Browser automation: Selenium WebDriver for JavaScript.
- Browser: Chrome for Testing or Chromium in CI, not a user-managed Chrome install.
- Server: Node `http` server bound to `127.0.0.1` on an ephemeral port.
- Extension build: WXT Chrome MV3 output from `.output/chrome-mv3`.

ChromeDriver documents loading unpacked extensions with `ChromeOptions` and a `load-extension=/path/to/extension` argument. Selenium also documents Chrome-specific options and notes that unpacked directories should use `load-extension`, while `.crx` files use the extension capability. Selenium Manager can manage browser and driver binaries automatically in supported Selenium bindings, and Chrome for Testing exists specifically for browser automation stability.

## Test Build Shape

Add an e2e-only build mode:

```sh
MODIERHEADERS_E2E=1 npm run build
```

When `MODIERHEADERS_E2E=1`, `wxt.config.ts` should add:

- `host_permissions`: `http://127.0.0.1:*/*`, `http://localhost:*/*`
- a deterministic test-only extension key or another deterministic extension-id discovery helper
- no production-only changes to the default build

Keep the existing manifest snapshot test for production builds so required host permissions do not accidentally ship to users.

## Directory Layout

```text
tests/e2e/
  server.ts
  selenium.ts
  extensionState.ts
  modierheaders.e2e.test.ts
  fixtures.ts
```

Suggested npm scripts:

```json
{
  "test:e2e": "npm run build:e2e && vitest run --config vitest.e2e.config.ts",
  "test:e2e:debug": "MODIERHEADERS_E2E=1 vitest --config vitest.e2e.config.ts"
}
```

## Local Test Server

The local server should choose a free port and expose these routes:

| Route | Purpose |
| --- | --- |
| `GET /health` | Readiness check. |
| `GET /page` | Browser page that can run fetch checks and write results to `window.__modierHeadersResults`. |
| `GET /echo/request` | Returns JSON containing request method, URL, and headers received by the server. |
| `POST /echo/request` | Same as above, used for request-method targeting. |
| `GET /echo/response` | Returns response headers used to test response-header set/remove/append. |
| `GET /redirect/source/:id` | Should never be reached when redirect rules are active. |
| `GET /redirect/target/:id` | Returns a target marker for redirect assertions. |
| `GET /logs` | Returns server-observed requests for debugging failed tests. |
| `POST /reset` | Clears server logs between tests. |

The server should not call external services. Every assertion should be based on traffic between Chrome and `127.0.0.1`.

## Selenium Harness

Launch one browser per test file or per test group with a fresh profile:

```ts
const options = new chrome.Options()
  .addArguments(`--load-extension=${extensionPath}`)
  .addArguments(`--user-data-dir=${profileDir}`)
  .addArguments('--no-first-run')
  .addArguments('--disable-default-apps');
```

Prefer Chrome for Testing or Chromium in CI. A locally installed branded Chrome may reject `--load-extension` by policy; the harness should detect this and fail with a clear message.

Extension ID handling:

- Preferred: deterministic e2e extension ID via test-only manifest key.
- Fallback: discover the service worker target through Chrome DevTools Protocol if the Selenium binding exposes it.
- Avoid scraping `chrome://extensions` unless both options above fail.

State seeding:

1. Navigate to `chrome-extension://<extension-id>/options.html`.
2. Execute script in that extension page:

```js
await chrome.storage.local.set({ modierHeadersState: seededState });
await chrome.runtime.sendMessage({ type: 'modierheaders:apply-rules' });
return await chrome.declarativeNetRequest.getDynamicRules();
```

This avoids fragile UI setup clicks while still testing the shipped service worker and DNR rules.

## Core Test Cases

### 1. Startup Trust Check

- Launch extension in a clean profile.
- Assert the browser did not open external tabs.
- Assert no tab URL contains install/update/uninstall ad domains.
- Assert `chrome.declarativeNetRequest.getDynamicRules()` is empty before any enabled profile is seeded.

### 2. Request Header `set`

- Seed one enabled rule setting `X-modierHeaders-Test: set-value` for `xmlhttprequest`.
- Open `/page` and run `fetch('/echo/request')`.
- Assert the server received `x-modierheaders-test: set-value`.

### 3. Request Header `remove`

- Page fetch sends `X-Remove-Me: present`.
- Seed a remove rule for `X-Remove-Me`.
- Assert `/echo/request` does not receive `x-remove-me`.

### 4. Request Header `append`

- Use only a Chrome-supported request-header append target from the modierHeaders allowlist, such as `Accept-Language`.
- Seed append rule with a unique token.
- Assert the server receives the original value plus the appended token where Chrome supports append semantics.
- If Chrome rejects the operation, assert the extension surfaces a clear diagnostics message and clears dynamic rules.

### 5. Response Header `set`

- `/echo/response` returns `X-modierHeaders-Response: original`.
- Seed response set rule changing it to `modified`.
- Page fetch reads `response.headers.get('x-modierheaders-response')`.
- Assert the browser-visible value is `modified`.

### 6. Response Header `remove`

- `/echo/response` returns `X-Remove-Response: present`.
- Seed response remove rule.
- Assert page fetch sees `response.headers.get('x-remove-response') === null`.

### 7. Response Header `append`

- Use a custom response header if supported by current Chrome.
- Assert browser-visible value contains the appended token.
- If unsupported in that browser version, assert diagnostics clearly report the DNR rejection instead of silently failing.

### 8. Redirect Rule

- Seed redirect rule:
  - regex filter matching `/redirect/source/(.*)`
  - substitution to `/redirect/target/\\1`
- Fetch or navigate to `/redirect/source/abc`.
- Assert final response body is the target marker for `abc`.
- Assert the source route was not hit, or was hit only as a browser redirect attempt if Chrome records it that way.

### 9. Targeting

- Domain/url targeting: rule applies on `127.0.0.1` and does not apply to a nonmatching local hostname if configured.
- Resource type targeting: rule applies to `xmlhttprequest` and not `image`.
- Method targeting: rule applies to `POST` and not `GET`.

### 10. Disable Behavior

- Seed enabled rules and confirm dynamic DNR rule count is nonzero.
- Set `state.enabled = false`, apply rules, and assert dynamic DNR rules are empty.
- Re-enable extension but disable the active profile; assert dynamic DNR rules are empty.

### 11. Import/Export Smoke

- Use unit tests for full import/export round trips.
- Browser smoke only needs to verify:
  - options page renders
  - export button triggers a JSON download
  - importing a known JSON payload applies and persists a profile

### 12. Popup/Options UI Smoke

- Open `chrome-extension://<extension-id>/options.html`.
- Assert visible text includes `modierHeaders`, `Profile`, `Rules`, `Permissions`, and `Diagnostics`.
- Open `chrome-extension://<extension-id>/popup.html`.
- Assert active profile, enabled rule count, inline rule editor controls, and diagnostics render.
- Do not test every form control through UI; compiler/unit tests and state-seeded e2e tests cover behavior more reliably.

## CI Plan

Recommended GitHub Actions job:

1. `npm ci`
2. `npm run verify`
3. install or resolve Chrome for Testing/Chromium
4. `npm run test:e2e`
5. upload screenshots, server logs, and browser console logs on failure

Use headed Chrome under Xvfb on Linux if extension behavior is unreliable in headless mode. Keep this separate from unit tests so browser-policy failures are easy to diagnose.

## Failure Artifacts

On every e2e failure, write:

- `.artifacts/e2e/<test-name>/browser.log`
- `.artifacts/e2e/<test-name>/server-requests.json`
- `.artifacts/e2e/<test-name>/dynamic-rules.json`
- `.artifacts/e2e/<test-name>/options.png`
- `.artifacts/e2e/<test-name>/page.png`

These artifacts should be ignored by git and uploaded by CI.

## Acceptance Criteria

- E2E tests pass on a clean CI runner using Chrome for Testing or Chromium.
- Request set/remove and at least one append case are verified against the local server.
- Response set/remove and supported append behavior are verified in browser-visible fetch results.
- Redirect rules are verified with real browser traffic.
- Disabling all profiles leaves zero dynamic DNR rules.
- No test requires a remote service, analytics endpoint, affiliate endpoint, or external web page.
- Production manifest snapshot remains unchanged: no required broad host permissions.

## References

- ChromeDriver extension loading: https://developer.chrome.com/docs/chromedriver/extensions
- Selenium Chrome options: https://www.selenium.dev/documentation/webdriver/browsers/chrome/
- Selenium Manager: https://www.selenium.dev/documentation/selenium_manager/
- Chrome for Testing overview: https://developer.chrome.com/blog/chrome-for-testing
- Chrome DNR API: https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest
