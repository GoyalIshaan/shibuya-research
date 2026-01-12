import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signals } from '@/lib/db/schema';
import { desc, inArray, sql } from 'drizzle-orm';

export async function GET() {
  try {
    // Get the most recent timestamp to filter for the latest batch
    // This assumes we run ingestion somewhat atomically or we take the last 24h
    // A query for "latest apps" is basically: select * from signals where source in (appstore, playstore) order by timestamp desc
    // limiting to 500 should cover top 200 from both stores + buffer
    
    // Fetch a larger batch to handle potential duplicates/history
    const rawApps = await db.select()
      .from(signals)
      .where(inArray(signals.source, ['appstore', 'playstore']))
      .orderBy(desc(signals.timestamp))
      .limit(1000);

    // Deduplicate: Keep only the most recent entry for each app (based on URL or unique title)
    const uniqueAppsMap = new Map();
    
    for (const app of rawApps) {
      // Use URL as primary key, fallback to title logic if needed
      // For AppStore/PlayStore, URL should be stable and unique per app
      const key = app.url || app.text.split('\n')[0]; 
      
      if (!uniqueAppsMap.has(key)) {
        uniqueAppsMap.set(key, app);
      }
    }
    
    const apps = Array.from(uniqueAppsMap.values());
    
    // Check if we need to filter for the user's requested "latest" only? 
    // The loop above naturally keeps the first one encountered (which is the latest due to orderBy desc)

    return NextResponse.json({ 
      success: true, 
      apps 
    });
  } catch (error) {
    console.error('Error fetching top apps:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch apps' 
    }, { status: 500 });
  }
}
