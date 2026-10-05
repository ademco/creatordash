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
