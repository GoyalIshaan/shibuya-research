import { db } from '../lib/db/index.js';
import { signals } from '../lib/db/schema.js';
import { eq, and, like } from 'drizzle-orm';

async function cleanProductHuntData() {
  console.log('Cleaning up Product Hunt signals with [object Object]...');

  // Delete Product Hunt signals that have [object Object] in their text
  const result = await db
    .delete(signals)
    .where(
      and(
        eq(signals.source, 'producthunt'),
        like(signals.text, '%[object Object]%')
      )
    );

  console.log('Deleted problematic Product Hunt signals');
  console.log('Done! Now run a sync to fetch fresh Product Hunt data.');
}

cleanProductHuntData().catch(console.error).finally(() => process.exit(0));
