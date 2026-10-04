import { NextResponse } from "next/server";
import { TurnRequestSchema } from "@/lib/domain";
import { requireApiAccess, routeError } from "@/lib/api-utils";
import { proposeTurn } from "@/lib/story-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await requireApiAccess();
  if (denied) return denied;
  try {
    const input = TurnRequestSchema.parse(await request.json());
    return NextResponse.json(await proposeTurn(input));
  } catch (error) {
    return routeError(error);
  }
}
