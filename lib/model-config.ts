import { z } from "zod";

/**
 * 自定义模型接入契约。
 *
 * 浏览器只负责收集配置并随请求带上，真正的模型调用仍发生在服务端。
 * 传输使用 base64(JSON)，避免中文模型名或带查询串的地址破坏 HTTP 头。
 */
export const MODEL_CONFIG_HEADER = "x-story-model-config";

export const DEFAULT_MODEL_TIMEOUT_MS = 90_000;
export const MIN_MODEL_TIMEOUT_MS = 5_000;
export const MAX_MODEL_TIMEOUT_MS = 300_000;

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export const CustomModelConfigSchema = z.object({
  baseUrl: z
    .string()
    .trim()
    .min(1, "请填写接口地址。")
    .max(500, "接口地址过长。")
    .refine(isHttpUrl, "接口地址必须是 http 或 https 开头的完整链接。"),
  apiKey: z
    .string()
    .trim()
    .min(1, "请填写 API 密钥。")
    .max(500, "API 密钥过长。")
    .refine((value) => !/\s/.test(value), "API 密钥不能包含空格。"),
  model: z
    .string()
    .trim()
    .min(1, "请填写模型名称。")
    .max(120, "模型名称过长。")
    .refine((value) => !/\s/.test(value), "模型名称不能包含空格。"),
  timeoutMs: z
    .number()
    .int()
    .min(MIN_MODEL_TIMEOUT_MS, "超时不能低于 5 秒。")
    .max(MAX_MODEL_TIMEOUT_MS, "超时不能高于 300 秒。")
    .optional(),
});

export type CustomModelConfig = z.infer<typeof CustomModelConfigSchema>;

export const ModelProbeRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("test"),
    config: CustomModelConfigSchema,
  }),
  z.object({
    action: z.literal("list"),
    config: CustomModelConfigSchema,
  }),
]);

export type ModelProbeRequest = z.infer<typeof ModelProbeRequestSchema>;

/** 服务端探测结果：只回传可展示信息，绝不回传密钥。 */
export type ModelProbeResult = {
  ok: boolean;
  message: string;
  latencyMs?: number;
  models?: string[];
};

export type ModelProviderPreset = {
  id: string;
  label: string;
  baseUrl: string;
  model: string;
  hint: string;
};

export const MODEL_PROVIDER_PRESETS: ModelProviderPreset[] = [
  {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    hint: "国内直连，OpenAI 兼容。",
  },
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    hint: "需要可访问 api.openai.com 的网络。",
  },
  {
    id: "moonshot",
    label: "Moonshot",
    baseUrl: "https://api.moonshot.cn/v1",
    model: "moonshot-v1-32k",
    hint: "长上下文，适合长篇蓝本。",
  },
  {
    id: "dashscope",
    label: "通义千问",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    hint: "阿里云百炼兼容模式。",
  },
  {
    id: "zhipu",
    label: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4-flash",
    hint: "智谱开放平台兼容模式。",
  },
  {
    id: "ollama",
    label: "Ollama 本地",
    baseUrl: "http://127.0.0.1:11434/v1",
    model: "qwen2.5:14b",
    hint: "本机自托管，需要服务端能访问该地址。",
  },
  {
    id: "custom",
    label: "自定义 / 其他兼容服务",
    baseUrl: "",
    model: "",
    hint: "任何 OpenAI 兼容的 /chat/completions 服务。",
  },
];

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function encodeModelConfig(config: CustomModelConfig) {
  return bytesToBase64(new TextEncoder().encode(JSON.stringify(config)));
}

export function decodeModelConfig(header: string | null | undefined) {
  if (!header) return undefined;
  try {
    const binary = atob(header.trim());
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed = CustomModelConfigSchema.safeParse(
      JSON.parse(new TextDecoder().decode(bytes)),
    );
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export function chatCompletionsUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.endsWith("/chat/completions")
    ? trimmed
    : `${trimmed}/chat/completions`;
}

export function modelsUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/chat\/completions$/, "").replace(/\/+$/, "");
  return `${trimmed}/models`;
}
