import { NextResponse } from "next/server";
import { AnalyzeRequestSchema } from "@/lib/domain";
import { requireApiAccess, routeError } from "@/lib/api-utils";
import { analyzeStory } from "@/lib/story-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await requireApiAccess();
  if (denied) return denied;
  try {
    const input = AnalyzeRequestSchema.parse(await request.json());
    return NextResponse.json(await analyzeStory(input));
  } catch (error) {
    return routeError(error);
  }
}
