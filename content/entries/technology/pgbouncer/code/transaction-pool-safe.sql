BEGIN;

-- Transaction-local settings disappear at COMMIT and never leak to another client.
SET LOCAL search_path = app, public;
SET LOCAL statement_timeout = '2s';

SELECT id, status
FROM app.orders
WHERE id = $1;

COMMIT;
