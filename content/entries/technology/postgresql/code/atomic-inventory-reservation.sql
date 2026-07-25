CREATE TABLE inventory (
    sku text PRIMARY KEY,
    available integer NOT NULL CHECK (available >= 0)
);

CREATE TABLE reservations (
    request_id uuid PRIMARY KEY,
    sku text NOT NULL REFERENCES inventory (sku),
    quantity integer NOT NULL CHECK (quantity > 0),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- The unique request ID is the idempotency boundary. If two copies race, one
-- INSERT fails and PostgreSQL rolls its entire transaction back, including the
-- inventory UPDATE. A retry then reads the reservation committed by the winner.
CREATE FUNCTION reserve_inventory(
    requested_id uuid,
    requested_sku text,
    requested_quantity integer
) RETURNS reservations
LANGUAGE plpgsql
AS $$
DECLARE
    existing reservations%ROWTYPE;
    created reservations%ROWTYPE;
    claimed_sku text;
BEGIN
    SELECT * INTO existing
      FROM reservations
     WHERE request_id = requested_id;

    IF FOUND THEN
        RETURN existing;
    END IF;

    UPDATE inventory
       SET available = available - requested_quantity
     WHERE sku = requested_sku
       AND requested_quantity > 0
       AND available >= requested_quantity
     RETURNING sku INTO claimed_sku;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'insufficient inventory for %', requested_sku;
    END IF;

    INSERT INTO reservations (request_id, sku, quantity)
    VALUES (requested_id, claimed_sku, requested_quantity)
    RETURNING * INTO created;

    RETURN created;
END;
$$;

SELECT * FROM reserve_inventory(
    '4ac9a188-a9bc-4ad7-a6fa-2f923707a9c0',
    'camera-42',
    2
);
