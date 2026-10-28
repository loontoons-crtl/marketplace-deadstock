// Usage: npm run seed            (categories, localities and sample listings)
//        npm run seed -- --no-samples   (reference data only; removes sample listings)
import { config } from '../src/config.js';
import { connectDb, disconnectDb } from '../src/db.js';
import { Listing } from '../src/models/Listing.js';
import { backfillListingLocations, seedPricing, seedReference, seedSamples } from './seedLib.js';
import { runMigrations } from '../src/lib/migrate.js';

await connectDb(config.mongoUri);
await Listing.syncIndexes();
await seedReference();
console.log('Categories and localities are up to date.');
if (await seedPricing()) console.log('Starter plan created: ₹5,000/year with 500 MB of photo storage. Change it in Admin → Plans.');
await runMigrations();
console.log(`Listings given locality coordinates: ${await backfillListingLocations()}`);
if (process.argv.includes('--no-samples')) {
  const { deletedCount } = await Listing.deleteMany({ isSample: true });
  console.log(`Sample listings removed: ${deletedCount}`);
} else {
  const n = await seedSamples();
  console.log(`Sample listings created: ${n} (marked isSample, sellers have no published phone).`);
}
await disconnectDb();
