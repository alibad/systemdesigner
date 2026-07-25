-- Atomic token bucket.
-- KEYS[1]: bucket key
-- ARGV[1]: capacity
-- ARGV[2]: refill tokens per interval
-- ARGV[3]: refill interval in milliseconds
-- ARGV[4]: token cost of this request
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_tokens = tonumber(ARGV[2])
local refill_interval_ms = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

if not capacity or not refill_tokens or not refill_interval_ms or not requested
    or capacity <= 0 or refill_tokens <= 0 or refill_interval_ms <= 0 or requested <= 0 then
    return redis.error_reply('capacity, refill, interval, and request cost must be positive')
end

local time = redis.call('time')
local now_ms = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local bucket = redis.call('hmget', key, 'tokens', 'last_refill_ms')
local current_tokens = tonumber(bucket[1]) or capacity
local last_refill_ms = tonumber(bucket[2]) or now_ms

local elapsed_ms = math.max(0, now_ms - last_refill_ms)
local new_tokens = math.min(
    capacity,
    current_tokens + elapsed_ms * refill_tokens / refill_interval_ms
)

local allowed = 0
local retry_after_ms = 0
if new_tokens >= requested then
    new_tokens = new_tokens - requested
    allowed = 1
else
    if requested > capacity then
        retry_after_ms = -1
    else
        retry_after_ms = math.ceil(
            (requested - new_tokens) * refill_interval_ms / refill_tokens
        )
    end
end

redis.call('hset', key, 'tokens', new_tokens, 'last_refill_ms', now_ms)
local fill_time_ms = math.ceil(capacity * refill_interval_ms / refill_tokens)
redis.call('pexpire', key, math.max(refill_interval_ms * 2, fill_time_ms * 2))

return {allowed, math.floor(new_tokens), retry_after_ms}
