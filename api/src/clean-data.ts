// Checks a data folder and writes cleaned copies of its two CSV files, ready
// for `bq load`. Used by scripts/load-bq.sh.
//
//   tsx api/src/clean-data.ts data/real /tmp/clean
//
// bq loads CSV columns by position and stores text exactly as written, so a
// raw export with "Spotify" or reordered columns would load wrong. Running the
// files through the same parser the API uses fixes both: platform names come
// out lowercase, spaces trimmed, columns in table order. Any problem stops the
// load before anything is uploaded, with the line to fix.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { audienceToCsv, contentToCsv, DataError, parseAudienceCsv, parseContentCsv } from './rows.js';

const [inputDir, outputDir] = process.argv.slice(2);
if (!inputDir || !outputDir) {
  console.error('Usage: tsx api/src/clean-data.ts INPUT_DIR OUTPUT_DIR');
  process.exit(2);
}

try {
  const audiencePath = join(inputDir, 'audience.csv');
  const contentPath = join(inputDir, 'content.csv');
  const audience = parseAudienceCsv(readFileSync(audiencePath, 'utf8'), audiencePath);
  const content = parseContentCsv(readFileSync(contentPath, 'utf8'), contentPath);

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, 'audience.csv'), audienceToCsv(audience));
  writeFileSync(join(outputDir, 'content.csv'), contentToCsv(content));
  // Row counts on stdout, so the load script can compare them with BigQuery.
  console.log(`${audience.length} ${content.length}`);
} catch (error) {
  console.error(error instanceof DataError ? error.message : String(error));
  process.exit(1);
}
