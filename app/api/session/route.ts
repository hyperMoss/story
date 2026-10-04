import { NextResponse } from "next/server";
import { accessIsRequired, isAuthorized } from "@/lib/auth";

export async function GET() {
  return NextResponse.json({
    required: accessIsRequired(),
    authorized: await isAuthorized(),
    modelMode: process.env.STORY_MODEL_MODE?.trim() || "fake",
  });
}
