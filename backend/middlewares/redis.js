import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// Logic: If we are in Docker Compose, the host is 'redis'. 
// If we are running Node locally, the host is 'localhost'.
const redisConfig = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null,
};

export const redisConnection = new Redis(redisConfig);

redisConnection.on('connect', () => console.log('✅ Connected to Redis'));
redisConnection.on('error', (err) => console.error('❌ Redis Connection Error:', err.message));