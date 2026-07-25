interface Replica {
  id: string;
  put(key: string, value: Uint8Array, version: string): Promise<void>;
}

interface WriteResult {
  version: string;
  acknowledgedBy: string[];
}

class QuorumUnavailableError extends Error {}

function waitForAcknowledgements(
  attempts: Array<Promise<string>>,
  required: number,
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const acknowledgements: string[] = [];
    let failures = 0;
    let settled = false;

    for (const attempt of attempts) {
      attempt
        .then((replicaId) => {
          if (settled) return;
          acknowledgements.push(replicaId);

          if (acknowledgements.length === required) {
            settled = true;
            resolve(acknowledgements);
          }
        })
        .catch(() => {
          if (settled) return;
          failures += 1;

          if (attempts.length - failures < required) {
            settled = true;
            reject(new QuorumUnavailableError('Write quorum cannot be reached'));
          }
        });
    }
  });
}

export async function writeWithQuorum(
  replicas: Replica[],
  key: string,
  value: Uint8Array,
  version: string,
  writeQuorum: number,
): Promise<WriteResult> {
  if (writeQuorum < 1 || writeQuorum > replicas.length) {
    throw new RangeError('writeQuorum must be between 1 and replica count');
  }

  const attempts = replicas.map(async (replica) => {
    await replica.put(key, value, version);
    return replica.id;
  });
  const acknowledgedBy = await waitForAcknowledgements(attempts, writeQuorum);

  return { version, acknowledgedBy };
}
