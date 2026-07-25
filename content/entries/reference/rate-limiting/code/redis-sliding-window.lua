-- Atomic sliding-window log.
-- KEYS[1]: sorted-set key
-- ARGV[1]: window size in milliseconds
-- ARGV[2]: request limit
-- ARGV[3]: caller-generated unique request ID
local key = KEYS[1]
local window_ms = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local request_id = ARGV[3]

if not window_ms or not limit or not request_id or window_ms <= 0 or limit <= 0 then
    return redis.error_reply('window, limit, and unique request ID are required')
end

local time = redis.call('time')
local now_ms = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
redis.call('zremrangebyscore', key, '-inf', now_ms - window_ms)

local current = redis.call('zcard', key)

if current < limit then
    local member = tostring(now_ms) .. ':' .. request_id
    redis.call('zadd', key, now_ms, member)
    redis.call('pexpire', key, window_ms + 1000)
    return {1, limit - current - 1, 0}
end

local oldest = redis.call('zrange', key, 0, 0, 'withscores')
local retry_after_ms = window_ms
if oldest[2] then
    retry_after_ms = math.max(1, math.ceil(tonumber(oldest[2]) + window_ms - now_ms))
end

redis.call('pexpire', key, window_ms + 1000)
return {0, 0, retry_after_ms}
