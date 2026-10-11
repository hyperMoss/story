import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { isAuthorized } from "@/lib/auth";
import {
  decodeModelConfig,
  MODEL_CONFIG_HEADER,
  type CustomModelConfig,
} from "@/lib/model-config";
import { ModelGatewayError } from "@/lib/model-gateway";

export async function requireApiAccess() {
  if (await isAuthorized()) return null;
  return NextResponse.json(
    { error: { code: "unauthorized", message: "访问码已失效，请重新进入。" } },
    { status: 401 },
  );
}

/**
 * 读取浏览器随请求携带的自定义模型配置。
 * 解析失败一律降级为 undefined，回落到服务端环境变量，而不是中断请求。
 */
export function customConfigFrom(request: Request): CustomModelConfig | undefined {
  return decodeModelConfig(request.headers.get(MODEL_CONFIG_HEADER));
}

export function routeError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_request",
          message: error.issues[0]?.message ?? "输入内容不完整。",
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof ModelGatewayError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  console.error("Unhandled story route error", error);
  return NextResponse.json(
    { error: { code: "internal_error", message: "服务暂时不可用，请稍后重试。" } },
    { status: 500 },
  );
}
