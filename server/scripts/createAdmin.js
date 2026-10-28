// Promotes an existing account to administrator.
// Usage: npm run create-admin -- you@example.com
// Register the account normally on the website first, then run this.
import { config } from '../src/config.js';
import { connectDb, disconnectDb } from '../src/db.js';
import { User } from '../src/models/User.js';

const email = process.argv[2]?.toLowerCase();
if (!email) { console.error('Usage: npm run create-admin -- you@example.com'); process.exit(1); }
await connectDb(config.mongoUri);
const user = await User.findOneAndUpdate({ email }, { role: 'admin' }, { new: true });
console.log(user ? `${user.email} is now an administrator.` : `No account found for ${email}. Register it on the site first.`);
await disconnectDb();
process.exit(user ? 0 : 1);
