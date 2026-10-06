// The GraphQL schema. The """descriptions""" show up in Apollo Sandbox and in
// introspection, so the API documents itself.

export const typeDefs = /* GraphQL */ `
  """
  Headline numbers for a time window. Windows count back from the newest date in the data.
  """
  type Overview {
    "Length of the window in days (after clamping to 1..365)."
    days: Int!
    "First date in the window that has data (YYYY-MM-DD)."
    startDate: String
    "Last date in the window that has data (YYYY-MM-DD)."
    endDate: String
    "Sum of every platform's latest audience. A fan who follows on two platforms counts twice."
    combinedAudience: Int!
    "Audience gained across all platforms during the window (can be negative)."
    gained: Int!
    "Platform that gained the most, or null if no platform grew."
    topPlatform: String
    "How much the top platform gained (0 when topPlatform is null)."
    topPlatformGained: Int!
  }

  "One day's audience on one platform."
  type AudiencePoint {
    "YYYY-MM-DD"
    date: String!
    "Followers, subscribers, or Spotify monthly listeners on that day."
    audience: Int!
  }

  "A platform's audience over time, oldest point first."
  type AudienceSeries {
    "spotify, youtube, twitch, kick, or tiktok"
    platform: String!
    points: [AudiencePoint!]!
  }

  "How big a platform is compared with the others."
  type PlatformShare {
    platform: String!
    "Latest audience in the window."
    audience: Int!
    "Share of the combined audience, from 0 to 1."
    share: Float!
    "Audience gained during the window (last day minus first day)."
    gained: Int!
  }

  "A release, video, stream, or short that did far better than usual for its platform."
  type Breakout {
    title: String!
    platform: String!
    "release, video, stream, or short"
    contentType: String!
    "YYYY-MM-DD"
    publishedDate: String!
    "Streams, views, or peak viewers."
    views: Int!
    "Median views for this platform in the window: what a normal post gets."
    typicalViews: Int!
    "views divided by typicalViews, e.g. 4.1"
    multiple: Float!
  }

  "Where the numbers come from."
  type DataInfo {
    "In words, e.g. 'CSV files in data/sample'."
    source: String!
    "True when the numbers are the made-up sample data."
    sample: Boolean!
    "Newest date in the data; every window ends here."
    newestDate: String
  }

  """
  A headline from a music or creator-economy news site. Only the headline, the
  site, the date, and the link are kept: the story itself stays with the publisher.
  """
  type NewsItem {
    title: String!
    "Link to the story on the publisher's site (always http or https)."
    url: String!
    "The site it came from, e.g. Music Business Worldwide."
    source: String!
    "When it was published, ISO 8601."
    publishedAt: String!
    "spotify, youtube, twitch, kick, or tiktok when the headline is about one of them; otherwise null."
    platform: String
  }

  "Recent headlines, newest first."
  type News {
    "False for the built-in offline sample headlines (they are placeholders, not real news)."
    live: Boolean!
    items: [NewsItem!]!
  }

  type Query {
    "Headline numbers: combined audience, total gained, and the fastest-growing platform."
    overview("Window length in days, clamped to 1..365." days: Int = 30): Overview!

    "Audience over time, one series per platform, biggest platform first."
    audienceGrowth("Window length in days, clamped to 1..365." days: Int = 90): [AudienceSeries!]!

    "Each platform's latest audience, share of the total, and gain. Biggest first."
    platformBreakdown("Window length in days, clamped to 1..365." days: Int = 30): [PlatformShare!]!

    """
    Content with at least minMultiple times the median views for its platform in the window,
    highest multiple first. Platforms with fewer than 3 items in the window are skipped.
    """
    breakouts(
      "Window length in days, clamped to 1..365."
      days: Int = 90
      "How many times the usual views counts as a breakout. Values below 1 are treated as 1."
      minMultiple: Float = 2.5
    ): [Breakout!]!

    "Where the numbers come from, and whether they are sample data."
    dataInfo: DataInfo!

    """
    Recent music and creator-economy headlines, cached for about 30 minutes. If the news
    sites cannot be reached the list is empty; this never fails the rest of the dashboard.
    """
    news("How many headlines, from 1 to 30." limit: Int = 12): News!
  }
`;
