import { NextResponse } from "next/server";
import sessions from "@/content/learning/sessions.json";
import { PracticeStepSchema } from "@/lib/learning-path";

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!Object.hasOwn(sessions, params.id))
    return NextResponse.json(
      { error: "Learning session not found" },
      { status: 404 },
    );
  const session = PracticeStepSchema.parse(
    sessions[params.id as keyof typeof sessions],
  );
  const revision = new URL(request.url).searchParams.get('learningRevision');
  if (revision && revision !== session.revision) return NextResponse.json({error:'The curriculum changed. Reload the learning page.'},{status:409});
  return NextResponse.json(session, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
