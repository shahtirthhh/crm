import { get } from "@vercel/blob";
import { NextResponse } from "next/server";

import { getDocument } from "@/lib/dal/documents";
import { getCurrentUser } from "@/lib/dal/session";
import { maybeOid } from "@/lib/dal/util";

// Private blobs are only reachable through this authenticated route.
export async function GET(_request: Request, { params }: RouteContext<"/api/documents/[id]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const id = maybeOid((await params).id);
  const doc = id ? await getDocument(id) : null;
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const blob = await get(doc.pathname, { access: "private" });
  if (!blob || blob.statusCode !== 200) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(blob.stream, {
    headers: {
      "Content-Type": doc.contentType ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.name)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
