import type { ZodType } from "zod";
import { fakeModelResponse, type ModelTask } from "@/lib/fake-model";
import { MAX_STORY_ROUNDS } from "@/lib/domain";
import {
  chatCompletionsUrl,
  DEFAULT_MODEL_TIMEOUT_MS,
  modelsUrl,
  type CustomModelConfig,
} from "@/lib/model-config";

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

type StructuredRequest<T> = {
  task: ModelTask;
  instruction: string;
  payload: unknown;
  schema: ZodType<T>;
  /** 浏览器侧配置的自定义模型；存在时优先于服务端环境变量。 */
  customConfig?: CustomModelConfig;
};

type ModelConnection = {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
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

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function capArray(value: unknown, maximum: number) {
  return Array.isArray(value) ? value.slice(0, maximum) : value;
}

function normalizeWorldCard(value: unknown) {
  const card = asRecord(value);
  if (!card) return value;
  const characters = Array.isArray(card.characters)
    ? card.characters.slice(0, 8).map((character) => {
        const item = asRecord(character);
        return item ? { ...item, relationships: capArray(item.relationships, 8) } : character;
      })
    : card.characters;
  return {
    ...card,
    characters,
    rules: capArray(card.rules, 12),
    originalPlot: capArray(card.originalPlot, 12),
  };
}

function normalizeStoryState(value: unknown) {
  const state = asRecord(value);
  if (!state) return value;
  const acceptedRounds = Array.isArray(state.acceptedRounds)
    ? state.acceptedRounds.slice(0, MAX_STORY_ROUNDS).map((round) => {
        const item = asRecord(round);
        return item ? { ...item, stateChanges: capArray(item.stateChanges, 8) } : round;
      })
    : state.acceptedRounds;
  return {
    ...state,
    characterStates: capArray(state.characterStates, 8),
    relationships: capArray(state.relationships, 12),
    risks: capArray(state.risks, 12),
    unresolvedConflicts: capArray(state.unresolvedConflicts, 12),
    acceptedRounds,
  };
}

function normalizeStructuredResponse(task: ModelTask, value: unknown) {
  const response = asRecord(value);
  if (!response) return value;

  if (task === "analyze") {
    return {
      ...response,
      worldCard: normalizeWorldCard(response.worldCard),
      divergenceCandidates: capArray(response.divergenceCandidates, 3),
    };
  }

  if (task === "start") {
    const frame = asRecord(response.frame);
    return {
      ...response,
      frame: frame
        ? { ...frame, suggestedActions: capArray(frame.suggestedActions, 3) }
        : response.frame,
      storyState: normalizeStoryState(response.storyState),
    };
  }

  if (task === "turn") {
    return {
      ...response,
      nextActions: capArray(response.nextActions, 3),
      stateChanges: capArray(response.stateChanges, 8),
      rationale: capArray(response.rationale, 4),
      nextState: normalizeStoryState(response.nextState),
    };
  }

  const ending = asRecord(response.ending);
  return {
    ...response,
    choices: capArray(response.choices, MAX_STORY_ROUNDS),
    differences: capArray(response.differences, 8),
    characterChanges: capArray(response.characterChanges, 8),
    unresolvedConflicts: capArray(response.unresolvedConflicts, 8),
    preservedFacts: capArray(response.preservedFacts, 8),
    ending: ending
      ? {
          ...ending,
          choicePayoffs: capArray(ending.choicePayoffs, MAX_STORY_ROUNDS),
        }
      : response.ending,
  };
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

function resolveTimeout(value: string | number | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MODEL_TIMEOUT_MS;
}

/**
 * 是否允许浏览器提交自定义模型配置。
 * 部署方可用 STORY_ALLOW_CUSTOM_MODEL=false 关闭，把接入方式锁回服务端环境变量。
 */
export function customModelAllowed() {
  return process.env.STORY_ALLOW_CUSTOM_MODEL?.trim() !== "false";
}

function connectionFromCustom(config: CustomModelConfig): ModelConnection {
  return {
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    timeoutMs: resolveTimeout(config.timeoutMs),
  };
}

function connectionFromEnv(): ModelConnection | undefined {
  const baseUrl = process.env.STORY_MODEL_BASE_URL?.replace(/\/$/, "");
  const apiKey = process.env.STORY_MODEL_API_KEY;
  const model = process.env.STORY_MODEL_NAME;
  if (!baseUrl || !apiKey || !model) return undefined;
  return {
    baseUrl,
    apiKey,
    model,
    timeoutMs: resolveTimeout(process.env.STORY_MODEL_TIMEOUT_MS),
  };
}

function connectionFor(customConfig?: CustomModelConfig) {
  if (customConfig) {
    if (!customModelAllowed()) {
      throw new ModelGatewayError(
        "当前部署未开放自定义模型接入，请联系部署方。",
        "model_not_configured",
        403,
      );
    }
    return connectionFromCustom(customConfig);
  }

  const mode = process.env.STORY_MODEL_MODE?.trim() || "fake";
  if (mode === "fake") return undefined;
  if (mode !== "live") {
    throw new ModelGatewayError(
      "STORY_MODEL_MODE 只能是 fake 或 live。",
      "model_not_configured",
      500,
    );
  }
  const connection = connectionFromEnv();
  if (!connection) {
    throw new ModelGatewayError("真实模型尚未配置完整。", "model_not_configured", 500);
  }
  return connection;
}

const SYSTEM_PROMPT =
  "你是互动叙事编辑。只返回一个合法 JSON 对象，不要使用 Markdown，不要展示思维链。推演依据只写可公开核验的简短因果说明。";

async function complete(
  connection: ModelConnection,
  task: ModelTask,
  instruction: string,
  payload: unknown,
) {
  let response: Response;
  try {
    response = await fetch(chatCompletionsUrl(connection.baseUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: connection.model,
        temperature: task === "analyze" ? 0.3 : 0.75,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `${instruction}\n\n输入数据：\n${JSON.stringify(payload)}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(connection.timeoutMs),
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
    throw new ModelGatewayError("模型没有返回内容，请重试。", "invalid_model_response");
  }
  return content;
}

export async function requestStructured<T>({
  task,
  instruction,
  payload,
  schema,
  customConfig,
}: StructuredRequest<T>) {
  const connection = connectionFor(customConfig);

  if (!connection) {
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

  return validate(task, schema, extractJson(await complete(connection, task, instruction, payload)));
}

/** 探测自定义模型是否真的可用：发一次极短的对话请求，不消耗结构化校验路径。 */
export async function probeCustomModel(config: CustomModelConfig) {
  const startedAt = Date.now();
  const connection = connectionFromCustom(config);
  const content = await complete(
    { ...connection, timeoutMs: Math.min(connection.timeoutMs, 30_000) },
    "analyze",
    "只回复一个合法 JSON 对象：{\"ok\":true}。不要输出其他内容。",
    { probe: true },
  );
  return { latencyMs: Date.now() - startedAt, content: content.trim().slice(0, 120) };
}

/** 读取服务端的模型清单，供接入面板下拉选择。部分兼容服务不支持该端点。 */
export async function listCustomModels(config: CustomModelConfig) {
  const connection = connectionFromCustom(config);
  let response: Response;
  try {
    response = await fetch(modelsUrl(connection.baseUrl), {
      method: "GET",
      headers: { Authorization: `Bearer ${connection.apiKey}` },
      signal: AbortSignal.timeout(Math.min(connection.timeoutMs, 20_000)),
      cache: "no-store",
    });
  } catch {
    throw new ModelGatewayError("无法连接模型服务，请检查接口地址。", "provider_error");
  }

  if (!response.ok) {
    throw new ModelGatewayError(
      "该服务未提供模型清单接口，请手动填写模型名称。",
      "provider_error",
    );
  }

  const body = (await response.json().catch(() => ({}))) as {
    data?: Array<{ id?: unknown }>;
  };
  const ids = Array.isArray(body.data)
    ? body.data
        .map((item) => (typeof item.id === "string" ? item.id.trim() : ""))
        .filter(Boolean)
    : [];
  return ids.slice(0, 200);
}
