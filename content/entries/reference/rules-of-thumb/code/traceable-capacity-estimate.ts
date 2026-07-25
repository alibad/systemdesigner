type CapacityInput = {
  dailyActiveUsers: number;
  actionsPerUserPerDay: number;
  peakFactor: number;
  measuredNodeRps: number;
  targetUtilization: number;
  failureReserveNodes: number;
};

type EstimateStep = {
  name: string;
  formula: string;
  value: number;
  unit: string;
};

export function estimateAppFleet(input: CapacityInput) {
  const secondsPerDay = 86_400;
  const operationsPerDay = input.dailyActiveUsers * input.actionsPerUserPerDay;
  const averageRps = operationsPerDay / secondsPerDay;
  const peakRps = averageRps * input.peakFactor;
  const safeNodeRps = input.measuredNodeRps * input.targetUtilization;
  const servingNodes = Math.ceil(peakRps / safeNodeRps);
  const plannedNodes = servingNodes + input.failureReserveNodes;

  const steps: EstimateStep[] = [
    {
      name: 'Daily operations',
      formula: 'daily active users x actions per user per day',
      value: operationsPerDay,
      unit: 'operations/day',
    },
    {
      name: 'Average request rate',
      formula: 'daily operations / 86,400 seconds per day',
      value: averageRps,
      unit: 'requests/second',
    },
    {
      name: 'Peak request rate',
      formula: 'average requests/second x peak factor',
      value: peakRps,
      unit: 'requests/second',
    },
    {
      name: 'Safe capacity per node',
      formula: 'measured node requests/second x target utilization',
      value: safeNodeRps,
      unit: 'requests/second/node',
    },
  ];

  return {
    assumptions: input,
    steps,
    servingNodes,
    plannedNodes,
    review: `Round up to ${servingNodes} serving nodes, then add ${input.failureReserveNodes} explicit failure-reserve node(s).`,
  };
}
