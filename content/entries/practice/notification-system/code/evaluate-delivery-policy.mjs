import assert from 'node:assert/strict';

const MINUTES_PER_DAY = 24 * 60;

function inQuietHours(localMinute, startMinute, endMinute) {
  if (startMinute < endMinute) {
    return localMinute >= startMinute && localMinute < endMinute;
  }
  return localMinute >= startMinute || localMinute < endMinute;
}

function nextQuietHoursEnd(localMinute, startMinute, endMinute) {
  if (!inQuietHours(localMinute, startMinute, endMinute)) return localMinute;
  if (startMinute < endMinute || localMinute < endMinute) return endMinute;
  return MINUTES_PER_DAY + endMinute;
}

function evaluateDelivery(input) {
  if (!input.channelEnabled) {
    return { action: 'suppress', reason: 'channel_disabled' };
  }

  if (input.category === 'marketing' && input.sendsToday >= input.dailyCap) {
    return { action: 'suppress', reason: 'frequency_cap' };
  }

  const quiet = inQuietHours(
    input.localMinute,
    input.quietStartMinute,
    input.quietEndMinute,
  );
  if (quiet && input.category !== 'security') {
    return {
      action: 'schedule',
      reason: 'quiet_hours',
      sendAfterLocalMinute: nextQuietHoursEnd(
        input.localMinute,
        input.quietStartMinute,
        input.quietEndMinute,
      ),
    };
  }

  return { action: 'send', reason: 'eligible' };
}

const base = {
  category: 'marketing',
  channelEnabled: true,
  localMinute: 23 * 60,
  quietStartMinute: 22 * 60,
  quietEndMinute: 7 * 60,
  sendsToday: 1,
  dailyCap: 3,
};

const disabled = evaluateDelivery({ ...base, channelEnabled: false });
const scheduled = evaluateDelivery(base);
const capped = evaluateDelivery({ ...base, localMinute: 12 * 60, sendsToday: 3 });
const security = evaluateDelivery({ ...base, category: 'security' });

assert.deepEqual(disabled, { action: 'suppress', reason: 'channel_disabled' });
assert.deepEqual(scheduled, {
  action: 'schedule',
  reason: 'quiet_hours',
  sendAfterLocalMinute: 31 * 60,
});
assert.deepEqual(capped, { action: 'suppress', reason: 'frequency_cap' });
assert.deepEqual(security, { action: 'send', reason: 'eligible' });

console.log({ disabled, scheduled, capped, security });
