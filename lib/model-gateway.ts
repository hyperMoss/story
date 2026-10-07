import type { ZodType } from "zod";
import { fakeModelResponse, type ModelTask } from "@/lib/fake-model";

export class ModelGatewayError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 502,
  ) {
    super(message);
    this.name = "ModelGatewayError";
  }
}

const DEFAULT_MODEL_TIMEOUT_MS = 90_000;

type StructuredRequest<T> = {
  task: ModelTask;
  instruction: string;
  payload: unknown;
  schema: ZodType<T>;
};

function extractJson(content: string) {
  const unfenced = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new ModelGatewayError(
      "模型没有返回可识别的结构，请重试。",
      "invalid_model_response",
    );
  }
  try {
    return JSON.parse(unfenced.slice(start, end + 1)) as unknown;
  } catch {
    throw new ModelGatewayError(
      "模型返回的结构无法解析，请重试。",
      "invalid_model_response",
    );
  }
}

function normalizeStructuredResponse(task: ModelTask, value: unknown) {
  if (task !== "turn" || typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }

  const response = value as Record<string, unknown>;
  if (!Array.isArray(response.rationale) || response.rationale.length <= 4) {
    return value;
  }

  return { ...response, rationale: response.rationale.slice(0, 4) };
}

function validate<T>(task: ModelTask, schema: ZodType<T>, value: unknown) {
  const normalized = normalizeStructuredResponse(task, value);
  const result = schema.safeParse(normalized);
  if (!result.success) {
    console.error("Model response failed schema validation", result.error.issues);
    throw new ModelGatewayError(
      "模型返回的结构不符合要求，已阻止它写入剧情，请重试。",
      "invalid_model_response",
    );
  }
  return result.data;
}

export async function requestStructured<T>({
  task,
  instruction,
  payload,
  schema,
}: StructuredRequest<T>) {
  const mode = process.env.STORY_MODEL_MODE?.trim() || "fake";

  if (mode === "fake") {
    if (
      task === "analyze" &&
      typeof payload === "object" &&
      payload !== null &&
      "sourceText" in payload
    ) {
      const sourceText = String(payload.sourceText);
      if (sourceText.includes("[测试：慢响应]")) {
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
      if (sourceText.includes("[测试：模型失败]")) {
        throw new ModelGatewayError("模拟的模型服务失败，请重试。", "provider_error");
      }
      if (sourceText.includes("[测试：格式错误]")) {
        return validate(task, schema, { malformed: true });
      }
    }
    if (task === "review" && JSON.stringify(payload).includes("[测试：回顾失败]")) {
      throw new ModelGatewayError("模拟的回顾生成失败，请重试。", "provider_error");
    }
    return validate(task, schema, fakeModelResponse(task, payload));
  }

  if (mode !== "live") {
    throw new ModelGatewayError(
      "STORY_MODEL_MODE 只能是 fake 或 live。",
      "model_not_configured",
      500,
    );
  }

  const baseUrl = process.env.STORY_MODEL_BASE_URL?.replace(/\/$/, "");
  const apiKey = process.env.STORY_MODEL_API_KEY;
  const model = process.env.STORY_MODEL_NAME;
  if (!baseUrl || !apiKey || !model) {
    throw new ModelGatewayError(
      "真实模型尚未配置完整。",
      "model_not_configured",
      500,
    );
  }

  const endpoint = baseUrl.endsWith("/chat/completions")
    ? baseUrl
    : `${baseUrl}/chat/completions`;
  const configuredTimeoutMs = Number(
    process.env.STORY_MODEL_TIMEOUT_MS ?? DEFAULT_MODEL_TIMEOUT_MS,
  );
  const timeoutMs =
    Number.isFinite(configuredTimeoutMs) && configuredTimeoutMs > 0
      ? configuredTimeoutMs
      : DEFAULT_MODEL_TIMEOUT_MS;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: task === "analyze" ? 0.3 : 0.75,
        messages: [
          {
            role: "system",
            content:
              "你是互动叙事编辑。只返回一个合法 JSON 对象，不要使用 Markdown，不要展示思维链。推演依据只写可公开核验的简短因果说明。",
          },
          {
            role: "user",
            content: `${instruction}\n\n输入数据：\n${JSON.stringify(payload)}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new ModelGatewayError(
      timedOut ? "模型响应超时，请重试。" : "无法连接模型服务，请稍后重试。",
      timedOut ? "model_timeout" : "provider_error",
    );
  }

  if (!response.ok) {
    console.error("Model provider returned", response.status);
    throw new ModelGatewayError("模型服务暂时不可用，请稍后重试。", "provider_error");
  }

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) {
    throw new ModelGatewayError(
      "模型没有返回内容，请重试。",
      "invalid_model_response",
    );
  }
  return validate(task, schema, extractJson(content));
}
