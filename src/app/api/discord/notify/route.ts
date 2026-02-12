import { NextRequest, NextResponse } from "next/server";
import { sendDiscordNotification } from "@/app/lib/discord";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, data } = body;

    const result = await sendDiscordNotification(type, data);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("❌ Discord notification API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
