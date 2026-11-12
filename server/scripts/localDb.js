import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../.mongo-data');

if (!fs.existsSync(dbPath)) {
  fs.mkdirSync(dbPath, { recursive: true });
}

console.log('Starting local MongoDB on port 54832...');
const mongod = await MongoMemoryServer.create({
  instance: {
    port: 54832,
    dbName: 'deadstock',
    dbPath,
    storageEngine: 'wiredTiger'
  }
});

console.log(`Local MongoDB is running at: ${mongod.getUri()}deadstock`);

const cleanup = async () => {
  console.log('\nStopping MongoDB...');
  await mongod.stop();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

