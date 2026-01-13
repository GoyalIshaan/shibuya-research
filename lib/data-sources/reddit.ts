import axios from 'axios';
import { Signal, DataSource } from './types';

export class RedditClient implements DataSource {
  name = 'reddit';
  async fetchSignals(params: { subreddits: string[] }): Promise<Signal[]> {
    const results: Signal[] = [];

    for (const subreddit of params.subreddits) {
      console.log(`Fetching Reddit hot posts for r/${subreddit}`);
      try {
        const response = await axios.get(`https://www.reddit.com/r/${subreddit}/hot.json?limit=10`, {
            headers: { 
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        
        const posts = response.data?.data?.children || [];

        for (const post of posts) {
          const { title, selftext, score, num_comments, created_utc, author, id, permalink } = post.data;
          
          results.push({
            source: 'reddit',
            type: 'post',
            authorHandle: author,
            timestamp: new Date(created_utc * 1000),
            url: `https://www.reddit.com${permalink}`,
            text: `${title}\n\n${selftext}`,
            engagement: {
              upvotes: score,
              score: score,
              replies: num_comments
            },
            rawPayload: post.data,
            metadata: {
              subreddit,
              postId: id
            }
          });
        }
      } catch (error) {
        console.error(`Error fetching Reddit r/${subreddit}:`, error);
      }
    }

    return results;
  }
}
