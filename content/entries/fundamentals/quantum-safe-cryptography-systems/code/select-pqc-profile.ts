type Purpose = 'kem' | 'signature';

type Primitive = {
  id: string;
  purpose: Purpose;
  publicKeyBytes: number;
  outputBytes: number;
};

type ProtocolEnvelope = {
  requiredPurpose: Purpose;
  transportBudgetBytes: number;
  sendsPublicKeyPerOperation: boolean;
};

export function selectProfile(
  primitive: Primitive,
  envelope: ProtocolEnvelope,
) {
  if (primitive.purpose !== envelope.requiredPurpose) {
    throw new Error(
      `${primitive.id} cannot satisfy ${envelope.requiredPurpose}`,
    );
  }

  const transportBytes =
    primitive.outputBytes +
    (envelope.sendsPublicKeyPerOperation
      ? primitive.publicKeyBytes
      : 0);

  return {
    primitive: primitive.id,
    transportBytes,
    withinBudget:
      transportBytes <= envelope.transportBudgetBytes,
  };
}

const profile = selectProfile(
  {
    id: 'ML-KEM-768',
    purpose: 'kem',
    publicKeyBytes: 1184,
    outputBytes: 1088,
  },
  {
    requiredPurpose: 'kem',
    transportBudgetBytes: 2600,
    sendsPublicKeyPerOperation: true,
  },
);

console.log(profile);
