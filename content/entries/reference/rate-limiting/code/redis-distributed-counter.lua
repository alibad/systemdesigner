-- Atomic counter for one anchored fixed window.
-- KEYS[1]: counter key
-- ARGV[1]: request limit
-- ARGV[2]: window size in milliseconds
-- ARGV[3]: cost of this request
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local increment = tonumber(ARGV[3])

if not limit or not window_ms or not increment
    or limit <= 0 or window_ms <= 0 or increment <= 0 then
    return redis.error_reply('limit, window, and request cost must be positive')
end

local current = tonumber(redis.call('get', key)) or 0
if current + increment <= limit then
    local new_count = redis.call('incrby', key, increment)
    local ttl_ms = redis.call('pttl', key)
    if ttl_ms < 0 then
        redis.call('pexpire', key, window_ms)
        ttl_ms = window_ms
    end
    return {1, limit - new_count, ttl_ms}
end

local ttl_ms = redis.call('pttl', key)
if ttl_ms < 0 then
    redis.call('pexpire', key, window_ms)
    ttl_ms = window_ms
end
return {0, math.max(0, limit - current), ttl_ms}
