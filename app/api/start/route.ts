import { NextResponse } from "next/server";
import { StartRequestSchema } from "@/lib/domain";
import { requireApiAccess, routeError } from "@/lib/api-utils";
import { startStory } from "@/lib/story-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await requireApiAccess();
  if (denied) return denied;
  try {
    const input = StartRequestSchema.parse(await request.json());
    return NextResponse.json(await startStory(input));
  } catch (error) {
    return routeError(error);
  }
}
