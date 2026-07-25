BEGIN;

-- The command key survives client, gateway, and dispatcher retries.
INSERT INTO trip_commands (
  trip_id,
  idempotency_key,
  command_type,
  requested_at
)
VALUES ($1, $2, 'assign_driver', now())
ON CONFLICT (trip_id, idempotency_key) DO NOTHING;

-- Only the expected trip version may claim the driver.
UPDATE trips
SET driver_id = $3,
    state = 'assigned',
    version = version + 1,
    updated_at = now()
WHERE trip_id = $1
  AND state = 'requested'
  AND version = $4;

-- The real implementation returns the prior command result when the
-- idempotency key already exists and publishes one outbox event on commit.
COMMIT;
