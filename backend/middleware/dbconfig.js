import { neon, Pool } from '@neondatabase/serverless';
import 'dotenv/config'; // We can just do this to load .env variables immediately!

// 1. (Optional) This is the simple SQL query fetcher. You can keep this if you want to run raw queries outside of Prisma.
export const db = neon(process.env.DATABASE_URL);

// --- Prisma + Neon Integration ---

// 2. Import the Prisma Neon adapter and the auto-generated Prisma Client
import { PrismaNeon } from '@prisma/adapter-neon';

// Important: the path must be relative to THIS file (`middleware/dbconfig.js`) 
// pointing to `generated/prisma/index.js`
import { PrismaClient } from '../generated/prisma/index.js';

// 3. Create a traditional connection "Pool" for Prisma instead of a standard HTTP client.
// Prisma needs a continuous connection to run complex transactions.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// 4. Wrap that connection Pool inside the Prisma Adapter
const adapter = new PrismaNeon(pool);

// 5. Initialize the Prisma Client and pass the adapter to it!
export const prisma = new PrismaClient({ adapter });