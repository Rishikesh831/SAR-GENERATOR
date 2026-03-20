import dotenv from "dotenv";
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from '../src/db/schemas.ts'; // Import your schema here!

dotenv.config();
neonConfig.webSocketConstructor = ws;
// This is the raw Neon client
// const sql = neon(process.env.DATABASE_URL);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// This is the Drizzle instance. 
// We pass 'schema' so Drizzle knows about your tables for auto-completion.
export const db = drizzle(pool, { schema });