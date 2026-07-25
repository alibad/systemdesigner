type FieldError = {
  field: string;
  messageKey: string;
};

type Draft = {
  id: string;
  ownerId: string;
  answers: Record<string, string>;
  version: number;
};

type Review = {
  draftId: string;
  reviewToken: string;
  expiresAt: Date;
};

interface SubmissionStore {
  saveDraft(input: Omit<Draft, 'id' | 'version'>): Promise<Draft>;
  createReview(draft: Draft): Promise<Review>;
  commit(reviewToken: string, idempotencyKey: string): Promise<{ reference: string }>;
}

function validate(answers: Record<string, string>): FieldError[] {
  const errors: FieldError[] = [];

  if (!answers.fullName?.trim()) {
    errors.push({ field: 'fullName', messageKey: 'errors.fullName.required' });
  }
  if (!answers.contactMethod) {
    errors.push({ field: 'contactMethod', messageKey: 'errors.contactMethod.required' });
  }

  return errors;
}

export async function prepareSubmission(
  store: SubmissionStore,
  ownerId: string,
  answers: Record<string, string>,
) {
  const draft = await store.saveDraft({ ownerId, answers });
  const errors = validate(answers);

  if (errors.length > 0) {
    return {
      status: 'needs-correction' as const,
      draftId: draft.id,
      errors,
    };
  }

  const review = await store.createReview(draft);
  return {
    status: 'ready-for-review' as const,
    draftId: draft.id,
    reviewToken: review.reviewToken,
    expiresAt: review.expiresAt,
  };
}

export async function confirmSubmission(
  store: SubmissionStore,
  reviewToken: string,
  idempotencyKey: string,
) {
  // Only an explicit confirmation crosses the side-effect boundary.
  const receipt = await store.commit(reviewToken, idempotencyKey);
  return {
    status: 'submitted' as const,
    reference: receipt.reference,
    correctionRoute: `/submissions/${receipt.reference}/amend`,
  };
}
