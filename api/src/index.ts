// Entry point: read settings from the environment, build the app, listen.

import { resolve } from 'node:path';

import { createApp } from './app.js';
import { createDataSource, createNewsSource, REPO_ROOT } from './config.js';

const port = Number(process.env.PORT ?? 4000);
const dataSource = createDataSource(process.env);
// Serves the built dashboard when web/dist exists (it does in the Docker image).
const webDir = resolve(REPO_ROOT, process.env.WEB_DIR ?? 'web/dist');
const app = await createApp(dataSource, { webDir, news: createNewsSource(process.env) });

const { source } = await dataSource.info();
app.listen(port, () => {
  console.log(`Fan Insights API reading ${source}`);
  console.log(`GraphQL: http://localhost:${port}/graphql  Health: http://localhost:${port}/healthz`);
  console.log(`Dashboard: http://localhost:${port}/ (when web/dist is built)`);
});
