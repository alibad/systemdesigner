import { NextRequest, NextResponse } from 'next/server';
import { adminApiErrorResponse } from '@/lib/admin-api-response';
import {
  createAdminLesson,
  getNewLessonOptions,
} from '@/lib/admin-content-resources';
import { requireAdmin } from '@/lib/server-admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    return NextResponse.json(await getNewLessonOptions(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdmin(request);
    return NextResponse.json(await createAdminLesson(await request.json(), actor), {
      status: 201,
    });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
