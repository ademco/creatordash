import { gql, type TypedDocumentNode } from '@apollo/client';

// Everything the page shows, in one request. GraphQL lets the page ask for
// exactly these fields; the API's schema descriptions explain each one.

export interface DashboardData {
  dataInfo: { source: string; sample: boolean; newestDate: string | null };
  overview: {
    days: number;
    startDate: string | null;
    endDate: string | null;
    combinedAudience: number;
    gained: number;
    topPlatform: string | null;
    topPlatformGained: number;
  };
  audienceGrowth: { platform: string; points: { date: string; audience: number }[] }[];
  platformBreakdown: { platform: string; audience: number; share: number; gained: number }[];
  breakouts: {
    title: string;
    platform: string;
    contentType: string;
    publishedDate: string;
    views: number;
    typicalViews: number;
    multiple: number;
  }[];
}

export interface DashboardVariables {
  days: number;
}

export const DASHBOARD_QUERY: TypedDocumentNode<DashboardData, DashboardVariables> = gql`
  query Dashboard($days: Int!) {
    dataInfo {
      source
      sample
      newestDate
    }
    overview(days: $days) {
      days
      startDate
      endDate
      combinedAudience
      gained
      topPlatform
      topPlatformGained
    }
    audienceGrowth(days: $days) {
      platform
      points {
        date
        audience
      }
    }
    platformBreakdown(days: $days) {
      platform
      audience
      share
      gained
    }
    breakouts(days: $days) {
      title
      platform
      contentType
      publishedDate
      views
      typicalViews
      multiple
    }
  }
`;
