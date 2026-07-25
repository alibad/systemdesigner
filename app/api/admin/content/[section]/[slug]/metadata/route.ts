import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { adminApiErrorResponse } from '@/lib/admin-api-response';
import {
  getAdminContentMetadata,
  publishAdminContentMetadata,
} from '@/lib/admin-content-resources';
import { requireAdmin } from '@/lib/server-admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UpdateMetadataSchema = z.object({
  metadata: z.unknown(),
  expectedVersion: z.string().min(1),
  message: z.string().max(160).optional(),
});

interface RouteContext {
  params: { section: string; slug: string };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin(request);
    return NextResponse.json(await getAdminContentMetadata(params.section, params.slug), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const actor = await requireAdmin(request);
    const payload = UpdateMetadataSchema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json(
        { error: 'Metadata, its current version, and an optional publication note are required.' },
        { status: 400 },
      );
    }
    const result = await publishAdminContentMetadata(
      params.section,
      params.slug,
      payload.data.metadata,
      payload.data.expectedVersion,
      actor,
      payload.data.message,
    );
    revalidatePath(`/${params.section}/${params.slug}`);
    return NextResponse.json(result);
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
