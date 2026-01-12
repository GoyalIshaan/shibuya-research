export const MONITORING_CONFIG = {
  reddit: {
    // Subreddits from the "Shibuya Consumer Research" report
    subreddits: [
      // General startup launch subs
      'startups',
      'startup',
      'entrepreneur',
      'startupshelpstartups',
      'thefounders',

      // Product / MVP showcase subs
      'sideproject',
      'roastmystartup',
      'newproducts',

      // SaaS / indie hacker angle
      'saas',
      'indiehackers',
      'microsaas',
    ],
  },
  productHunt: {
    enabled: true,
    feedUrl: 'https://www.producthunt.com/feed'
  },
  appStore: {
    enabled: true,
    // Top Free Apps in Music Category (Category ID 6011)
    feedUrl: 'http://ax.itunes.apple.com/WebObjects/MZStoreServices.woa/ws/RSS/topfreeapplications/limit=200/genre=6011/json'
  },
  playStore: {
    enabled: true,
    // Placeholder for scraper config
    categories: ['MUSIC_AND_AUDIO'],
    collection: 'TOP_FREE',
    maxResults: 200
  },
  // New Sources
  hackernews: {
    enabled: true,
    mode: 'showstories', // Focus on "Show HN" for launches
    maxStories: 30,
    fetchComments: true,
    maxCommentsPerStory: 5,
    keywords: ['launch', 'introducing', 'released', 'announcing', 'startup', 'beta']
  },
  rssFeeds: {
    enabled: true,
    // Broad VC/blog coverage; avoid over-filtering by default.
    includeKeywords: [],
    excludeKeywords: [
      'podcast',
      'webinar',
      'newsletter'
    ],
    maxItemsPerFeed: 25,
    fetchFullText: true,
    minFullTextLength: 280,
    requestTimeoutMs: 15000,
    feeds: [
      {
        publisher: 'Y Combinator',
        url: 'https://blog.ycombinator.com/feed/',
        publisherUrl: 'https://blog.ycombinator.com',
        tags: ['vc', 'yc', 'accelerator', 'blog'],
        source: 'vc_rss'
      },
      {
        publisher: 'Sequoia Capital',
        url: 'https://www.sequoiacap.com/feed/',
        publisherUrl: 'https://www.sequoiacap.com',
        tags: ['vc', 'sequoia', 'investment'],
        source: 'vc_rss'
      },
      {
        publisher: 'Lightspeed',
        url: 'https://lsvp.com/feed/',
        publisherUrl: 'https://lsvp.com',
        tags: ['vc', 'lightspeed', 'venture'],
        source: 'vc_rss'
      },
      {
        publisher: 'a16z',
        url: 'https://a16z.com/post-sitemap.xml',
        publisherUrl: 'https://a16z.com',
        tags: ['vc', 'a16z', 'investment'],
        source: 'vc_rss',
        format: 'sitemap'
      },
      {
        publisher: 'a16z Announcements',
        url: 'https://a16z.com/announcement-sitemap.xml',
        publisherUrl: 'https://a16z.com',
        tags: ['vc', 'a16z', 'announcement'],
        source: 'vc_rss',
        format: 'sitemap'
      },
      {
        publisher: 'Accel',
        url: 'https://www.accel.com/sitemap.xml',
        publisherUrl: 'https://www.accel.com',
        tags: ['vc', 'accel', 'investment'],
        source: 'vc_rss',
        format: 'sitemap',
        includePaths: ['/news/', '/spotlight-on/']
      },
      {
        publisher: 'Bessemer Venture Partners',
        url: 'https://www.bvp.com/post-sitemap.xml',
        publisherUrl: 'https://www.bvp.com',
        tags: ['vc', 'bessemer', 'investment'],
        source: 'vc_rss',
        format: 'sitemap'
      },
      {
        publisher: 'BVP Memos',
        url: 'https://www.bvp.com/memo-sitemap.xml',
        publisherUrl: 'https://www.bvp.com',
        tags: ['vc', 'bessemer', 'memo'],
        source: 'vc_rss',
        format: 'sitemap'
      },
      {
        publisher: 'Index Ventures',
        url: 'https://www.indexventures.com/sitemap.xml',
        publisherUrl: 'https://www.indexventures.com',
        tags: ['vc', 'index', 'investment'],
        source: 'vc_rss',
        format: 'sitemap',
        includePaths: ['/perspectives/', '/index-press/']
      },
      {
        publisher: 'First Round Review',
        url: 'https://firstround.com/sitemap.xml',
        publisherUrl: 'https://firstround.com/review',
        tags: ['vc', 'first_round', 'insights'],
        source: 'vc_rss',
        format: 'sitemap',
        includePaths: ['/review/']
      },
      {
        publisher: 'General Catalyst',
        url: 'https://www.generalcatalyst.com/sitemap.xml',
        publisherUrl: 'https://www.generalcatalyst.com',
        tags: ['vc', 'general_catalyst', 'investment'],
        source: 'vc_rss',
        format: 'sitemap',
        includePaths: ['/stories/']
      },
      {
        publisher: 'Greylock',
        url: 'https://greylock.com/feed/',
        publisherUrl: 'https://greylock.com',
        tags: ['vc', 'greylock', 'investment'],
        source: 'vc_rss'
      },
      {
        publisher: 'SaaStr',
        url: 'https://www.saastr.com/feed/',
        publisherUrl: 'https://www.saastr.com',
        tags: ['saas', 'growth', 'funding'],
        source: 'vc_rss'
      },
      {
        publisher: 'TechCrunch Startups',
        url: 'https://techcrunch.com/category/startups/feed/',
        tags: ['news', 'startups', 'funding'],
        source: 'vc_rss'
      },
      {
        publisher: 'TechCrunch Funding',
        url: 'https://techcrunch.com/tag/funding/feed/',
        tags: ['news', 'funding'],
        source: 'vc_rss'
      },
      {
        publisher: 'TechCrunch Acquisitions',
        url: 'https://techcrunch.com/tag/acquisitions/feed/',
        tags: ['news', 'm&a', 'acquisition'],
        source: 'vc_rss'
      }
    ]
  },
  yc: {
    enabled: true,
    pages: ['https://www.ycombinator.com/companies'],
    maxCompaniesPerRun: 20
  },
  gdelt: {
    enabled: true,
    maxRecords: 25,
    timespan: '7d',
    sourcelang: ['eng'],
    queries: [
      {
        name: 'VC Funding',
        query: '("raised" OR "funding round" OR "seed round" OR "series a" OR "series b" OR "series c" OR "venture capital")',
        tags: ['funding', 'vc']
      },
      {
        name: 'M&A',
        query: '("acquired" OR "acquisition" OR "merger")',
        tags: ['m&a']
      },
      {
        name: 'Product Launches',
        query: '("launch" OR "launches" OR "announces")',
        tags: ['launch']
      }
    ]
  }
};
