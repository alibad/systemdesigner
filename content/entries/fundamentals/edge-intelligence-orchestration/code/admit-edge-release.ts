type NodeSnapshot = {
  nodeId: string;
  observedAtMs: number;
  freeMemoryMb: number;
  acceleratorTops: number;
  supportedOpset: number;
  labels: Record<string, string>;
};

type ReleaseContract = {
  artifactDigest: `sha256:${string}`;
  signatureVerified: boolean;
  modelMemoryMb: number;
  minimumTops: number;
  requiredOpset: number;
  requiredLabels: Record<string, string>;
  maximumSnapshotAgeMs: number;
};

type Admission =
  | { admitted: true; nodeId: string; artifactDigest: string }
  | { admitted: false; reasons: string[] };

export function admitRelease(
  contract: ReleaseContract,
  node: NodeSnapshot,
  nowMs: number,
): Admission {
  const reasons: string[] = [];

  if (!contract.signatureVerified) {
    reasons.push('artifact signature or signer policy did not verify');
  }
  if (nowMs - node.observedAtMs > contract.maximumSnapshotAgeMs) {
    reasons.push('capability snapshot is stale');
  }
  if (node.freeMemoryMb < contract.modelMemoryMb * 1.2) {
    reasons.push('less than 20% memory headroom remains after model load');
  }
  if (node.acceleratorTops < contract.minimumTops) {
    reasons.push('accelerator throughput is below the declared minimum');
  }
  if (node.supportedOpset < contract.requiredOpset) {
    reasons.push('runtime cannot load the model opset');
  }

  for (const [key, value] of Object.entries(contract.requiredLabels)) {
    if (node.labels[key] !== value) {
      reasons.push(`required node label ${key}=${value} is absent`);
    }
  }

  return reasons.length
    ? { admitted: false, reasons }
    : {
        admitted: true,
        nodeId: node.nodeId,
        artifactDigest: contract.artifactDigest,
      };
}
