import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signals } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    const recentSignals = await db.select()
        .from(signals)
        .orderBy(desc(signals.timestamp))
        .limit(20);

    return NextResponse.json({ 
        success: true, 
        signals: recentSignals 
    });
  } catch (error) {
    console.error('Error fetching recent signals:', error);
    return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch recent signals' 
    }, { status: 500 });
  }
}
