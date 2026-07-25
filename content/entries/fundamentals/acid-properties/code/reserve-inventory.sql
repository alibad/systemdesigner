BEGIN;

-- The condition makes a reservation impossible when stock is already exhausted.
UPDATE inventory
SET available = available - 1
WHERE sku = :sku
  AND available > 0;

-- Abort and return "sold out" when the update affected zero rows.
-- The application checks this result before running the statements below.

INSERT INTO orders (id, customer_id, sku, status)
VALUES (:order_id, :customer_id, :sku, 'reserved');

INSERT INTO outbox_events (id, topic, payload)
VALUES (:event_id, 'order.reserved', :event_payload);

COMMIT;
