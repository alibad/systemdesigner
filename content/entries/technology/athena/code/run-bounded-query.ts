import {
  AthenaClient,
  GetQueryExecutionCommand,
  StartQueryExecutionCommand,
} from '@aws-sdk/client-athena';

const athena = new AthenaClient({ region: 'us-east-1' });

export async function runBoundedQuery(clientRequestToken: string) {
  const started = await athena.send(
    new StartQueryExecutionCommand({
      ClientRequestToken: clientRequestToken,
      QueryString: `
        SELECT event_type, COUNT(*) AS event_count
        FROM analytics.events_parquet
        WHERE event_date BETWEEN '2026-07-01' AND '2026-07-07'
        GROUP BY event_type
      `,
      WorkGroup: 'bounded-analytics',
    }),
  );

  if (!started.QueryExecutionId) throw new Error('Athena returned no execution ID');

  for (;;) {
    const response = await athena.send(
      new GetQueryExecutionCommand({ QueryExecutionId: started.QueryExecutionId }),
    );
    const execution = response.QueryExecution;
    const state = execution?.Status?.State;

    if (state === 'SUCCEEDED') {
      const scannedBytes = execution?.Statistics?.DataScannedInBytes ?? 0;
      return {
        executionId: started.QueryExecutionId,
        scannedGiB: scannedBytes / 1024 ** 3,
        engineTimeMs: execution?.Statistics?.EngineExecutionTimeInMillis ?? 0,
      };
    }

    if (state === 'FAILED' || state === 'CANCELLED') {
      throw new Error(execution?.Status?.StateChangeReason ?? `Query ${state}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
