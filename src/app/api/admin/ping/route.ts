// /app/api/admin/ping/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const token = req.headers.get("x-admin-token");


  if (!token || token !== process.env.ADMIN_API_TOKEN) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
