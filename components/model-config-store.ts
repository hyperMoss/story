"use client";

import { useCallback, useState } from "react";
import {
  CustomModelConfigSchema,
  type CustomModelConfig,
} from "@/lib/model-config";

const PERSIST_KEY = "crossroads-custom-model-v1";
const SESSION_KEY = "crossroads-custom-model-session-v1";

export type StoredModelConfig = CustomModelConfig & {
  /** 是否选择"记住此配置"。未记住时刷新页面即失效。 */
  remembered: boolean;
};

function parse(value: string | null, remembered: boolean): StoredModelConfig | undefined {
  if (!value) return undefined;
  try {
    const parsed = CustomModelConfigSchema.safeParse(JSON.parse(value));
    return parsed.success ? { ...parsed.data, remembered } : undefined;
  } catch {
    return undefined;
  }
}

function readStored(): StoredModelConfig | undefined {
  if (typeof window === "undefined") return undefined;
  return (
    parse(window.sessionStorage.getItem(SESSION_KEY), false) ??
    parse(window.localStorage.getItem(PERSIST_KEY), true)
  );
}

function writeStored(config: StoredModelConfig | undefined) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(PERSIST_KEY);
  if (!config) return;
  const { remembered, ...payload } = config;
  const serialized = JSON.stringify(payload);
  if (remembered) window.localStorage.setItem(PERSIST_KEY, serialized);
  else window.sessionStorage.setItem(SESSION_KEY, serialized);
}

export function useModelConfig() {
  // 首屏渲染的是加载态，读存储不会造成 hydration 不一致；这里沿用 session.ts 的惰性初始化模式。
  const [config, setConfig] = useState<StoredModelConfig | undefined>(readStored);

  const save = useCallback((next: StoredModelConfig) => {
    writeStored(next);
    setConfig(next);
  }, []);

  const clear = useCallback(() => {
    writeStored(undefined);
    setConfig(undefined);
  }, []);

  return { config, save, clear };
}
