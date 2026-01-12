import axios from 'axios';
import { Signal, DataSource } from './types';

interface HNItem {
  id: number;
  deleted?: boolean;
  type?: 'job' | 'story' | 'comment' | 'poll' | 'pollopt';
  by?: string;
  time?: number;
  text?: string;
  dead?: boolean;
  parent?: number;
  poll?: number;
  kids?: number[];
  url?: string;
  score?: number;
  title?: string;
  parts?: number[];
  descendants?: number;
}

export class HackerNewsClient implements DataSource {
  name = 'hackernews';
  private baseUrl = 'https://hacker-news.firebaseio.com/v0';

  async fetchSignals(params: {
    mode?: 'showstories' | 'newstories' | 'topstories';
    maxStories?: number;
    fetchComments?: boolean;
    maxCommentsPerStory?: number;
    keywords?: string[];
  }): Promise<Signal[]> {
    const mode = params.mode || 'showstories';
    const limit = params.maxStories || 30;
    const fetchComments = params.fetchComments || false;
    const maxComments = params.maxCommentsPerStory || 5;
    const keywords = params.keywords || ['launch', 'released', 'introducing', 'announcing'];

    console.log(`Fetching Hacker News ${mode}...`);
    const results: Signal[] = [];

    try {
      const { data: storyIds } = await axios.get<number[]>(`${this.baseUrl}/${mode}.json`);
      const topIds = storyIds.slice(0, limit);

      // Process in chunks to avoid rate limiting issues, though HN API is quite generous
      const chunkSize = 5;
      for (let i = 0; i < topIds.length; i += chunkSize) {
        const chunk = topIds.slice(i, i + chunkSize);
        const storyPromises = chunk.map(id => this.fetchItem(id));
        const stories = await Promise.all(storyPromises);

        for (const story of stories) {
          if (!story || story.dead || story.deleted) continue;
          
          // Filter logic
          const isShowHN = story.title?.startsWith('Show HN:');
          const hasKeyword = keywords.some(k => story.title?.toLowerCase().includes(k.toLowerCase()));

          if (mode === 'showstories' || isShowHN || hasKeyword) {
            results.push(this.transformStory(story));

            if (fetchComments && story.kids) {
              const commentIds = story.kids.slice(0, maxComments);
              const commentPromises = commentIds.map(id => this.fetchItem(id));
              const comments = await Promise.all(commentPromises);
              
              for (const comment of comments) {
                if (comment && !comment.dead && !comment.deleted && comment.text) {
                  results.push(this.transformComment(comment, story));
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching from Hacker News:', error);
    }

    return results;
  }

  private async fetchItem(id: number): Promise<HNItem | null> {
    try {
      const { data } = await axios.get<HNItem>(`${this.baseUrl}/item/${id}.json`);
      return data;
    } catch (error) {
      console.error(`Error fetching HN item ${id}:`, error);
      return null;
    }
  }

  private transformStory(item: HNItem): Signal {
    return {
      source: 'hackernews',
      type: 'story',
      authorHandle: item.by,
      timestamp: new Date((item.time || 0) * 1000),
      url: `https://news.ycombinator.com/item?id=${item.id}`, // Canonical URL is the discussion
      text: `${item.title}\n\n${item.url || ''}`, // Text is title + link
      engagement: {
        score: item.score,
        replies: item.descendants,
        upvotes: item.score
      },
      tags: item.title?.startsWith('Show HN:') ? ['show_hn'] : [],
      metadata: {
        hnId: item.id,
        domain: item.url ? new URL(item.url).hostname : undefined,
        externalUrl: item.url
      },
      rawPayload: item as unknown as Record<string, unknown>
    };
  }

  private transformComment(comment: HNItem, parentStory: HNItem): Signal {
    return {
      source: 'hackernews',
      type: 'comment',
      authorHandle: comment.by,
      timestamp: new Date((comment.time || 0) * 1000),
      url: `https://news.ycombinator.com/item?id=${comment.id}`,
      text: comment.text || '',
      engagement: {
        // Comments don't expose score in public API easily without scraping, but accessible via other means. 
        // Standard API doesn't return point count for comments usually.
      },
      metadata: {
        hnId: comment.id,
        parentId: comment.parent,
        storyId: parentStory.id,
        storyTitle: parentStory.title
      },
      rawPayload: comment as unknown as Record<string, unknown>
    };
  }
}
