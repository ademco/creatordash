# Using your real numbers

The dashboard reads two CSV files from a folder. Sample data lives in `data/sample/`. Put your real numbers in `data/real/`. Git ignores that folder, so your stats never get committed or pushed.

## Quick start

```bash
mkdir -p data/real && cp data/templates/*.csv data/real/   # start from the templates
npm run check-data -- data/real                             # finds typos before the dashboard does
npm run dev:real                                            # dashboard on http://localhost:5173
```

Replace the example rows in the templates with your own. The dashboard re-reads the files when they change, so just refresh the page.

## The two files

**`audience.csv`** has one row per platform per day. You don't need every day. Weekly rows work too: the growth chart connects the points, and gains are measured from the first row to the last row in the window.

```csv
date,platform,audience
2026-10-01,spotify,18500
2026-10-01,tiktok,21700
```

- `date`: `YYYY-MM-DD`
- `platform`: `spotify`, `youtube`, `twitch`, `kick`, or `tiktok` (any capitalization)
- `audience`: Spotify monthly listeners, YouTube subscribers, or followers on Twitch, Kick, and TikTok. Whole numbers only, with no commas: `18500`, not `18,500` or `18.5K`.

**`content.csv`** has one row per release, video, stream, or short.

```csv
published_date,platform,content_type,title,views
2026-09-26,spotify,release,Northbound,15200
2026-09-28,youtube,video,"Studio vlog: mixing, mastering, and coffee",2900
```

- `content_type`: `release`, `video`, `stream`, or `short`
- `title`: if it contains a comma, wrap it in double quotes. A quote inside a title is written twice: `"Fan duet: ""Glass Houses"""`. Spreadsheet apps do this for you when you save as CSV.
- `views`: streams for releases, views for videos and shorts, peak viewers for streams

**Make views comparable.** Breakouts compare each post with the median for its platform. If old videos have had years to collect views and new ones only days, the old ones will look like hits. Use the same measuring period for everything when the platform offers one, for example views in the first 7 or 28 days.

## Where to get the numbers

Platform menus change often, so treat these as pointers, not exact click paths. Look for an **Export** or **Download** button on each analytics page.

| Platform | Audience number | Content numbers | Notes |
|---|---|---|---|
| Spotify for Artists | Audience → monthly listeners over time | Music → per-song streams | The web app has CSV export on most charts. There's no public API for these numbers, so a monthly manual export is normal. |
| YouTube Studio | Analytics → Audience → subscribers | Analytics → Content → views per video | "Advanced mode" exports CSV. The YouTube Analytics API is an option for automating later. |
| Twitch | Creator Dashboard → Insights → followers | Stream summary → peak viewers per stream | Export is limited; you may need to write down follower counts weekly. |
| Kick | Creator dashboard → followers | Past streams → peak viewers | Usually manual. |
| TikTok | Creator tools / TikTok Studio → Analytics → followers | Per-video views | Analytics exports cover a limited recent window, so export regularly. |

## From your own Python scripts

If you already have scripts that pull these numbers, `ingest/fan_data.py` writes them in exactly the right format. It uses only the Python standard library.

```python
import sys
sys.path.insert(0, "ingest")  # or copy fan_data.py next to your script
from fan_data import upsert_audience, upsert_content

upsert_audience("data/real", [
    {"date": "2026-10-05", "platform": "spotify", "audience": 18500},
    {"date": "2026-10-05", "platform": "tiktok", "audience": 21980},
])
upsert_content("data/real", [
    {"published_date": "2026-10-04", "platform": "youtube", "content_type": "video",
     "title": "Mixing, mastering, and coffee", "views": 3100},
])
```

"Upsert" means add or replace. Running the same script twice updates the numbers instead of adding duplicate rows. Audience rows are matched on date and platform; content rows on date, platform, and title. Each row is checked before anything is written.

From the terminal:

```bash
python3 ingest/fan_data.py add-audience data/real 2026-10-05 spotify 18500
python3 ingest/fan_data.py add-content data/real 2026-10-04 youtube video "My new video" 3100
```

## In the cloud

Once deployed (see `docs/DEPLOY.md`), load the same two files into BigQuery and turn off the "sample data" note:

```bash
npm run load-bq -- YOUR_PROJECT_ID data/real
SAMPLE_DATA=false scripts/deploy.sh YOUR_PROJECT_ID
```

`load-bq` checks and cleans the files with the API's own parser first (lowercase platforms, trimmed spaces, columns in table order), so a mistake stops it before anything is uploaded. It needs only gcloud, bq, and Node. `ingest/load_to_bigquery.py` does the same checks if you prefer Python.
