import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import express from 'express';

import type { DataSource } from './datasource.js';
import { resolvers, type Context } from './resolvers.js';
import { typeDefs } from './schema.js';

/**
 * Builds the Express app: GraphQL at /graphql and a health check at /healthz.
 * Kept separate from index.ts (which reads env vars and listens on a port)
 * so tests can start the real app on a random port.
 */
export async function createApp(dataSource: DataSource): Promise<express.Express> {
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

  return app;
}
