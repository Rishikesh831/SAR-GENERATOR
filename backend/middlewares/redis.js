import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// Logic: If we are in Docker Compose, the host is 'redis'. 
// If we are running Node locally, the host is 'localhost'.
const redisConfig = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null,
    // Add retry strategy to avoid flooding console when running locally
    retryStrategy(times) {
        return Math.min(times * 2000, 10000); // Wait up to 10s between retries
    }
};

export const redisConnection = new Redis(redisConfig);

redisConnection.on('connect', () => console.log('✅ Connected to Redis'));
redisConnection.on('error', (err) => {
    // Only log once every few seconds
    if (!redisConnection._lastErrorLog || Date.now() - redisConnection._lastErrorLog > 10000) {
        console.error('❌ Redis Connection Error (Silent mode enabled):', err.message);
        redisConnection._lastErrorLog = Date.now();
    }
});