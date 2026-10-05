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
