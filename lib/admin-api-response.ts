import { NextResponse } from 'next/server';
import {
  ContentEditConflictError,
  ContentDraftNotFoundError,
  ContentEntryNotFoundError,
  ContentPersistenceConfigError,
  ContentRevisionNotFoundError,
  ContentValidationError,
} from '@/lib/admin-content';
import { AdminAuthenticationError } from '@/lib/server-admin-auth';

export function adminApiErrorResponse(error: unknown): NextResponse {
  if (error instanceof AdminAuthenticationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ContentEntryNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ContentDraftNotFoundError || error instanceof ContentRevisionNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ContentValidationError) {
    return NextResponse.json(
      { error: 'Content validation failed.', issues: error.issues },
      { status: 422 },
    );
  }
  if (error instanceof ContentEditConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof ContentPersistenceConfigError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: 'The request body is not valid JSON.' }, { status: 400 });
  }
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    error.status === 403
  ) {
    return NextResponse.json(
      {
        error:
          'The GitHub App cannot edit content. Grant it repository Contents: Read and write permission.',
      },
      { status: 503 },
    );
  }

  console.error('Admin content API failed:', error);
  return NextResponse.json({ error: 'The content editor request failed.' }, { status: 500 });
}
