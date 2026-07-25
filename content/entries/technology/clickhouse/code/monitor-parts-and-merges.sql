SELECT
    database,
    table,
    partition,
    count() AS active_parts,
    sum(rows) AS rows
FROM system.parts
WHERE active
GROUP BY database, table, partition
ORDER BY active_parts DESC;

SELECT
    database,
    table,
    elapsed,
    progress,
    num_parts
FROM system.merges
ORDER BY elapsed DESC;
