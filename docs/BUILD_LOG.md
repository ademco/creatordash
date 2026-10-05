# Build log

What was built in each phase, why, and likely interview questions.

## Phase 0: Setup

### What was built

- A root `package.json` that makes the repo an **npm workspaces monorepo** with two packages: `api/` (`@fan-insights/api`) and `web/` (`@fan-insights/web`). Each currently has a placeholder `package.json`. Phase 2 fills in the API and Phase 3 fills in the dashboard.
- Root scripts `npm run typecheck`, `npm test`, and `npm run build`. Each one runs the script of the same name in every workspace (`--workspaces --if-present`). The commands are fixed from day one, so CI (Phase 7) and the Dockerfile (Phase 5) never need to change when a package gets added.
- `.nvmrc` pins Node 22, and `engines.node` in `package.json` records the same requirement.
- `.gitignore` covers what's needed now (`node_modules/`, `dist/`) and what comes later: real analytics data (`data/real/`), `.env` files, Terraform state and `.tfvars`, and Python virtualenvs. Adding these before the files exist means they can never be committed by accident.
- `CLAUDE.md` (the project spec) is committed, so anyone working in the repo, human or AI, starts from the same plan.
- `package-lock.json` is committed so every machine installs exactly the same dependency versions.

Tool check: Node 22.22.0, npm 10.9.4, git 2.43.0. Nothing needed installing. The GitHub repo `ademco/creatordash` already existed and is public, so no new repo was created.

### Key decisions and trade-offs

- **npm workspaces instead of Turborepo, Nx, or pnpm.** npm ships with Node, so there's nothing extra to install or explain. A two-package repo doesn't need build caching or task graphs. If the repo grew to many packages, Turborepo's caching would start to pay off.
- **One repo for API and web instead of two.** The schema and the dashboard change together, so one commit can update both, and one Docker image can ship both. The cost is that API and web can't be released on separate schedules, which this project doesn't need.
- **`main` plus one pull request per phase.** `main` stays green, and each later phase arrives as a reviewable PR that gets squash-merged. Once CI exists (Phase 7) it runs on every PR, and the PR list doubles as a readable history of how the project was built. Pushing straight to `main` would be faster but leaves no review step and no per-phase record.
- **Placeholder workspace packages now.** npm expects each listed workspace folder to hold a `package.json`. Tiny placeholders keep `npm install` clean until the real packages exist.

### Interview questions

1. **What is an npm workspace, and why use one here?**
   It's npm's built-in monorepo support. The root `package.json` lists the package folders, `npm install` installs all of them into one shared `node_modules` with one lockfile, and `npm run <script> --workspaces` runs a script in each package. I used it so the API and the dashboard live in one repo, can share TypeScript types later, and ship as one container, without adding a separate monorepo tool.

2. **Why commit `package-lock.json`, but not `node_modules`?**
   The lockfile records the exact version of every dependency, including dependencies of dependencies, so my laptop, CI, and the Docker build all install the same thing. `npm ci` uses it for fast, reproducible installs. `node_modules` can be rebuilt from the lockfile, it's large, and some packages compile native code for one specific OS and CPU, so it doesn't belong in git.

3. **Why ignore Terraform state and `data/real/` before they even exist?**
   Terraform state can contain resource details and sometimes secrets in plain text, and my real analytics numbers are private. Ignoring them up front means a careless `git add .` can't leak them. Once something is pushed to a public repo, you have to assume it's been copied, even if you delete it afterwards.

## Phase 1: Sample data

### What was built

- `scripts/generate-sample-data.mjs` (run with `npm run sample-data`) writes two made-up CSV files:
  - `data/sample/audience.csv`: 180 days × 5 platforms, 900 rows. Each platform has its own starting size, daily growth, and day-to-day wobble. Spotify monthly listeners wobble the most because, unlike followers, they can go down.
  - `data/sample/content.csv`: 212 releases, videos, streams, and shorts on a realistic schedule. Releases go out every 18 days, YouTube videos weekly, Twitch streams every 3 days, Kick streams weekly, and TikTok shorts every other day.
- **Six planned breakouts** get 4 to 7.5 times the usual views. Each one adds a wave of new followers that fades over about a week, so the growth lines bend after it. Some spill over to another platform: a viral TikTok also brings Spotify listeners.
- `data/sample/README.md` says up front that every number is fake. It lists the breakouts and what the dashboard should show for each window, which gives Phase 2 and 3 a known answer to check against.

### Key decisions and trade-offs

- **Deterministic output.** `Math.random()` can't be seeded, so the script uses mulberry32, a tiny seeded generator, plus a fixed end date (2026-09-30) instead of "today". Every run writes byte-identical files. I confirmed this by running the script twice and comparing checksums. Tests and screenshots built on this data won't drift. The cost is that the sample data never looks "current", which is fine because the app counts windows back from the newest date in the data.
- **Data designed to test the insight rules.** Normal posts are capped at 1.8× usual views, and breakouts sit well above the 2.5× line. Spotify has only one release in the last 30 days, which exercises the "skip platforms with fewer than 3 items" rule. Titles include commas and quotes (`Cold Coffee, Warm Hands`, `Fan duet: "Glass Houses", acoustic`) to exercise CSV quoting. A different parser (Python's `csv` module) read the files back to confirm they're valid CSV.
- **A bug the check caught.** At first, views grew in step with audience size. Late posts then looked like hits next to early ones, and a normal Twitch stream crossed 2.5× by accident. Views now grow with the square root of audience growth: still realistic, without false breakouts.
- **Commit the generated CSVs.** They are small (40 KB), and anyone who clones the repo, including CI and the Docker build, has data without running a script. The risk is the CSVs drifting from the script; the README marks them as generated and says to rerun the script instead of editing them.
- **Plain `.mjs`, not TypeScript.** It's a one-off build tool with no dependencies, so `node scripts/generate-sample-data.mjs` runs as is with no compile step.

### Interview questions

1. **Why not just use `Math.random()`?**
   It can't be seeded, so every run would produce different data. Tests would need loose assertions, screenshots would change, and a bug seen once might never come back. A seeded generator gives the same sequence of "random" numbers every time, and changing the seed gives another fixed dataset. I also used separate generators for the two tables, so changing the content schedule doesn't reshuffle the audience numbers.

2. **How did you make sure the sample data actually exercises your breakout logic?**
   I designed it backwards from the rule. Breakouts are content with at least 2.5× the platform's median views, so I capped normal posts at 1.8× and put six planned breakouts at 4× to 7.5×. Then I read the CSVs with a separate parser and computed the median-based breakouts for 30, 90, and 180 days. That check caught a real problem: scaling views with audience growth made a normal late Twitch stream cross 2.5×, so I switched to square-root scaling.

3. **Why is the median better than the mean for "usual views"?**
   One big hit drags the mean up but barely moves the median, and the hit is part of its own baseline. The sample data shows this. Spotify has 5 releases in the last 90 days. "Glass Houses" has 45,546 streams; the median is 14,403 and the mean is 19,677. Measured against the median it's 3.16×, a clear breakout. Measured against the mean it's 2.31×, so the most important release of the quarter would disappear from the list. The fewer items a platform has, the worse this gets, which is also why platforms with under 3 items are skipped.

## Phase 2: API

### What was built

A TypeScript GraphQL API in `api/`, organized in small files with one job each:

| File | Job |
|---|---|
| `types.ts` | The row and result shapes, plus the allowed platforms and content types |
| `csv.ts` | A hand-written RFC 4180 CSV parser: quoted commas, doubled quotes, newlines in quotes, Windows line endings, Excel's byte-order mark |
| `rows.ts` | Turns CSV into typed rows and reports every bad line at once ("line 14: platform "myspace" should be one of ...") |
| `insights.ts` | The pure insight functions: `clampDays`, `windowStart`, `median`, `audienceSeries`, `platformBreakdown`, `overview`, `findBreakouts` |
| `datasource.ts` | The `DataSource` interface: `newestDate`, `audienceSince`, `contentSince`, `info` |
| `local-datasource.ts` | Reads the two CSVs and re-reads them when they change on disk |
| `schema.ts` / `resolvers.ts` | GraphQL schema with descriptions on every type and field, and thin resolvers |
| `app.ts` / `index.ts` / `config.ts` | Express 5 app (`/graphql`, `/healthz`), the entry point, and env-based configuration |

There are 43 Vitest tests in 4 files. They cover the parser, the validation, every insight rule (including the median-versus-mean case), and an end-to-end test. That test starts the real Express app on a random port, sends GraphQL over HTTP, and checks the exact numbers documented for the sample data (for example, 90 days: +11,041 fans, Spotify on top, 5 breakouts).

Run it with `npm run dev -w api` and open http://localhost:4000/graphql for Apollo Sandbox.

### Key decisions and trade-offs

- **graphql 16, not 17.** `npm view` showed graphql 17 is out, but Apollo Server 5 declares `graphql@^16.11` as a peer dependency. A mismatched peer is how you get two copies of graphql-js and confusing runtime errors, so the API pins 16.14.
- **TypeScript 7.** It's the current release: the compiler rewritten in Go, about 10× faster. The config uses `module: NodeNext`, which follows Node's real ESM rules. That's why imports say `./csv.js` even in `.ts` files: the import names the file that will exist at runtime.
- **Data sources only filter by date; insights.ts does the thinking.** The "what is a breakout" logic is written and tested once. The BigQuery version (Phase 6) only needs a `WHERE date >= @since` query. The trade-off is that BigQuery returns more rows than strictly needed, which doesn't matter at a few thousand rows.
- **One shared "newest date" for both tables.** "The last 30 days" means the same days for growth and for breakouts, even if the newest content is a day older than the newest audience number.
- **A window of N days holds N dates, including the newest.** `windowStart('2026-09-30', 30)` is `2026-09-01`. It's simple to explain, and the tests lock it in, including leap years.
- **Hand-written CSV parser instead of a library.** The spec requires handling quoted fields, and writing the parser in about 40 lines (with tests) is a good thing to be able to explain. In a team codebase, I'd probably use `csv-parse`.
- **Friendly validation.** Real exports will have typos. Platform names are trimmed and lowercased (`" Spotify "` works), and errors list up to 10 problems with line numbers instead of stopping at the first one.
- **`/healthz` doesn't touch the data.** It's a liveness check. If it queried BigQuery, a slow query could make Cloud Run think the container was dead and restart it.
- **Introspection stays on in production.** The data is read-only and the schema is the documentation. Apollo turns it off by default when `NODE_ENV=production`.
- **No codegen yet.** Resolver argument types are written by hand because there are only five queries. With a bigger schema, I'd add GraphQL Code Generator so the TypeScript types come from the schema.

### Interview questions

1. **Why GraphQL instead of REST for this dashboard?**
   The dashboard needs four different views of the data in one screen. With GraphQL it asks for exactly those fields in one request, and the schema doubles as typed, self-describing documentation (Sandbox shows every field's description). REST would mean four endpoints or one custom endpoint shaped for this page. The costs of GraphQL are caching (everything is a POST to one URL) and the risk of expensive queries. Neither matters here: the schema is flat, and the data is small and read-only.

2. **How would you swap CSV files for a database without rewriting the app?**
   That's what the `DataSource` interface is for. Resolvers depend on the interface, not on a class. `LocalDataSource` and `BigQueryDataSource` both implement four methods, and `config.ts` picks one from `DATA_SOURCE`. The insight functions are pure and only see rows, so they don't change at all. The tests prove the API behaves correctly on the local source, and the BigQuery source only has to return the same rows.

3. **What's a pure function, and why does it matter here?**
   Its output depends only on its inputs, and it has no side effects: no file reads, no clock, no network. Every insight rule is pure, so each test just passes in rows and checks the result. There's no mocking, and the tests run in milliseconds. For example, windows count back from the newest date in the data, not from `Date.now()`, so the same input always gives the same answer.

## Phase 3: Dashboard

### What was built

A React 19 + TypeScript dashboard in `web/`, built with Vite 8. `npm run dev` at the root starts the API and the dashboard together (using `concurrently`), and Vite proxies `/graphql` to the API on port 4000.

- **One GraphQL query** (`web/src/graphql/dashboard.ts`) fetches everything the page shows for the chosen window. `TypedDocumentNode` gives the result a TypeScript type, so `data.overview.gained` is checked by the compiler.
- **Top bar:** app name, plus a 30 / 90 / 180-day picker. It's a real radio group, so it works with the keyboard and screen readers. The choice is kept in the URL (`?days=90`).
- **Headline:** a sentence written from the data by `lib/summary.ts`. It says "Most of them came from TikTok" only when that platform really brought more than half. Otherwise it says "Spotify brought the most". It also handles drops and no change. A second line gives the combined audience and says someone following on two platforms counts twice.
- **Growth chart:** a Recharts line chart with a Growth/Total toggle and platform chips that show or hide each line. The tooltip lists every visible platform at the hovered date. A "See these numbers as a table" section gives the same numbers without the chart.
- **Where your fans are:** thin share bars with the latest audience (in each platform's own word: monthly listeners, subscribers, followers), the share, and the gain.
- **What broke out:** a ranked list with the multiple ("7.1×"), title, platform, date, and "48,055 views, usually 6,762". Streams say "peak viewers" and releases say "streams".
- **States:** loading, empty (points to the docs and to `npm run sample-data`), and error (says to run `npm run dev`, with a Try again button). When you switch windows, the old numbers stay on screen, dimmed, until the new ones arrive, so nothing flashes or jumps.

There are 10 Vitest tests for the headline wording, the number formatting, and the axis ticks. I checked it in headless Chromium at 1280px in light and dark mode and at 390px (phone), with no horizontal scrolling. I also checked hover, toggles, the window switch, keyboard focus, and the error state with the API stopped.

### Key decisions and trade-offs

- **The palette was checked, not eyeballed.** I ran the spec colors through a colorblind-safety validator. Two needed small nudges: Spotify green `#1F7A5A` → `#0F8A5F` (it read as gray) and Kick gold `#B58A00` → `#A47C00` (below 3:1 contrast on the paper background). The dark theme has its own tuned set, checked against the dark background. Colors are CSS variables. The SVG chart reads them in JS (`useThemeColors`) and re-reads them when the system theme changes.
- **"Growth" is the default view.** TikTok (21K) and Kick (1.6K) on one "Total" axis makes Kick a flat line. Gain since the start of the window puts every platform on a comparable scale, and it's what an artist actually asks: who grew?
- **Chips are the legend.** Each chip has the line's color, and colors follow the platform, never its rank, so hiding a line never repaints the others.
- **I calculate the axis ticks myself.** Recharts rounded the axis down to a full tick, so a −50 dip added an empty band down to −2,000. `lib/ticks.ts` ends the axis at the data and puts ticks at round numbers inside it.
- **No chart for the share bars.** They're plain HTML `div`s, which are simpler, accessible, and easy to style. The text carries the value, and the bar is marked `aria-hidden`.
- **Dates are formatted in UTC.** `2026-09-30` means a calendar day. Formatting it in local time would show "Sep 29" to anyone west of London.
- **One bundle, about 230 KB gzipped.** Code-splitting wouldn't help much, because the page always needs Recharts and Apollo, so I raised Vite's warning limit with a comment explaining why.

### Interview questions

1. **How does the dashboard get its data, and why is there no CORS setup?**
   The page sends one GraphQL query to the relative URL `/graphql`. In development, Vite's dev server proxies that path to the API on port 4000. In production, the same Express server serves the page and `/graphql`. Either way the browser only ever talks to one origin, so CORS never comes up. Apollo Client caches results by query and variables, so switching back to a window you've already seen is instant.

2. **How did you make the chart work in dark mode and for colorblind users?**
   Colors are defined once as CSS variables, with a dark-mode override under `prefers-color-scheme`. The chart is SVG, so a hook reads the current variable values and re-reads them when the theme changes. I validated both palettes for lightness, contrast against the background, and separation under simulated color blindness, and adjusted two colors. Identity never relies on color alone: chips and the tooltip pair color with the platform name, and there's a table view.

3. **Why keep the previous data on screen while loading?**
   If the page swapped to a spinner on every window change, the layout would collapse and jump back, and you'd lose your place. Apollo's `previousData` lets the page keep the last result, dimmed, until the new one arrives. It's a small detail that makes the page feel stable.

## Phase 4: Real data

### What was built

- **`docs/REAL_DATA.md`**: how to get numbers from Spotify for Artists, YouTube Studio, Twitch, Kick, and TikTok into the two CSV files. It also explains why views must be measured over the same period to be comparable.
- **`data/templates/`**: ready-to-copy `audience.csv` and `content.csv` with example rows, including a quoted title with commas.
- **`ingest/fan_data.py`**: the adapter for existing Python scripts. It uses only the standard library.
  - `check_folder("data/real")` lists every problem with its line number.
  - `upsert_audience` and `upsert_content` add or replace rows: audience rows keyed by date and platform, content rows by date, platform, and title. Re-running a daily script updates numbers instead of duplicating them.
  - Command-line equivalents: `check`, `add-audience`, `add-content`.
- **New commands:**
  - `npm run dev:real`: the dashboard on `data/real`
  - `npm run check-data -- data/real`: check a folder without starting anything
  - `npm test` now also runs the Python tests
- **A clear startup error** when the data folder is missing ("Can't find data/real/audience.csv. Copy the templates there...") instead of a raw file-not-found error.

Tests: 6 Python `unittest` tests, plus 3 new API tests. One of them loads `data/templates` through the real `LocalDataSource`, so if the documented format and the API ever disagree, the build fails.

**Still open:** I didn't have access to Adem's existing analytics scripts. Once they're in the repo, or I know what they output, the next step is a small script that calls `upsert_audience` and `upsert_content` with their output.

### Key decisions and trade-offs

- **A documented CSV format, not one adapter per platform export.** Export formats change without notice, and some platforms (Spotify for Artists, Kick) have no public API for these numbers. One small, strictly checked format that any script or spreadsheet can produce is more durable than five parsers for formats I can't test.
- **Validation in two languages.** The rules exist in TypeScript (`api/src/rows.ts`) and Python (`ingest/fan_data.py`). That's duplication, but each side is about 30 lines, and the cross-check test above catches drift. The alternative, a JSON Schema shared by both, is more machinery than two files need.
- **Upsert instead of append.** Scripts get re-run, and an append-only file would double-count. A natural key (date + platform) makes re-runs safe. This idea is called idempotency.
- **Real data stays local.** `data/real/` was in `.gitignore` from Phase 0, and the docs say so up front.

### Interview questions

1. **How would you get data from five platforms into one model when some of them have no API?**
   I'd define one small, strict format (date, platform, number) and make everything produce it: API scripts where APIs exist, manual exports where they don't. A validator with line-numbered errors turns a messy manual process into a reliable one. The dashboard doesn't care where a row came from. In production, each source would be its own ingestion job writing to the same tables.

2. **What does "idempotent" mean, and where did you use it?**
   Doing the same operation twice has the same effect as doing it once. `upsert_audience` replaces the row for a date and platform instead of appending, so a daily script that runs twice, or a backfill that overlaps old data, can't double-count followers. In BigQuery the same idea is a `MERGE` statement on the natural key.

3. **You validate the same rules in Python and TypeScript. Isn't that a problem?**
   It's a known trade-off. The two validators are tiny and protect different entry points: Python checks before data is written or uploaded, and TypeScript checks what the API actually loads. To stop them drifting, a test loads the documented template files through the API's loader, and the Python tests check the same files. With a bigger schema, I'd generate both from one JSON Schema.

## Phase 5: Docker

### What was built

- **`Dockerfile`**: one image that serves the dashboard at `/`, GraphQL at `/graphql`, and `/healthz`, all on port 8080.
- **`.dockerignore`**: keeps `node_modules`, build output, `.git`, real data, Terraform files, and docs out of the build.
- **Express serves the built dashboard** (`api/src/app.ts`). Hashed files under `/assets/` are cached for a year; `index.html` is always re-checked. A test covers both headers.
- **New commands:** `npm run docker:build` (builds for `linux/amd64`, which Cloud Run needs) and `npm run docker:run`.

I verified it with `docker run -p 8080:8080`. The page, `/graphql` (90 days: +11,041), and `/healthz` all respond. The container runs as the `node` user, not root. The final image contains no TypeScript, Vite, or test tools. It's 84 MB compressed.

### The Dockerfile, stage by stage

1. **`deps`** starts from `node:22-bookworm-slim`, copies only `package.json` / `package-lock.json` files, and runs `npm ci`. Copying the package files before the source code is the key caching trick. Docker reuses a cached step when its inputs haven't changed, so editing a `.tsx` file doesn't re-download 250 packages.
2. **`build-web`** starts from `deps`, copies `web/`, and runs `vite build`. The output is plain HTML/CSS/JS in `web/dist`.
3. **`build-api`** starts from `deps`, copies `api/`, and runs `tsc`. The output is JavaScript in `api/dist`. Stages 2 and 3 don't depend on each other, so BuildKit runs them in parallel.
4. **`runtime`** starts fresh from the slim Node image. It installs only the API's production dependencies (`npm ci --omit=dev --workspace api`), then copies in just `api/dist`, `web/dist`, and `data/sample` from the earlier stages. Compilers and dev tools stay behind in stages that never ship.

### Key decisions and trade-offs

- **`node:22-bookworm-slim`, not Alpine or distroless.** Slim is Debian with glibc, so native modules behave exactly as on a normal Linux box. Alpine's musl libc occasionally breaks native packages, and distroless images are smaller but have no shell, which makes debugging harder while you're learning. Slim is the boring middle ground.
- **Sample data inside the image.** `docker run` works with no configuration. On Cloud Run, `DATA_SOURCE=bigquery` is set and the files are ignored.
- **No `HEALTHCHECK` in the Dockerfile.** Cloud Run ignores it and uses its own probes. `/healthz` is there for them.
- **A sandbox-only detail:** this build environment reaches npm through a proxy, so I verified the build with a temporary copy of the Dockerfile that passed proxy settings to `npm ci`. The committed Dockerfile has none of that and builds normally on a Mac or in CI.

### Interview questions

1. **Why a multi-stage build?**
   Building needs TypeScript, Vite, and hundreds of dev packages; running needs Node, the API's production dependencies, and the compiled files. Multi-stage builds do the heavy work in throwaway stages and copy only the results into a fresh, small final image. That means faster deploys and cold starts, and a smaller attack surface: tools that never ship can't be exploited in production.

2. **How does layer caching make builds faster, and how did you take advantage of it?**
   Each Dockerfile instruction produces a layer. If an instruction and its inputs are unchanged, Docker reuses the cached layer, and once one layer changes, every later one is rebuilt. So I copy the package manifests and run `npm ci` before copying any source code. Day-to-day code changes only invalidate the cheap build steps, not the dependency install.

3. **Why `--platform linux/amd64`, and why run as a non-root user?**
   The Mac mini is Apple Silicon (ARM), but Cloud Run runs x86-64 (amd64). An image built for ARM won't start there, so the build targets amd64 explicitly, using emulation if needed. Running as the `node` user follows least privilege: if someone found a bug that let them run code in the container, they wouldn't be root.

## Phase 6: Google Cloud with Terraform

### What was built

- **`api/src/bigquery-datasource.ts`**: the second `DataSource`. Each method is one SQL query with a typed `DATE` parameter (`WHERE date >= @since`). `FORMAT_DATE('%F', ...)` returns dates as `YYYY-MM-DD` strings, the same shape the CSV source returns. Table names can't be query parameters, so the project and dataset names are checked against a strict pattern before they go into the SQL.
- **`api/src/cached-datasource.ts`**: wraps any data source and remembers answers for 5 minutes. It caches the *promise*, so the four simultaneous "newest date" lookups in one page load become one query. Failures are never cached.
- **`DATA_SOURCE=bigquery`** in `config.ts`, configured with `BQ_PROJECT`, `BQ_DATASET`, `BQ_LOCATION`, `SAMPLE_DATA`, and `CACHE_SECONDS`.
- **`infra/` (Terraform)**:
  - the APIs the project needs
  - an Artifact Registry repository, with a cleanup policy that keeps the 5 newest images
  - the `fan_insights` dataset with `audience` and `content` tables (same columns as the CSVs)
  - a `fan-insights-run` service account that has only `bigquery.dataViewer` on the dataset and `bigquery.jobUser` on the project
  - a Cloud Run v2 service (scale to 0, at most 2 instances, CPU only during requests, `/healthz` startup probe) with public access
- **`ingest/load_to_bigquery.py`**: checks the files with the Phase 4 rules, normalizes them, and loads each table with `WRITE_TRUNCATE`.
- **`scripts/deploy.sh`**: Terraform init → create the APIs and registry → build and push the `linux/amd64` image tagged with the git commit → apply everything else → print the URL.
- **`docs/DEPLOY.md`**: the one-time setup (tools, project, billing, a $5 budget alert, login), the deploy, loading data, updating, tearing down, a Terraform primer (plan, apply, state), and a troubleshooting table.

There are 8 new API tests (the BigQuery source tested with a fake query runner, plus the cache) and 1 new Python test for the loader's preparation step.

**Not done here, on purpose:** nothing was created in Google Cloud. That needs Adem's account and billing, and the project rules say to ask before anything that could cost money. This sandbox also can't reach the Terraform registry, so `terraform validate` couldn't run here. CI (Phase 7) runs `terraform fmt -check` and `terraform validate` on GitHub instead.

### Key decisions and trade-offs

- **Least privilege.** The app's identity can read one dataset and run queries. It can't write data, see other datasets, or touch other services. It isn't the default compute service account, which has Editor on the whole project.
- **Replace instead of append when loading.** `WRITE_TRUNCATE` makes every load idempotent: the tables always equal the files. It re-uploads everything, which costs nothing at this size. At millions of rows, I'd load into a staging table and `MERGE` on (date, platform).
- **A 5-minute cache in the API.** The data changes at most daily. Caching cuts BigQuery queries per page view from about 8 to at most 1 per distinct question, and makes the page fast after the first view. The trade-off is that a fresh load can take up to 5 minutes to show.
- **Scale to zero.** It's free while idle. The cost is a cold start of a second or two for the first visitor after a quiet period. `min_instance_count = 1` would remove that for about $10 a month.
- **Local Terraform state.** Simple for one person, and the file is git-ignored. A team would use a GCS backend with locking.
- **Deploy order with `-target`.** The registry must exist before the image can be pushed, and Cloud Run needs the image. A `precondition` on the Cloud Run service gives a clear error if someone applies without an image.
- **Public access (`allUsers` as invoker).** It's a portfolio demo of read-only, non-sensitive data. For private data, I'd put it behind Identity-Aware Proxy instead.

### Interview questions

1. **What's the difference between `terraform plan` and `terraform apply`, and what is state?**
   `plan` compares the configuration with the real world, as recorded in state and refreshed from the cloud APIs, and prints the changes it would make without making any. `apply` computes the same plan, asks for confirmation, then makes the changes and updates the state. State is Terraform's map from resource names in code to real resource IDs. Without it, Terraform wouldn't know what it manages. That's why teams store it remotely with locking, and why it shouldn't be in git: it can contain secrets.

2. **How does the running app get permission to query BigQuery without any keys?**
   Cloud Run runs the container as the `fan-insights-run` service account. Google's client libraries use Application Default Credentials: inside Cloud Run they fetch short-lived tokens for that identity from the metadata server, so no key file exists anywhere. Terraform grants that account exactly two roles: read the `fan_insights` dataset, and run query jobs in the project. On my laptop, the same code uses my own credentials from `gcloud auth application-default login`.

3. **How do you keep the BigQuery queries safe and cheap?**
   Safe: values go in as typed query parameters (`@since` as a `DATE`), never by building SQL strings from input. Table names, which can't be parameters, are checked against a strict pattern. Cheap: BigQuery bills by bytes scanned (10 MB minimum per query) with 1 TB a month free, the tables are tiny, and the API caches results for 5 minutes and merges duplicate in-flight queries. With large tables, I'd partition `audience` by `date`, so `WHERE date >= @since` only scans the partitions it needs.

## Phase 7: CI

### What was built

`.github/workflows/ci.yml` runs on every push and pull request, with three jobs that run in parallel:

| Job | What it checks |
|---|---|
| **Typecheck, test, build** | `npm ci` (fails if `package.json` and the lockfile disagree), `npm run typecheck`, `npm test` (Vitest for api/ and web/, plus the Python `unittest` suite), `npm run build` |
| **Terraform format and validate** | `terraform fmt -check`, then `terraform init -backend=false` and `terraform validate`. This sandbox couldn't reach the Terraform registry, so these checks run for the first time here |
| **Docker image builds** | `docker build --platform linux/amd64`, so the Dockerfile can't silently break. Nothing is pushed |

Before committing, I ran the app job's commands in a fresh clone of the branch. That catches anything that only works because of leftover local files, such as a git-ignored file the build quietly depends on.

### Key decisions and trade-offs

- **CI checks, it doesn't deploy.** Deploying from CI would mean storing Google Cloud credentials in GitHub, ideally through Workload Identity Federation so no long-lived key exists. That's a good next step, but deploys stay a deliberate `scripts/deploy.sh` for now, while billing is new.
- **Read-only token and cancel-on-push.** `permissions: contents: read` gives the workflow's token the minimum it needs. `concurrency` cancels a run when a newer commit arrives on the same branch.
- **`node-version-file: .nvmrc`** keeps CI on the same Node version as local development, from one source of truth.
- **The Docker job costs about a minute per push.** That's worth it, because the Dockerfile is otherwise only exercised at deploy time, which is the worst moment to find it broken.

### Interview questions

1. **What does your CI pipeline check, and why those things?**
   Types, tests, and the production build for both packages; Python tests for the ingest scripts; Terraform formatting and validity; and that the Docker image builds. Together that's everything that could break a deploy, checked on every pull request, so `main` stays deployable. I also used `npm ci` instead of `npm install`, so a lockfile out of sync with `package.json` fails loudly.

2. **Why `npm ci` in CI instead of `npm install`?**
   `npm ci` installs exactly what `package-lock.json` says, deletes any existing `node_modules` first, and never changes the lockfile. If the lockfile doesn't match `package.json`, it fails instead of quietly resolving new versions. That makes CI reproducible: the versions tested are the versions that ship.

3. **How would you add continuous deployment safely?**
   Add a deploy job that runs only on pushes to `main` after the checks pass. Authenticate to Google Cloud with Workload Identity Federation: GitHub's OIDC token is exchanged for short-lived credentials, so no service account key is stored as a secret. Give that deploy identity only the roles it needs (push to Artifact Registry, deploy Cloud Run, apply Terraform), and keep Terraform state in a shared GCS bucket so CI and laptops see the same state.

## Phase 8: Polish, and the 60-second story

### What was built

- **`README.md`**: what the project is, a screenshot, a Mermaid architecture diagram, the stack, how to run it, a repository tour, and "What I would build next". The live URL appears there once `scripts/deploy.sh` has run.
- **`docs/screenshot.png` and `docs/screenshot-dark.png`**: taken in headless Chromium from the running app on sample data.
- **A CI badge** in the README.

The first CI run on GitHub passed all three jobs, including `terraform fmt -check` and `terraform validate`, which couldn't run in the build sandbox.

### The project in 60 seconds

> I built Fan Insights Lite, a dashboard for an independent artist that shows how their audience is growing across Spotify, YouTube, Twitch, Kick, and TikTok, where their fans are, and what broke out. I built it to mirror the Artist Success stack: React and TypeScript on the front end, GraphQL in the middle, BigQuery for data, and Terraform and containers on Google Cloud.
>
> The part I'm proudest of is the insight logic. It's a set of pure functions with tests. "Broke out" means at least 2.5 times the *median* views for that platform. I can show why the median matters with the project's own data: measured against the average, the biggest release of the quarter drops off the list, because it inflates its own baseline. The headline is written from the data and is careful with words; it only says "most of your fans came from TikTok" when that's actually true.
>
> Architecturally, the resolvers depend on a `DataSource` interface, so the same API runs on CSV files locally and on BigQuery in production. The BigQuery version uses parameterized SQL and a small promise cache, so one page load is one or two queries instead of eight. The whole app ships as one multi-stage Docker image on Cloud Run, scaling to zero, running as a service account that can read one dataset and nothing else, all defined in Terraform. CI runs type checks, about 70 tests across TypeScript and Python, Terraform validation, and a Docker build on every pull request.
>
> I built it with an AI pair programmer, phase by phase, one pull request each. My job was to make every decision explainable. The build log in the repo has the trade-offs for each phase. For example, I chose the hand-written CSV parser and `WRITE_TRUNCATE` loads for simplicity, and I wrote down what I'd change at scale.

### Interview questions

1. **What would you change if this had 10,000 artists instead of one?**
   Partition the `audience` table by date and cluster it by artist and platform, so queries scan only what they need. Move the insight math into SQL (median with `APPROX_QUANTILES`, gains with window functions), so the API doesn't pull raw rows. Replace `WRITE_TRUNCATE` with incremental `MERGE` loads from scheduled jobs. Add an `artistId` argument to every query, with authorization so artists see only their own data. Cache per artist at the API, and use a GraphQL DataLoader if resolvers start fetching per item.

2. **How did you use AI in building this, and how do you know the code is right?**
   I used Claude Code as a pair programmer, working one phase at a time against a written spec (`CLAUDE.md`). I didn't take output on trust; everything was checked. There are about 70 automated tests, and the expected numbers come from an independent calculation (Python's csv module and statistics). A colorblind-safety validator checked the palette. Screenshots in light, dark, and phone layouts were reviewed by eye. CI re-checks everything, including Terraform, on GitHub. Several real bugs were caught this way: a sample-data design that created false breakouts, a chart axis wasting a fifth of its height, and an interview answer that overstated a claim.

3. **What's a decision you'd revisit?**
   Validation exists in both TypeScript and Python. It's small and cross-checked by a test today, but a growing schema would make the duplication risky, so I'd generate both from one JSON Schema. I'd also revisit scale-to-zero once real people use the page: a cold start costs a second or two, and one warm instance costs about $10 a month.
