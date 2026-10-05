// Shapes shared by the data sources, the insight functions, and the resolvers.

export const PLATFORMS = ['spotify', 'youtube', 'twitch', 'kick', 'tiktok'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const CONTENT_TYPES = ['release', 'video', 'stream', 'short'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

/** One row of the `audience` table: a platform's audience size on one day. */
export interface AudienceRow {
  date: string; // YYYY-MM-DD
  platform: Platform;
  audience: number;
}

/** One row of the `content` table: a release, video, stream, or short. */
export interface ContentRow {
  publishedDate: string; // YYYY-MM-DD
  platform: Platform;
  contentType: ContentType;
  title: string;
  views: number;
}

export interface AudiencePoint {
  date: string;
  audience: number;
}

export interface AudienceSeries {
  platform: Platform;
  points: AudiencePoint[];
}

export interface PlatformShare {
  platform: Platform;
  audience: number;
  share: number;
  gained: number;
}

export interface Overview {
  days: number;
  startDate: string | null;
  endDate: string | null;
  combinedAudience: number;
  gained: number;
  topPlatform: Platform | null;
  topPlatformGained: number;
}

export interface Breakout {
  title: string;
  platform: Platform;
  contentType: ContentType;
  publishedDate: string;
  views: number;
  typicalViews: number;
  multiple: number;
}

export interface DataInfo {
  /** Where the numbers come from, in words, e.g. "CSV files in data/sample". */
  source: string;
  /** True when the numbers are the made-up sample data. */
  sample: boolean;
  newestDate: string | null;
}
