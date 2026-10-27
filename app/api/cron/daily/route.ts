import { NextResponse, type NextRequest } from "next/server";

import { runDailySweep } from "@/lib/dal/automation";
import { ensureDatabase } from "@/lib/db/bootstrap";

// Called by Vercel Cron (see vercel.json) with "Authorization: Bearer $CRON_SECRET".
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  await ensureDatabase();
  const result = await runDailySweep();
  return NextResponse.json({ ok: true, ...result });
}
