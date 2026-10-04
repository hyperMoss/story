import { NextResponse } from "next/server";
import { z } from "zod";
import { accessCodeMatches, grantAccess } from "@/lib/auth";
import { routeError } from "@/lib/api-utils";

const AccessRequestSchema = z.object({
  code: z.string().max(200),
});

export async function POST(request: Request) {
  try {
    const { code } = AccessRequestSchema.parse(await request.json());
    if (!accessCodeMatches(code)) {
      return NextResponse.json(
        { error: { code: "invalid_access_code", message: "访问码不正确。" } },
        { status: 401 },
      );
    }
    await grantAccess();
    return NextResponse.json({ authorized: true });
  } catch (error) {
    return routeError(error);
  }
}
