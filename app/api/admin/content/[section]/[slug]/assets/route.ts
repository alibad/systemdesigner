import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminApiErrorResponse } from '@/lib/admin-api-response';
import {
  deleteAdminContentAsset,
  getAdminContentAssets,
  readAdminContentAsset,
  upsertAdminContentAsset,
} from '@/lib/admin-content-resources';
import { requireAdmin } from '@/lib/server-admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const AssetKindSchema = z.enum(['code', 'quiz', 'data']);
const AssetMutationSchema = z.object({
  kind: AssetKindSchema,
  fileName: z.string().min(1).max(180),
  expectedVersion: z.string().min(1),
  content: z.string().optional(),
});

interface RouteContext {
  params: Promise<{ section: string; slug: string }>;
}

export async function GET(request: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    await requireAdmin(request);
    const kind = request.nextUrl.searchParams.get('kind');
    const fileName = request.nextUrl.searchParams.get('file');
    if (kind && fileName) {
      const parsedKind = AssetKindSchema.safeParse(kind);
      if (!parsedKind.success) {
        return NextResponse.json({ error: 'Unknown asset type.' }, { status: 400 });
      }
      return NextResponse.json(
        await readAdminContentAsset(params.section, params.slug, parsedKind.data, fileName),
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return NextResponse.json(await getAdminContentAssets(params.section, params.slug), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}

export async function POST(request: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    const actor = await requireAdmin(request);
    const payload = AssetMutationSchema.safeParse(await request.json());
    if (!payload.success || payload.data.content === undefined) {
      return NextResponse.json(
        { error: 'Asset type, filename, content, and current version are required.' },
        { status: 400 },
      );
    }
    return NextResponse.json(
      await upsertAdminContentAsset(
        params.section,
        params.slug,
        payload.data.kind,
        payload.data.fileName,
        payload.data.content,
        payload.data.expectedVersion,
        actor,
      ),
    );
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    const actor = await requireAdmin(request);
    const payload = AssetMutationSchema.omit({ content: true }).safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json(
        { error: 'Asset type, filename, and current version are required.' },
        { status: 400 },
      );
    }
    return NextResponse.json(
      await deleteAdminContentAsset(
        params.section,
        params.slug,
        payload.data.kind,
        payload.data.fileName,
        payload.data.expectedVersion,
        actor,
      ),
    );
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
