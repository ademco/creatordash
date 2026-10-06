# Fan Insights Lite

A small fan-insights dashboard for an independent music artist and creator (Adem, who performs as Regiwock). It shows how his audience grows across Spotify, YouTube, Twitch, Kick, and TikTok, where his fans are, and which releases, videos, or streams broke out.

It is a portfolio project for a Senior Full-Stack Engineer role on SoundCloud's Artist Success team (A&R Dashboard, Fan Insights). The stack mirrors that job posting on purpose: React, TypeScript, GraphQL, BigQuery/SQL, Terraform, containers, and AI-assisted engineering.

## How to work with Adem

Adem is building this with you to learn the stack and must be able to explain every part in an interview. He knows Python, SQL, Java/Spring Boot, some React, Git, and GitHub Actions. He is new to TypeScript, GraphQL, Docker, Terraform, and Google Cloud.

- Work one phase at a time (see Build plan). Do not start the next phase until he says go.
- At the start of each phase, explain in a few plain sentences what you are about to build and why.
- At the end of each phase:
  1. Run typecheck, tests, and build. Fix failures before calling the phase done.
  2. Commit with a clear message (`phase N: ...`).
  3. Append a section to `docs/BUILD_LOG.md`: what was built, the key decisions and trade-offs, and 3 interview questions he could get about this phase with short model answers.
  4. Tell him exactly how to see the result (one command or one URL).
- Give him complete, ready-to-run commands. Never ask him to hand-edit a file; make the change yourself.
- Ask before: installing anything system-wide, creating cloud resources, linking billing, or anything that could cost money.
- Prefer boring, well-documented choices over clever ones. Small files, clear names, comments that explain why rather than what.
- Check current package versions with `npm view <pkg> version` before installing. Notes below were accurate in Oct 2026.

## Machine

Mac mini, Apple Silicon, 8 GB RAM, macOS. Use Homebrew for system tools. Cloud Run needs `linux/amd64` images, so build with `docker buildx build --platform linux/amd64`. Keep memory use modest (one dev server per package, no heavy local databases).

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Monorepo | npm workspaces: `api/`, `web/` | Node 22 (`.nvmrc`) |
| API | TypeScript, Express 5, Apollo Server 5 | Express integration is `@as-integrations/express5`; Apollo Server 5 wants `graphql@^16.11` |
| Data access | `DataSource` interface with two implementations | `LocalDataSource` (CSV files) and `BigQueryDataSource` (`@google-cloud/bigquery`), chosen by `DATA_SOURCE=local|bigquery` |
| Tests | Vitest | Unit tests for all insight logic and the CSV parser |
| Web | React 19, TypeScript, Vite, Apollo Client 4, Recharts | Apollo Client 4: `ApolloProvider` and `useQuery` import from `@apollo/client/react`; needs `rxjs` |
| Ingest | Python 3 script | Loads CSVs into BigQuery |
| Container | One Docker image | Express serves `/graphql`, `/healthz`, and the built web app |
| Cloud | Google Cloud Run, BigQuery, Artifact Registry | All defined in Terraform under `infra/` |
| CI | GitHub Actions | Typecheck, test, build on every push |

## Data model

Two tables (CSV files locally, BigQuery tables in the cloud). Same column names in both.

`audience`: one row per platform per day.

| column | type | meaning |
|---|---|---|
| date | DATE | YYYY-MM-DD |
| platform | STRING | spotify, youtube, twitch, kick, tiktok |
| audience | INT64 | followers, subscribers, or Spotify monthly listeners that day |

`content`: one row per release, video, stream, or short.

| column | type | meaning |
|---|---|---|
| published_date | DATE | YYYY-MM-DD |
| platform | STRING | same values as above |
| content_type | STRING | release, video, stream, short |
| title | STRING | may contain commas, so the CSV parser must handle quoted fields |
| views | INT64 | streams, views, or peak viewers |

Time windows ("last 30 days") count back from the newest date in the data, not from today, so old exports and sample data still render.

## Insight logic (put it in `api/src/insights.ts` as pure, tested functions)

- **Audience series**: one series per platform, points sorted by date, platforms ordered by latest audience (largest first).
- **Platform breakdown**: per platform, latest audience, share of combined audience (0 to 1), and gain across the window (last minus first).
- **Overview**: combined audience (sum of latest per platform; a fan on two platforms counts twice, and the UI must say so), total gained, and the platform with the biggest gain (null if nothing grew).
- **Breakouts**: content whose views are at least `minMultiple` (default 2.5) times the median views for its platform in the window. Use the median, not the mean, so one viral post does not hide the next. Skip platforms with fewer than 3 items. Sort by multiple, highest first.

## GraphQL schema (starting point)

```graphql
type Overview { days: Int!, combinedAudience: Int!, gained: Int!, topPlatform: String, topPlatformGained: Int! }
type AudiencePoint { date: String!, audience: Int! }
type AudienceSeries { platform: String!, points: [AudiencePoint!]! }
type PlatformShare { platform: String!, audience: Int!, share: Float!, gained: Int! }
type Breakout { title: String!, platform: String!, contentType: String!, publishedDate: String!, views: Int!, typicalViews: Int!, multiple: Float! }

type Query {
  overview(days: Int = 30): Overview!
  audienceGrowth(days: Int = 90): [AudienceSeries!]!
  platformBreakdown(days: Int = 30): [PlatformShare!]!
  breakouts(days: Int = 90, minMultiple: Float = 2.5): [Breakout!]!
}
```

Clamp `days` to 1..365. Add descriptions to the schema types so the API documents itself.

## Dashboard design

The person using it is an artist checking how they are doing, not an analyst. Plain language everywhere.

- **Top**: a one-sentence summary as the headline, written from the data. Example: "You picked up 3,412 fans in the last 90 days. Most of them came from TikTok (+1,204)." A smaller line under it with the combined audience. Window picker (30 / 90 / 180 days) in the top bar.
- **Growth chart**: one line per platform, a toggle between "Growth" (gain since the start of the window, the default) and "Total", and platform chips that show or hide each line.
- **Two columns below**: "Where your fans are" (horizontal share bars with latest audience and gain) and "What broke out" (ranked list: multiple like "4.1×", title, platform, date, views against the usual).
- Clear loading, empty, and error states that say what to do next.
- Palette: paper `#F2F1F6`, ink `#191633`, muted `#6B6785`, rule `#D9D6E4`. Platform colors: spotify `#1F7A5A`, youtube `#D1452F`, twitch `#6B4BD6`, kick `#B58A00`, tiktok `#1E6FB8`. Provide a dark theme via `prefers-color-scheme` with tuned versions of the same colors. Define colors as CSS variables and resolve them in JS for the SVG chart so both themes work.
- Type: Bricolage Grotesque for the headline and headings, Instrument Sans for body (Google Fonts, with system fallbacks).
- Left-aligned, max width around 1100px, responsive down to phone width, visible keyboard focus, respects reduced motion. No card-grid look, no gradients, no all-caps labels.

## Build plan

Each phase ends with passing checks, a commit, and a BUILD_LOG entry.

0. **Setup**: check for Node 22, npm, and git (install with Homebrew if missing, after asking). Create the npm workspace, `.gitignore`, `.nvmrc`, `git init`. Ask Adem whether to create a public GitHub repo now (use `gh` if installed).
1. **Sample data**: `scripts/generate-sample-data.mjs` writes deterministic synthetic data to `data/sample/audience.csv` and `data/sample/content.csv` (180 days, 5 platforms, a few built-in breakouts that lift audience growth). Clearly labeled as made-up numbers.
2. **API**: types, CSV parser, `LocalDataSource`, insight functions with Vitest tests, GraphQL schema and resolvers, Express server on port 4000 with `/graphql` and `/healthz`. Done when `npm test` passes and a query from Apollo Sandbox returns data.
3. **Dashboard**: the React app above, with Vite proxying `/graphql` to the API. Root `npm run dev` runs both. Done when the dashboard works at http://localhost:5173 in light and dark mode and at phone width.
4. **Real data**: ask Adem where his existing Python analytics scripts are and what they output. Write an adapter or a documented CSV template so his real numbers fit the data model. Spotify for Artists numbers may need a manual export. Keep real data out of git (`data/real/` ignored).
5. **Docker**: multi-stage Dockerfile (build web, build api, slim Node runtime), `.dockerignore`, Express serves the web build. Done when `docker run -p 8080:8080` serves the full app locally. Explain each Dockerfile stage to Adem.
6. **Google Cloud with Terraform**: before creating anything, walk Adem through creating a GCP project and linking billing, and set a small budget alert. Then Terraform in `infra/`: enable APIs, Artifact Registry repo, BigQuery dataset `fan_insights` with `audience` and `content` tables, a service account with only BigQuery data viewer on the dataset plus BigQuery job user on the project, and a Cloud Run v2 service (`DATA_SOURCE=bigquery`, scale to zero, public URL). Add `ingest/load_to_bigquery.py` and a `scripts/deploy.sh` that applies infra, builds and pushes the amd64 image, and deploys. Explain `plan` versus `apply` and what state is. Done when the public URL shows the dashboard reading from BigQuery.
7. **CI**: GitHub Actions workflow that runs typecheck, tests, and build on push and pull requests.
8. **Polish**: README with what it is, a Mermaid architecture diagram, a screenshot, the live URL, how to run it, and a short "What I would build next" section. Final BUILD_LOG entry summarizing the whole project as a 60-second interview story.

Stretch ideas, only if Adem asks: an A&R view comparing several artists (check what the Spotify Web API currently allows before planning it), a release-impact view (audience change in the 7 days after each release), a scheduled job that refreshes data daily.

## Git workflow

- `main` is the default branch and always passes typecheck, tests, and build.
- Each phase is built on a feature branch and lands in `main` as one pull request titled `phase N: ...`. The description summarizes the phase and points to its BUILD_LOG section.
- Adem reviews and merges each PR with "Squash and merge", so `main` reads as one commit per phase.

## Commands (fill in as they are created)

- `npm run dev`: API (http://localhost:4000/graphql) and dashboard (http://localhost:5173) together
- `npm test`: unit tests
- `npm run typecheck`
- `npm run build`
- `npm run sample-data`: regenerate the made-up data in `data/sample/`
- `npm run dev:real`: same, reading your real numbers from `data/real/` (see `docs/REAL_DATA.md`)
- `NEWS_SOURCE=fixture npm run dev`: same, but with offline placeholder headlines instead of the live news feeds (default is `live`)
- `npm run check-data -- data/real`: check a data folder for problems
- `npm run docker:build` then `npm run docker:run`: the production image at http://localhost:8080
- `scripts/deploy.sh PROJECT_ID`: deploy to Google Cloud (read `docs/DEPLOY.md` first)
- `npm run load-bq -- PROJECT_ID [data/real]`: check and clean CSVs, load them into BigQuery with gcloud and bq (no Python), check row counts, and wait for the live API to show them
- `python3 ingest/load_to_bigquery.py --project PROJECT_ID --data data/sample`: load CSVs into BigQuery
- `npm run dev -w api`: API only, at http://localhost:4000/graphql (Apollo Sandbox)
