// Resolvers connect each Query field to the data source and the insight
// functions. They stay thin: clamp the arguments, fetch the window, compute.

import type { DataSource } from './datasource.js';
import {
  audienceSeries,
  clampDays,
  DEFAULT_MIN_MULTIPLE,
  findBreakouts,
  overview,
  platformBreakdown,
  windowStart,
} from './insights.js';
import type { NewsSource } from './news-source.js';
import type { AudienceRow, ContentRow } from './types.js';

export interface Context {
  dataSource: DataSource;
  news: NewsSource;
}

interface DaysArgs {
  days: number;
}

interface BreakoutArgs extends DaysArgs {
  minMultiple: number;
}

async function audienceWindow(dataSource: DataSource, days: number): Promise<AudienceRow[]> {
  const newest = await dataSource.newestDate();
  return newest ? dataSource.audienceSince(windowStart(newest, days)) : [];
}

async function contentWindow(dataSource: DataSource, days: number): Promise<ContentRow[]> {
  const newest = await dataSource.newestDate();
  return newest ? dataSource.contentSince(windowStart(newest, days)) : [];
}

export const resolvers = {
  Query: {
    overview: async (_parent: unknown, args: DaysArgs, { dataSource }: Context) => {
      const days = clampDays(args.days);
      return overview(await audienceWindow(dataSource, days), days);
    },

    audienceGrowth: async (_parent: unknown, args: DaysArgs, { dataSource }: Context) =>
      audienceSeries(await audienceWindow(dataSource, clampDays(args.days))),

    platformBreakdown: async (_parent: unknown, args: DaysArgs, { dataSource }: Context) =>
      platformBreakdown(await audienceWindow(dataSource, clampDays(args.days))),

    breakouts: async (_parent: unknown, args: BreakoutArgs, { dataSource }: Context) => {
      const minMultiple = Number.isFinite(args.minMultiple) ? Math.max(1, args.minMultiple) : DEFAULT_MIN_MULTIPLE;
      return findBreakouts(await contentWindow(dataSource, clampDays(args.days)), minMultiple);
    },

    dataInfo: (_parent: unknown, _args: unknown, { dataSource }: Context) => dataSource.info(),

    // News is a nice extra, so it must never take the dashboard down: if the
    // feeds are unreachable the answer is an empty list, not an error.
    news: async (_parent: unknown, args: { limit: number }, { news }: Context) => {
      const limit = Math.min(30, Math.max(1, Math.trunc(Number.isFinite(args.limit) ? args.limit : 12)));
      try {
        return await news.latest(limit);
      } catch (error) {
        console.warn('News unavailable:', error instanceof Error ? error.message : error);
        return { live: true, items: [] };
      }
    },
  },
};
