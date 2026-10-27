import { NextResponse, type NextRequest } from "next/server";

import { createWebEnquiry, rateLimit } from "@/lib/dal/intake";
import { webEnquirySchema } from "@/lib/validation";

// Public endpoint for the enquiry form on dkliftservices.co.uk. Accepts JSON or a plain
// HTML form post. Allowed origins come from ENQUIRY_ALLOWED_ORIGINS (comma separated).

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = (process.env.ENQUIRY_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request.headers.get("origin"));
  const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await rateLimit(`enquiry:${ip}`, 10, 3600))) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429, headers });
  }

  const type = request.headers.get("content-type") ?? "";
  let body: Record<string, unknown>;
  try {
    body = type.includes("application/json")
      ? await request.json()
      : Object.fromEntries((await request.formData()).entries());
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400, headers });
  }

  const parsed = webEnquirySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid enquiry", issues: parsed.error.issues.map((i) => i.message) }, { status: 422, headers });
  }
  if (parsed.data.website) {
    // Honeypot filled in: accept silently so bots learn nothing.
    return NextResponse.json({ ok: true }, { status: 202, headers });
  }
  if (!parsed.data.email && !parsed.data.phone) {
    return NextResponse.json({ ok: false, error: "Provide an email or phone number" }, { status: 422, headers });
  }

  const ref = await createWebEnquiry(parsed.data);
  const redirectTo = typeof body.redirect === "string" ? body.redirect : null;
  if (redirectTo && !type.includes("application/json") && headers["Access-Control-Allow-Origin"] && redirectTo.startsWith(headers["Access-Control-Allow-Origin"])) {
    return NextResponse.redirect(redirectTo, 303);
  }
  return NextResponse.json({ ok: true, ref }, { status: 201, headers });
}
