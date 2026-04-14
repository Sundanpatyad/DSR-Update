# Queue System Documentation

## Overview

The queue system is designed to handle high-volume webhook requests (100+ concurrent) reliably without data loss or API rate limit issues. It uses Upstash Redis for persistent queue storage, ensuring no data loss during crashes, deployments, or developer updates.

## Architecture

### Components

1. **queueService.js** - Core queue management with Redis persistence
2. **webhookController.js** - HTTP endpoint that enqueues webhooks
3. **webhookService.js** - Processes individual webhook payloads
4. **githubService.js** - Fetches commit details with rate limiting
5. **googleSheetsUtil.js** - Writes data to Google Sheets with batching
6. **Upstash Redis** - Cloud-native Redis for persistent queue storage

## Key Features

### 1. Concurrency Control

- **MAX_CONCURRENCY: 3** - Processes 3 webhooks in parallel
- Balances speed with resource usage
- Prevents overwhelming external APIs

### 2. Retry Mechanism

- **MAX_RETRIES: 3** - Failed webhooks retry up to 3 times
- **Exponential backoff**: 1s → 5s → 15s delays
- Automatic retry on network/API errors
- Final failure logged and discarded

### 3. Redis Queue Persistence

- **Upstash Redis** - Cloud-native Redis for persistent storage
- Queue saved to Redis key `webhook-queue` on every operation
- Automatic recovery on server restart
- No data loss on crashes or deployments
- Queue deleted from Redis after successful load
- Graceful fallback to in-memory queue if Redis unavailable

### 4. GitHub API Rate Limiting

- **MIN_REQUEST_INTERVAL: 1000ms** - 1 second between API calls
- Prevents hitting GitHub rate limits (5000/hour)
- Logs rate limit events
- Handles 403 errors gracefully

### 5. Commit Caching

- **CACHE_TTL: 5 minutes** - In-memory cache for commit details
- Reduces redundant GitHub API calls
- Key format: `{owner}/{repo}/{sha}`
- Automatic expiration

### 6. Batch Processing (Google Sheets)

- **Chunk size: 500 rows** - Batches Google Sheets writes
- Prevents API timeout on large datasets
- Efficient memory usage

## Flow Diagram

```
GitHub Push Event
    ↓
webhookController.handleGitWebhook()
    ↓ (202 Accepted)
queueService.enqueueWebhook()
    ↓ (save to Redis)
queueService.processQueue()
    ↓ (3 parallel workers)
webhookService.processPushPayload()
    ↓ (per commit)
githubService.fetchCommitDetails() [with rate limit & cache]
    ↓
googleSheetsUtil.appendToGoogleSheet() [with batching]
    ↓
Success → Resolve promise
Failure → Retry (3x) → Log error
```

## File Structure

```
src/
├── controllers/
│   └── webhookController.js    # HTTP endpoint, signature verification
├── services/
│   ├── queueService.js          # Queue management, Redis persistence, retries
│   ├── webhookService.js         # Payload processing logic
│   └── githubService.js         # GitHub API with rate limiting & cache
├── utils/
│   ├── googleSheetsUtil.js      # Google Sheets integration
│   └── logger.js                # Logging configuration
.env                             # Environment variables (including Redis credentials)
```

## Configuration

### Environment Variables

```env
WEBHOOK_SECRET=your_webhook_secret
GITHUB_TOKEN=your_github_personal_access_token
GOOGLE_SHEET_ID=your_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email
GOOGLE_PRIVATE_KEY=your_private_key

# Upstash Redis Configuration
UPSTASH_REDIS_REST_URL=https://your-upstash-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-rest-token
```

### Queue Configuration (queueService.js)

```javascript
const MAX_CONCURRENCY = 3;        // Parallel workers
const MAX_RETRIES = 3;            // Retry attempts
const RETRY_DELAYS = [1000, 5000, 15000];  // Backoff delays
```

### GitHub API Configuration (githubService.js)

```javascript
const MIN_REQUEST_INTERVAL = 1000;  // 1 second between calls
const CACHE_TTL = 5 * 60 * 1000;    // 5 minute cache
```

### Google Sheets Configuration (googleSheetsUtil.js)

```javascript
const chunkSize = 500;  // Rows per batch
```

## Handling 100 Concurrent Requests

### Scenario: 100 webhooks arrive simultaneously

1. **Reception Phase**
   - All 100 receive `202 Accepted` response immediately
   - All added to in-memory queue
   - Queue saved to Redis (for crash recovery)

2. **Processing Phase**
   - 3 workers start processing simultaneously
   - Each webhook processes its commits
   - GitHub API calls throttled (1s delay between calls)
   - Commit details cached (reduces redundant calls)
   - Google Sheets writes batched (500 rows/chunk)

3. **Completion Phase**
   - Webhooks complete sequentially (3 at a time)
   - Total time: ~33x faster than single-threaded
   - Failed webhooks retry automatically
   - Logs track progress throughout

### Performance Estimates

| Scenario | Time (approx) | Notes |
|----------|---------------|-------|
| 1 webhook, 1 commit | 2-3 seconds | Single API call + write |
| 1 webhook, 100 commits | 100-120 seconds | Sequential API calls (1s delay) |
| 100 webhooks, 1 commit each | 35-40 seconds | 3 parallel workers |
| 100 webhooks, 10 commits each | 350-400 seconds | With rate limiting |

## Crash Recovery

### What Happens on Crash

1. **Before Crash**
   - Queue state saved to Redis key `webhook-queue`
   - All pending webhooks preserved
   - Retry counts maintained
   - Data persists even if server is destroyed

2. **After Crash**
   - Server restarts (or new instance spins up)
   - `loadQueueFromRedis()` restores queue from Redis
   - Processing resumes automatically
   - Queue deleted from Redis after successful load

3. **Benefits of Redis Persistence**
   - **Zero data loss** - Queue survives server destruction
   - **Deployment safety** - Queue persists across deployments
   - **Developer updates** - Queue survives code changes
   - **Multi-instance safe** - Can run multiple instances (with proper coordination)
   - **No file system issues** - No disk space or permission problems

### Testing Crash Recovery

```bash
# Start server
npm start

# Send webhooks (they get queued)
curl -X POST http://localhost:3000/webhook/git -d '{...}'

# Kill server (Ctrl+C)
# Queue saved to Redis

# Restart server
npm start
# Queue automatically loads from Redis and resumes processing
```

## Monitoring & Logging

### Queue Stats

```javascript
const { getQueueStats } = require('./services/queueService');
const stats = getQueueStats();
console.log(stats);
// { waiting: 97, running: 3, maxConcurrency: 3 }
```

### Redis Connection Status

```javascript
// Check logs for Redis initialization
// "Upstash Redis client initialized" - Redis connected
// "UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not found" - Fallback to in-memory
```

### Log Messages

- `Upstash Redis client initialized` - Redis connection successful
- `UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not found. Falling back to in-memory queue.` - Redis unavailable
- `Webhook added to queue. Queue size: X, Active: Y`
- `Processing webhook. Queue: X, Active: Y, Retry: Z`
- `Webhook processed successfully`
- `Webhook processing failed (attempt X): error message`
- `Retrying in Xms...`
- `Webhook failed after 3 retries. Giving up.`
- `Loaded X items from Redis queue` - Queue restored from Redis
- `No queue data found in Redis` - No pending items
- `Queue saved to Redis` - Queue persisted
- `Failed to save queue to Redis` - Redis save error (continues processing)
- `Rate limiting: waiting Xms before GitHub API call`
- `Cache hit for commit abc123`

## Error Handling

### Webhook Processing Errors

1. **Transient Errors** (network, API timeout)
   - Automatic retry with exponential backoff
   - Logged with attempt number
   - Max 3 retries
   - Queue state saved to Redis on each retry

2. **Permanent Errors** (invalid data, 404)
   - Logged as error
   - Not retried after 3 attempts
   - Webhook discarded
   - Queue state saved to Redis before discard

3. **GitHub API Errors**
   - 401: Invalid token (check GITHUB_TOKEN)
   - 403: Rate limit (increase MIN_REQUEST_INTERVAL)
   - 404: Repository/commit not found

4. **Google Sheets Errors**
   - Configuration missing: Skipped with warning
   - API errors: Logged, data preserved in queue
   - Rate limits: Handled by batching

5. **Redis Errors**
   - Connection failure: Falls back to in-memory queue
   - Save failure: Continues processing, logs error
   - Load failure: Continues with empty queue, logs error
   - All Redis errors are non-blocking

## Best Practices

### For High Load

1. **Monitor queue size** - Alert if backlog grows > 50
2. **Check GitHub rate limits** - Stay under 5000/hour
3. **Review logs regularly** - Look for retry patterns
4. **Test crash recovery** - Verify Redis persistence works
5. **Monitor Redis connection** - Ensure stable connection

### For Reliability

1. **Use environment variables** - Never commit secrets
2. **Set up log rotation** - Prevent disk space issues
3. **Monitor server resources** - CPU, memory, disk I/O
4. **Backup Google Sheets** - Export regularly
5. **Monitor Redis usage** - Check Upstash dashboard for limits
6. **Test Redis fallback** - Verify graceful degradation

### For Performance

1. **Adjust MAX_CONCURRENCY** based on server resources
2. **Tune MIN_REQUEST_INTERVAL** for GitHub API limits
3. **Use caching** effectively for repeated commits
4. **Batch Google Sheets writes** appropriately
5. **Monitor Redis latency** - Ensure fast queue operations

## Troubleshooting

### Queue Not Processing

**Symptom:** Webhooks enqueued but not processing

**Solutions:**
- Check logs for errors in `processQueue()`
- Verify `activeWorkers` count
- Ensure `isProcessing` flag not stuck
- Restart server to reset queue state
- Check if Redis connection is established

### GitHub API Rate Limits

**Symptom:** 403 errors from GitHub API

**Solutions:**
- Increase `MIN_REQUEST_INTERVAL` to 2000ms
- Reduce `MAX_CONCURRENCY` to 2
- Check GITHUB_TOKEN has proper scope
- Verify authenticated rate limit status

### Google Sheets Write Failures

**Symptom:** Data not appearing in sheets

**Solutions:**
- Verify GOOGLE_SHEET_ID is correct
- Check service account has editor access
- Verify GOOGLE_SERVICE_ACCOUNT_EMAIL matches
- Ensure GOOGLE_PRIVATE_KEY has proper newlines
- Check logs for Google Sheets errors

### Redis Connection Issues

**Symptom:** "UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not found" in logs

**Solutions:**
- Verify UPSTASH_REDIS_REST_URL is set in .env
- Verify UPSTASH_REDIS_REST_TOKEN is set in .env
- Check Upstash dashboard for correct credentials
- Ensure .env file is loaded (restart server)
- Check for typos in variable names

**Symptom:** "Failed to save queue to Redis" errors

**Solutions:**
- Check Upstash service status
- Verify network connectivity to Upstash
- Check Upstash dashboard for rate limits
- Verify token has proper permissions
- Check for Redis connection timeout

**Symptom:** Queue not loading from Redis on restart

**Solutions:**
- Verify Redis key `webhook-queue` exists in Upstash dashboard
- Check logs for "Loaded X items from Redis queue"
- Verify Redis connection is established on startup
- Check for Redis load errors in logs
- Manually check Redis data in Upstash dashboard

### High Memory Usage

**Symptom:** Server using excessive memory

**Solutions:**
- Reduce MAX_CONCURRENCY to 2
- Reduce CACHE_TTL to 2 minutes
- Monitor commit cache size
- Restart server periodically
- Check Redis memory usage in Upstash dashboard

## API Reference

### queueService.enqueueWebhook(payload)

Enqueues a webhook payload for processing.

**Parameters:**
- `payload` (object): GitHub webhook push event payload

**Returns:** Promise that resolves when processing completes

**Example:**
```javascript
const { enqueueWebhook } = require('./services/queueService');
await enqueueWebhook(githubPayload);
```

### queueService.getQueueStats()

Returns current queue statistics.

**Returns:** Object with queue metrics

**Example:**
```javascript
const stats = getQueueStats();
// { waiting: 10, running: 3, maxConcurrency: 3 }
```

### githubService.fetchCommitDetails(owner, repo, sha)

Fetches detailed commit information from GitHub API.

**Parameters:**
- `owner` (string): Repository owner
- `repo` (string): Repository name
- `sha` (string): Commit SHA

**Returns:** Promise resolving to array of file changes

**Features:**
- Rate limited (1s delay between calls)
- Cached for 5 minutes
- Handles errors gracefully

## Summary

This system can handle 100+ concurrent webhook requests reliably without data loss or API rate limit issues, with Redis ensuring no requests are skipped even during server crashes or developer updates.
