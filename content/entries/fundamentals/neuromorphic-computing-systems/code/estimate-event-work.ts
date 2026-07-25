type EventWorkInput = {
  sampleRateHz: number;
  channels: number;
  fanout: number;
  eventsPerSecond: number;
  peakMultiplier: number;
  routerCapacityEventsPerSecond: number;
};

export function estimateEventWork(input: EventWorkInput) {
  const denseOpportunities =
    input.sampleRateHz * input.channels * input.fanout;
  const eventDrivenAdds = input.eventsPerSecond * input.fanout;
  const peakEventsPerSecond =
    input.eventsPerSecond * input.peakMultiplier;

  return {
    denseOpportunities,
    eventDrivenAdds,
    eventWorkShare: eventDrivenAdds / denseOpportunities,
    routerUtilization:
      peakEventsPerSecond / input.routerCapacityEventsPerSecond,
  };
}

const estimate = estimateEventWork({
  sampleRateHz: 1_000,
  channels: 160,
  fanout: 20,
  eventsPerSecond: 24_000,
  peakMultiplier: 2.3,
  routerCapacityEventsPerSecond: 170_000,
});

console.log(estimate);
