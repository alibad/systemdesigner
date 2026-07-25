%default EVENTS '/data/events/2026-07-24'
%default CUSTOMERS '/reference/active-customers'
%default OUTPUT '/derived/session-summary/2026-07-24'

events = LOAD '$EVENTS' USING PigStorage('\t')
    AS (event_id:chararray, customer_id:long, session_id:chararray,
        event_type:chararray, duration_ms:long);

valid_events = FILTER events BY
    event_id IS NOT NULL AND customer_id IS NOT NULL AND duration_ms >= 0;

thin_events = FOREACH valid_events GENERATE
    customer_id, session_id, event_type, duration_ms;

customers = LOAD '$CUSTOMERS' USING PigStorage('\t')
    AS (customer_id:long, region:chararray, active:boolean);
active_customers = FILTER customers BY active == true;

joined = JOIN thin_events BY customer_id,
              active_customers BY customer_id USING 'replicated';

enriched = FOREACH joined GENERATE
    thin_events::session_id AS session_id,
    active_customers::region AS region,
    thin_events::duration_ms AS duration_ms;

by_region = GROUP enriched BY region PARALLEL 48;
summary = FOREACH by_region GENERATE
    group AS region,
    COUNT(enriched) AS event_count,
    SUM(enriched.duration_ms) AS total_duration_ms;

STORE summary INTO '$OUTPUT' USING PigStorage('\t');
