#!/usr/bin/env node
// Writes MADE-UP sample data for Fan Insights Lite.
//
// Every number this script produces is synthetic. It exists so the API and the
// dashboard can be built and demoed before real analytics are connected (Phase 4).
//
// Output (overwritten on every run):
//   data/sample/audience.csv  one row per platform per day, 180 days
//   data/sample/content.csv   one row per release, video, stream, or short
//
// The output is deterministic: a seeded random number generator and a fixed end
// date mean every run writes byte-identical files, so tests and screenshots built
// on this data never drift.
//
// Usage: npm run sample-data

import { mkdirSync, writeFileSync } from 'node:fs';

const SEED = 20261005;
// Fixed instead of "today": the app counts windows back from the newest date in
// the data, so a fixed date keeps the output identical no matter when you run it.
const END_DATE = '2026-09-30';
const DAYS = 180;
const OUT_DIR = new URL('../data/sample/', import.meta.url);

// Starting audience, typical daily change, and how much that change wobbles.
// Spotify is monthly listeners, which can fall day to day; the others are
// followers or subscribers, which mostly go up.
const PLATFORMS = {
  spotify: { start: 11800, dailyGain: 9, dailyNoise: 45 },
  youtube: { start: 8400, dailyGain: 6, dailyNoise: 4 },
  twitch: { start: 3100, dailyGain: 3, dailyNoise: 3 },
  kick: { start: 850, dailyGain: 2, dailyNoise: 1.5 },
  tiktok: { start: 14500, dailyGain: 14, dailyNoise: 9 },
};
const PLATFORM_ORDER = Object.keys(PLATFORMS);

const RELEASES = [
  'Neon Psalm', 'Cold Coffee, Warm Hands', 'Tidewater', 'Static Bloom', 'Paper Moons',
  'Low Battery', 'Rooftop Static', 'Ghost Notes, Pt. 2', 'Northbound', 'Satellite Hearts',
];
const VIDEO_TOPICS = [
  'How I mix vocals at home, start to finish', 'Studio vlog: a week of nothing working',
  'Flipping a 1970s sample into a beat', "Gear tour (it's mostly cables)",
  'Reacting to your covers of "Neon Psalm"', 'Writing a hook in 20 minutes',
  'Why my old songs sound like that', 'Making drums from kitchen sounds',
  'Q&A: "how do you actually finish songs?"',
];
const SHORT_HOOKS = [
  'POV: the hook finally lands', 'Turning a fan comment into a beat', '3 sounds, 1 beat, 60 seconds',
  'Rating my first songs (be nice)', 'This chord does something to me', 'Before vs. after the mix',
  'Guess the sample', 'Making a beat on the train', 'The car test', 'Finishing your lyrics, live',
];

// Cycles through a list of titles, adding "pt. 2", "pt. 3" once it runs out,
// the way creators number a recurring series.
function seriesTitle(titles, n) {
  const title = titles[(n - 1) % titles.length];
  const round = Math.floor((n - 1) / titles.length) + 1;
  return round === 1 ? title : `${title}, pt. ${round}`;
}

// How often each platform gets new content, and the views a normal post gets
// (streams for releases, views for videos and shorts, peak viewers for streams).
const SCHEDULE = [
  { platform: 'spotify', contentType: 'release', firstDay: 5, everyDays: 18, typicalViews: 9000,
    title: (n) => seriesTitle(RELEASES, n) },
  { platform: 'youtube', contentType: 'video', firstDay: 2, everyDays: 7, typicalViews: 2400,
    title: (n) => seriesTitle(VIDEO_TOPICS, n) },
  { platform: 'twitch', contentType: 'stream', firstDay: 1, everyDays: 3, typicalViews: 85,
    title: (n) => (n % 7 === 0 ? 'Chill stream: lo-fi, chat, and your demos' : `Beat-making stream #${n}`) },
  { platform: 'kick', contentType: 'stream', firstDay: 4, everyDays: 7, typicalViews: 40,
    title: (n) => `Production Q&A, live #${n}` },
  { platform: 'tiktok', contentType: 'short', firstDay: 0, everyDays: 2, typicalViews: 6500,
    title: (n) => seriesTitle(SHORT_HOOKS, n) },
];

// Content that took off. Each one gets `multiple` times the usual views and
// brings in `lift` extra followers over the following days, so breakouts visibly
// bend the growth lines. A breakout can lift other platforms too: a viral short
// sends people to Spotify. `day` counts from the first day of the data (0..179).
const BREAKOUTS = [
  { day: 40, platform: 'tiktok', contentType: 'short', multiple: 7.5,
    title: 'POV: you hum a melody and I finish the song', lift: { tiktok: 2600, spotify: 400 } },
  { day: 95, platform: 'kick', contentType: 'stream', multiple: 4.0,
    title: 'Album listening party, every track, no skips', lift: { kick: 350 } },
  { day: 113, platform: 'spotify', contentType: 'release', multiple: 4.5,
    title: 'Glass Houses', lift: { spotify: 3200, tiktok: 300 } },
  { day: 128, platform: 'youtube', contentType: 'video', multiple: 5.1,
    title: 'I made a beat using only subway sounds', lift: { youtube: 900 } },
  { day: 151, platform: 'twitch', contentType: 'stream', multiple: 4.0,
    title: '24-hour charity stream, part 1', lift: { twitch: 650 } },
  { day: 164, platform: 'tiktok', contentType: 'short', multiple: 6.3,
    title: 'Fan duet: "Glass Houses", acoustic', lift: { tiktok: 1900, spotify: 600 } },
];

// Share of a breakout's lift that arrives each day after it. Most new fans show up
// in the first week, then it tails off (0.2, 0.16, 0.128, ...; the total is 1).
const LIFT_DECAY = 0.8;

// Normal posts vary, but never past 1.8x usual, so only the planned breakouts
// cross the dashboard's 2.5x "broke out" line.
const MAX_NORMAL_MULTIPLE = 1.8;

// Mulberry32: a tiny seeded random number generator. Math.random() cannot be
// seeded, so it would give different data on every run.
function mulberry32(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller transform: turns two uniform random numbers into one bell-curve
// number (mean 0, standard deviation 1), which looks more like real daily noise.
function gaussian(random) {
  const u = 1 - random(); // never 0, so log() stays finite
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const DAY_MS = 24 * 60 * 60 * 1000;
const endMs = Date.parse(`${END_DATE}T00:00:00Z`);

function dateForDay(day) {
  return new Date(endMs - (DAYS - 1 - day) * DAY_MS).toISOString().slice(0, 10);
}

function breakoutLiftByPlatform() {
  const extra = Object.fromEntries(PLATFORM_ORDER.map((p) => [p, new Array(DAYS).fill(0)]));
  for (const breakout of BREAKOUTS) {
    for (const [platform, total] of Object.entries(breakout.lift)) {
      for (let k = 0; breakout.day + k < DAYS; k++) {
        extra[platform][breakout.day + k] += total * (1 - LIFT_DECAY) * LIFT_DECAY ** k;
      }
    }
  }
  return extra;
}

// Returns { platform: [audience on day 0, day 1, ...] } with unrounded values.
function generateAudience(random) {
  const extra = breakoutLiftByPlatform();
  const series = {};
  for (const platform of PLATFORM_ORDER) {
    const { start, dailyGain, dailyNoise } = PLATFORMS[platform];
    let audience = start;
    series[platform] = [];
    for (let day = 0; day < DAYS; day++) {
      if (day > 0) audience += dailyGain + dailyNoise * gaussian(random) + extra[platform][day];
      series[platform].push(audience);
    }
  }
  return series;
}

function generateContent(random, audience) {
  // Views grow with the audience, but more slowly (square root): a post reaches
  // more people once you have more fans, without later posts all looking like hits.
  const reach = (platform, day) => Math.sqrt(audience[platform][day] / PLATFORMS[platform].start);
  const breakoutAt = new Map(BREAKOUTS.map((b) => [`${b.platform}:${b.day}`, b]));
  const items = [];

  for (const breakout of BREAKOUTS) {
    const { typicalViews } = SCHEDULE.find((s) => s.platform === breakout.platform);
    items.push({
      day: breakout.day,
      platform: breakout.platform,
      contentType: breakout.contentType,
      title: breakout.title,
      views: Math.round(typicalViews * reach(breakout.platform, breakout.day) * breakout.multiple),
    });
  }

  for (const entry of SCHEDULE) {
    let n = 0;
    for (let day = entry.firstDay; day < DAYS; day += entry.everyDays) {
      // A breakout takes this slot, so a platform never posts twice in one day.
      if (breakoutAt.has(`${entry.platform}:${day}`)) continue;
      n += 1;
      const variation = Math.min(MAX_NORMAL_MULTIPLE, Math.exp(0.3 * gaussian(random)));
      items.push({
        day,
        platform: entry.platform,
        contentType: entry.contentType,
        title: entry.title(n),
        views: Math.max(1, Math.round(entry.typicalViews * reach(entry.platform, day) * variation)),
      });
    }
  }

  return items.sort(
    (a, b) => a.day - b.day || PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform),
  );
}

// RFC 4180 CSV: quote a field if it holds a comma, quote, or newline, and double
// any quotes inside it. Titles like 'Cold Coffee, Warm Hands' depend on this.
function csvField(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(header, rows) {
  return [header, ...rows].map((row) => row.map(csvField).join(',')).join('\n') + '\n';
}

// Separate generators per table, so changing the content schedule does not
// reshuffle the audience numbers (and the other way round).
const audience = generateAudience(mulberry32(SEED));
const content = generateContent(mulberry32(SEED + 1), audience);

const audienceRows = [];
for (let day = 0; day < DAYS; day++) {
  for (const platform of PLATFORM_ORDER) {
    audienceRows.push([dateForDay(day), platform, Math.round(audience[platform][day])]);
  }
}
const contentRows = content.map((c) => [dateForDay(c.day), c.platform, c.contentType, c.title, c.views]);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(new URL('audience.csv', OUT_DIR), toCsv(['date', 'platform', 'audience'], audienceRows));
writeFileSync(
  new URL('content.csv', OUT_DIR),
  toCsv(['published_date', 'platform', 'content_type', 'title', 'views'], contentRows),
);

console.log(
  `Wrote ${audienceRows.length} audience rows and ${contentRows.length} content rows ` +
    `(${dateForDay(0)} to ${END_DATE}) to data/sample/. All numbers are made up.`,
);
