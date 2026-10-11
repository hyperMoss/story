import { NextResponse } from "next/server";
import { requireApiAccess, routeError } from "@/lib/api-utils";
import { ModelProbeRequestSchema } from "@/lib/model-config";
import {
  customModelAllowed,
  listCustomModels,
  ModelGatewayError,
  probeCustomModel,
} from "@/lib/model-gateway";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await requireApiAccess();
  if (denied) return denied;

  if (!customModelAllowed()) {
    return NextResponse.json(
      {
        error: {
          code: "model_not_configured",
          message: "当前部署未开放自定义模型接入，请联系部署方。",
        },
      },
      { status: 403 },
    );
  }

  try {
    const input = ModelProbeRequestSchema.parse(await request.json());

    if (input.action === "list") {
      const models = await listCustomModels(input.config);
      return NextResponse.json({ ok: true, models, message: `读取到 ${models.length} 个模型。` });
    }

    const probe = await probeCustomModel(input.config);
    return NextResponse.json({
      ok: true,
      latencyMs: probe.latencyMs,
      message: `连接成功，模型 ${probe.latencyMs} ms 内返回。`,
    });
  } catch (error) {
    if (error instanceof ModelGatewayError) {
      return NextResponse.json(
        { ok: false, error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    const response = routeError(error);
    return response;
  }
}
