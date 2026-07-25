'use strict';

function assessInboundVideo(previous, current) {
  const elapsedSeconds = (current.timestampMs - previous.timestampMs) / 1000;
  if (elapsedSeconds <= 0) throw new RangeError('timestamps must increase');

  const receivedDelta = current.packetsReceived - previous.packetsReceived;
  const lostDelta = current.packetsLost - previous.packetsLost;
  const bytesDelta = current.bytesReceived - previous.bytesReceived;
  const packetTotal = Math.max(1, receivedDelta + lostDelta);
  const lossPct = (lostDelta / packetTotal) * 100;
  const bitrateKbps = (bytesDelta * 8) / elapsedSeconds / 1000;
  const rttMs = current.roundTripTimeSeconds * 1000;
  const jitterMs = current.jitterSeconds * 1000;

  const reasons = [];
  if (lossPct > 3) reasons.push('packet loss exceeds 3%');
  if (rttMs > 300) reasons.push('round-trip time exceeds 300 ms');
  if (jitterMs > 30) reasons.push('jitter exceeds 30 ms');
  if (bitrateKbps < 500) reasons.push('received bitrate is below 500 Kbps');

  return {
    bitrateKbps: Math.round(bitrateKbps),
    jitterMs: Math.round(jitterMs),
    lossPct: Number(lossPct.toFixed(2)),
    rttMs: Math.round(rttMs),
    status: reasons.length === 0 ? 'healthy' : 'degraded',
    reasons,
  };
}

export { assessInboundVideo };

if (typeof process !== 'undefined' && process.argv[1]?.endsWith('/measure-call-quality.js')) {
  const previous = {
    timestampMs: 10_000,
    packetsReceived: 10_000,
    packetsLost: 100,
    bytesReceived: 8_000_000,
  };
  const current = {
    timestampMs: 15_000,
    packetsReceived: 10_450,
    packetsLost: 125,
    bytesReceived: 8_350_000,
    roundTripTimeSeconds: 0.34,
    jitterSeconds: 0.041,
  };

  const assessment = assessInboundVideo(previous, current);
  console.assert(assessment.status === 'degraded');
  console.assert(assessment.lossPct === 5.26);
  console.log(assessment);
}
