import { randomUUID } from 'node:crypto';

type SeatReserved = {
  type: 'SeatReserved.v1';
  data: {
    reservationId: string;
    customerId: string;
  };
};

type ShowCreated = {
  type: 'ShowCreated.v1';
  data: {
    capacity: number;
  };
};

type ShowEvent = ShowCreated | SeatReserved;

type StoredEvent<TEvent> = TEvent & {
  id: string;
  streamRevision: number;
  metadata: {
    commandId: string;
    correlationId: string;
    recordedAt: string;
  };
};

type NewEvent<TEvent> = TEvent & {
  id: string;
  metadata: {
    commandId: string;
    correlationId: string;
  };
};

class WrongExpectedRevisionError extends Error {}

interface EventStore {
  readStream(streamId: string): Promise<{
    revision: number;
    events: Array<StoredEvent<ShowEvent>>;
  }>;

  findByCommandId(
    streamId: string,
    commandId: string,
  ): Promise<StoredEvent<ShowEvent> | null>;

  appendToStream(
    streamId: string,
    expectedRevision: number,
    events: Array<NewEvent<ShowEvent>>,
  ): Promise<{ nextRevision: number }>;
}

type ReserveSeat = {
  commandId: string;
  correlationId: string;
  showId: string;
  reservationId: string;
  customerId: string;
};

type ShowState = {
  capacity: number;
  reserved: number;
};

function evolve(state: ShowState, event: ShowEvent): ShowState {
  switch (event.type) {
    case 'ShowCreated.v1':
      return { capacity: event.data.capacity, reserved: 0 };
    case 'SeatReserved.v1':
      return { ...state, reserved: state.reserved + 1 };
  }
}

function rehydrate(events: Array<StoredEvent<ShowEvent>>): ShowState {
  return events.reduce<ShowState>(
    (state, event) => evolve(state, event),
    { capacity: 0, reserved: 0 },
  );
}

export async function reserveSeat(
  store: EventStore,
  command: ReserveSeat,
): Promise<
  | { status: 'reserved'; streamRevision: number }
  | { status: 'sold-out'; streamRevision: number }
> {
  const streamId = `show-${command.showId}`;

  // A transport retry of the same command returns the first committed result.
  const prior = await store.findByCommandId(streamId, command.commandId);
  if (prior) {
    return { status: 'reserved', streamRevision: prior.streamRevision };
  }

  // One retry is enough to demonstrate reload + re-evaluate. Production policy
  // should use a measured bound and return a conflict when contention persists.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const stream = await store.readStream(streamId);
    const state = rehydrate(stream.events);

    if (state.reserved >= state.capacity) {
      return { status: 'sold-out', streamRevision: stream.revision };
    }

    const event: NewEvent<SeatReserved> = {
      id: randomUUID(),
      type: 'SeatReserved.v1',
      data: {
        reservationId: command.reservationId,
        customerId: command.customerId,
      },
      metadata: {
        commandId: command.commandId,
        correlationId: command.correlationId,
      },
    };

    try {
      const result = await store.appendToStream(
        streamId,
        stream.revision,
        [event],
      );
      return { status: 'reserved', streamRevision: result.nextRevision };
    } catch (error) {
      if (!(error instanceof WrongExpectedRevisionError) || attempt === 1) {
        throw error;
      }

      // Another command changed the stream. Loop once to reload the new state
      // and run the seat invariant again; never retry the stale append blindly.
    }
  }

  throw new Error('Unreachable');
}
