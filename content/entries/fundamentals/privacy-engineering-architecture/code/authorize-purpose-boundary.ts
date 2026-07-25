type ProcessingRequest = {
  subjectId: string;
  purposeId: string;
  fields: string[];
  consentVersion?: string;
};

type PurposePolicy = {
  id: string;
  lawfulBasis: 'contract' | 'consent' | 'legitimate-interest';
  allowedFields: Set<string>;
  retentionDays: number;
};

type ConsentStore = {
  isActive(subjectId: string, purposeId: string, version?: string): Promise<boolean>;
};

export async function authorizeProcessing(
  request: ProcessingRequest,
  policy: PurposePolicy,
  consentStore: ConsentStore,
) {
  if (request.purposeId !== policy.id) {
    return { allowed: false, reason: 'PURPOSE_MISMATCH' } as const;
  }

  const excessFields = request.fields.filter(
    (field) => !policy.allowedFields.has(field),
  );
  if (excessFields.length > 0) {
    return {
      allowed: false,
      reason: 'DATA_MINIMIZATION_FAILED',
      excessFields,
    } as const;
  }

  if (policy.lawfulBasis === 'consent') {
    const active = await consentStore.isActive(
      request.subjectId,
      request.purposeId,
      request.consentVersion,
    );
    if (!active) {
      return { allowed: false, reason: 'CONSENT_INACTIVE' } as const;
    }
  }

  return {
    allowed: true,
    policyId: policy.id,
    retentionDays: policy.retentionDays,
    authorizedFields: request.fields,
  } as const;
}
