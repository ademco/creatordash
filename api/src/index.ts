// Entry point: read settings from the environment, build the app, listen.

import { createApp } from './app.js';
import { createDataSource } from './config.js';

const port = Number(process.env.PORT ?? 4000);
const dataSource = createDataSource(process.env);
const app = await createApp(dataSource);

const { source } = await dataSource.info();
app.listen(port, () => {
  console.log(`Fan Insights API reading ${source}`);
  console.log(`GraphQL: http://localhost:${port}/graphql  Health: http://localhost:${port}/healthz`);
});
