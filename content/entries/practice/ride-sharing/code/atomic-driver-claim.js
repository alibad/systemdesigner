import { pathToFileURL } from 'node:url';

function claimDriver(state, command) {
  const prior = state.commandResults.get(command.commandId);
  if (prior) return prior;

  if (state.trip.status !== 'SEARCHING') {
    const result = { ok: false, reason: 'trip-not-searching' };
    state.commandResults.set(command.commandId, result);
    return result;
  }

  if (state.driver.activeTripId !== null || state.driver.version !== command.expectedDriverVersion) {
    const result = { ok: false, reason: 'driver-already-claimed' };
    state.commandResults.set(command.commandId, result);
    return result;
  }

  state.driver.activeTripId = state.trip.id;
  state.driver.version += 1;
  state.trip.driverId = state.driver.id;
  state.trip.status = 'DRIVER_ASSIGNED';
  state.outbox.push({
    id: `trip-assigned:${state.trip.id}`,
    type: 'trip.assigned',
    tripId: state.trip.id,
    driverId: state.driver.id,
  });

  const result = { ok: true, tripId: state.trip.id, driverId: state.driver.id };
  state.commandResults.set(command.commandId, result);
  return result;
}

function createState() {
  return {
    trip: { id: 'trip-42', status: 'SEARCHING', driverId: null },
    driver: { id: 'driver-7', version: 11, activeTripId: null },
    outbox: [],
    commandResults: new Map(),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const state = createState();
  const first = claimDriver(state, { commandId: 'accept-1', expectedDriverVersion: 11 });
  const retry = claimDriver(state, { commandId: 'accept-1', expectedDriverVersion: 11 });
  const competitor = claimDriver(state, { commandId: 'accept-2', expectedDriverVersion: 11 });

  console.assert(first.ok, 'the first claim should commit');
  console.assert(retry === first, 'a retry should return the stored result');
  console.assert(!competitor.ok, 'a competing claim should be rejected');
  console.assert(state.outbox.length === 1, 'one assignment should emit one event');

  console.log(JSON.stringify({ first, retry, competitor, state: { trip: state.trip, driver: state.driver, outbox: state.outbox } }, null, 2));
}

export { claimDriver, createState };
