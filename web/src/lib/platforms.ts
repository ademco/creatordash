// Fixed facts about each platform. Colors live in CSS (styles.css) as
// --platform-<id>, so light and dark themes can tune them; the order here is
// the fixed order chips and colors are assigned in, never re-ranked.

export const PLATFORM_IDS = ['spotify', 'youtube', 'twitch', 'kick', 'tiktok'] as const;
export type PlatformId = (typeof PLATFORM_IDS)[number];

export const PLATFORM_NAMES: Record<string, string> = {
  spotify: 'Spotify',
  youtube: 'YouTube',
  twitch: 'Twitch',
  kick: 'Kick',
  tiktok: 'TikTok',
};

export function platformName(id: string): string {
  return PLATFORM_NAMES[id] ?? id;
}

/** What "views" means for each kind of content, in the artist's words. */
export function viewsWord(contentType: string): string {
  if (contentType === 'release') return 'streams';
  if (contentType === 'stream') return 'peak viewers';
  return 'views';
}

/** What "audience" means on each platform. */
export function audienceWord(platform: string): string {
  if (platform === 'spotify') return 'monthly listeners';
  if (platform === 'youtube') return 'subscribers';
  return 'followers';
}
