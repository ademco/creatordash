import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import express from 'express';

import type { DataSource } from './datasource.js';
import { resolvers, type Context } from './resolvers.js';
import { typeDefs } from './schema.js';

export interface AppOptions {
  /** Folder with the built dashboard (web/dist). When set, the app serves it at /. */
  webDir?: string | undefined;
}

/**
 * Builds the Express app: GraphQL at /graphql, a health check at /healthz, and
 * (in production) the built dashboard at /. Kept separate from index.ts, which
 * reads env vars and listens on a port, so tests can start the real app on a
 * random port.
 */
export async function createApp(dataSource: DataSource, options: AppOptions = {}): Promise<express.Express> {
  const apollo = new ApolloServer<Context>({
    typeDefs,
    resolvers,
    // The data is read-only and the schema is the documentation, so keep
    // introspection on even in production; Apollo turns it off there by default.
    introspection: true,
  });
  await apollo.start();

  const app = express();

  // Cloud Run and Docker call this to check the server is up. It deliberately
  // does not touch the data source, so a slow BigQuery query cannot make the
  // platform think the container is dead.
  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/graphql', express.json(), expressMiddleware(apollo, { context: async () => ({ dataSource }) }));

  // One container serves the page and the API from the same origin, so the
  // browser needs no CORS rules (in development, Vite's proxy does the same job).
  if (options.webDir && existsSync(join(options.webDir, 'index.html'))) {
    app.use(
      express.static(options.webDir, {
        setHeaders(res, path) {
          // Vite puts a content hash in every asset file name, so a changed file
          // gets a new name and old ones can be cached forever. index.html keeps
          // its name, so browsers must check for a new version each time.
          res.setHeader('Cache-Control', path.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
        },
      }),
    );
  }

  return app;
}
