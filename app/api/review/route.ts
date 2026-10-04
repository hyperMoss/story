import { NextResponse } from "next/server";
import { ReviewRequestSchema } from "@/lib/domain";
import { requireApiAccess, routeError } from "@/lib/api-utils";
import { reviewStory } from "@/lib/story-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await requireApiAccess();
  if (denied) return denied;
  try {
    const input = ReviewRequestSchema.parse(await request.json());
    return NextResponse.json(await reviewStory(input));
  } catch (error) {
    return routeError(error);
  }
}
