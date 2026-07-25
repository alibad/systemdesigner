import { db } from './database';

type ReserveSeat = {
  requestId: string;
  showId: string;
  seatId: string;
  buyerId: string;
};

export async function reserveSeat(command: ReserveSeat) {
  return db.transaction(async (transaction) => {
    const prior = await transaction.reservations.findByRequestId(command.requestId);
    if (prior) return prior;

    const reservation = await transaction.reservations.insert({
      showId: command.showId,
      seatId: command.seatId,
      buyerId: command.buyerId,
      status: 'confirmed',
    });

    await transaction.outbox.insert({
      eventId: `reservation:${reservation.id}`,
      type: 'reservation.confirmed',
      payload: { reservationId: reservation.id, buyerId: command.buyerId },
    });

    return reservation;
  });
}
