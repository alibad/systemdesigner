raw = LOAD '/landing/orders' USING PigStorage(',')
    AS (order_id:long, customer_id:long, amount:double, country:chararray);

good = FILTER raw BY
    order_id IS NOT NULL AND customer_id IS NOT NULL AND amount >= 0;
bad = FILTER raw BY
    order_id IS NULL OR customer_id IS NULL OR amount IS NULL OR amount < 0;

projected = FOREACH good GENERATE order_id, customer_id, amount, country;

DESCRIBE projected;
ILLUSTRATE projected;
EXPLAIN projected;

STORE projected INTO '/curated/orders' USING PigStorage('\t');
STORE bad INTO '/quarantine/orders' USING PigStorage('\t');
