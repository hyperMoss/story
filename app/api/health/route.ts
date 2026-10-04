import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    modelMode: process.env.STORY_MODEL_MODE?.trim() || "fake",
  });
}
