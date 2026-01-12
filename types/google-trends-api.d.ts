declare module 'google-trends-api' {
  export function interestOverTime(options: {
    keyword: string | string[];
    startTime?: Date;
    endTime?: Date;
    geo?: string;
  }): Promise<string>;
  
  export function dailyTrends(options: {
    geo: string;
    trendDate?: Date;
  }): Promise<string>;
  
  export function realTimeTrends(options: {
    geo: string;
    category?: string;
  }): Promise<string>;
}
