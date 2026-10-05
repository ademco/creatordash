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
