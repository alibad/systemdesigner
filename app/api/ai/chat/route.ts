import { NextResponse } from "next/server";

export const dynamic = "force-static";

// The assistant route was removed in frontend-only mode. Next 15 requires a route
// file to export a handler, so this answers explicitly instead of existing as a
// bare configuration file.
export function GET() {
  return NextResponse.json({ error: "Not available." }, { status: 404 });
}
