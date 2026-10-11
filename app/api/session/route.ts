import { NextResponse } from "next/server";
import { accessIsRequired, isAuthorized } from "@/lib/auth";
import { customModelAllowed } from "@/lib/model-gateway";

export async function GET() {
  return NextResponse.json({
    required: accessIsRequired(),
    authorized: await isAuthorized(),
    modelMode: process.env.STORY_MODEL_MODE?.trim() || "fake",
    customModelAllowed: customModelAllowed(),
  });
}
