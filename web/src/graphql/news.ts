import { gql, type TypedDocumentNode } from '@apollo/client';

// News is its own query, never part of the dashboard query. If the news sites
// are slow or down, the headlines are simply missing; the numbers still load.

export interface NewsItemData {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  platform: string | null;
}

export interface NewsData {
  news: { live: boolean; items: NewsItemData[] };
}

export const NEWS_LIMIT = 12;

export const NEWS_QUERY: TypedDocumentNode<NewsData, { limit: number }> = gql`
  query News($limit: Int!) {
    news(limit: $limit) {
      live
      items {
        title
        url
        source
        publishedAt
        platform
      }
    }
  }
`;
