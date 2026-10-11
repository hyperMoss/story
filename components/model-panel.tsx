"use client";

import { FormEvent, useState } from "react";
import { ErrorNotice, LoadingButton } from "@/components/stage-shell";
import {
  MAX_MODEL_TIMEOUT_MS,
  MIN_MODEL_TIMEOUT_MS,
  MODEL_PROVIDER_PRESETS,
  type ModelProbeResult,
} from "@/lib/model-config";
import type { StoredModelConfig } from "@/components/model-config-store";

type Draft = {
  presetId: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutSeconds: string;
  remembered: boolean;
};

function draftFrom(config?: StoredModelConfig): Draft {
  if (!config) {
    const preset = MODEL_PROVIDER_PRESETS[0];
    return {
      presetId: preset.id,
      baseUrl: "",
      apiKey: "",
      model: "",
      timeoutSeconds: "90",
      remembered: false,
    };
  }
  const matched = MODEL_PROVIDER_PRESETS.find(
    (preset) => preset.baseUrl === config.baseUrl && preset.model === config.model,
  );
  return {
    presetId: matched?.id ?? "custom",
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    timeoutSeconds: String(Math.round((config.timeoutMs ?? 90_000) / 1000)),
    remembered: config.remembered,
  };
}

function secondsToTimeout(value: string) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  return Math.round(
    Math.min(Math.max(seconds * 1000, MIN_MODEL_TIMEOUT_MS), MAX_MODEL_TIMEOUT_MS),
  );
}

export function ModelPanel({
  config,
  customModelAllowed,
  serverMode,
  onSave,
  onClear,
  onClose,
  id,
}: {
  config?: StoredModelConfig;
  customModelAllowed: boolean;
  serverMode: "fake" | "live";
  onSave: (config: StoredModelConfig) => void;
  onClear: () => void;
  onClose: () => void;
  id?: string;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(config));
  const [busy, setBusy] = useState<"test" | "list">();
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<ModelProbeResult>();
  const [modelOptions, setModelOptions] = useState<string[]>();

  const preset = MODEL_PROVIDER_PRESETS.find((item) => item.id === draft.presetId);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setResult(undefined);
  }

  function choosePreset(presetId: string) {
    const next = MODEL_PROVIDER_PRESETS.find((item) => item.id === presetId);
    setDraft((current) => ({
      ...current,
      presetId,
      baseUrl: next && next.id !== "custom" ? next.baseUrl : current.baseUrl,
      model: next && next.id !== "custom" ? next.model : current.model,
    }));
    setModelOptions(undefined);
    setResult(undefined);
    setError(undefined);
  }

  function currentPayload() {
    return {
      baseUrl: draft.baseUrl.trim(),
      apiKey: draft.apiKey.trim(),
      model: draft.model.trim(),
      timeoutMs: secondsToTimeout(draft.timeoutSeconds),
    };
  }

  function missingField(): string | undefined {
    if (!draft.baseUrl.trim()) return "请填写接口地址。";
    if (!draft.apiKey.trim()) return "请填写 API 密钥。";
    if (!draft.model.trim()) return "请填写模型名称。";
    const seconds = Number(draft.timeoutSeconds);
    if (!Number.isFinite(seconds) || seconds * 1000 < MIN_MODEL_TIMEOUT_MS) {
      return "超时不能低于 5 秒。";
    }
    return undefined;
  }

  async function callProbe(action: "test" | "list") {
    const missing = missingField();
    if (missing) {
      setError(missing);
      return;
    }
    setBusy(action);
    setError(undefined);
    setResult(undefined);
    try {
      const response = await fetch("/api/model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, config: currentPayload() }),
      });
      const body = (await response.json().catch(() => ({}))) as ModelProbeResult & {
        error?: { message?: string };
      };
      if (!response.ok || body.ok === false) {
        const message = body.error?.message || body.message || "连接失败，请检查配置。";
        setError(message);
        return;
      }
      if (action === "list" && body.models) {
        setModelOptions(body.models);
        if (!body.models.length) setError("该服务没有返回任何模型，请手动填写模型名称。");
      } else {
        setResult(body);
      }
    } catch {
      setError("无法连接本应用的模型探测接口，请稍后重试。");
    } finally {
      setBusy(undefined);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const missing = missingField();
    if (missing) {
      setError(missing);
      return;
    }
    setError(undefined);
    onSave({
      ...currentPayload(),
      remembered: draft.remembered,
    });
    onClose();
  }

  return (
    <section className="model-panel" id={id} aria-label="模型接入">
      <div className="panel-heading">
        <div>
          <span className="panel-index">MODEL ACCESS</span>
          <h2>自定义模型接入</h2>
        </div>
        <button className="text-button" type="button" onClick={onClose}>
          收起
        </button>
      </div>

      {!customModelAllowed ? (
        <div className="error-notice" role="alert">
          <span aria-hidden="true">!</span>
          <p>当前部署已关闭自定义模型接入，只能使用服务端配置的模型。</p>
        </div>
      ) : null}

      <p className="model-panel-note">
        {config
          ? "已启用你自己的模型。密钥只保存在这台设备的浏览器里，随请求发送给本应用服务端，不会写入服务端存储。"
          : serverMode === "live"
            ? "当前使用服务端配置的模型。填入自己的配置后，本次会话将改用你的模型。"
            : "当前是本地假模型。填入自己的配置后即可用真实模型推演。"}
      </p>

      <form onSubmit={submit}>
        <label className="field-label">
          服务商预设
          <select
            value={draft.presetId}
            disabled={Boolean(busy) || !customModelAllowed}
            onChange={(event) => choosePreset(event.target.value)}
          >
            {MODEL_PROVIDER_PRESETS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {preset?.hint ? <p className="model-panel-hint">{preset.hint}</p> : null}

        <label className="field-label">
          接口地址
          <input
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://api.deepseek.com/v1"
            value={draft.baseUrl}
            disabled={Boolean(busy) || !customModelAllowed}
            onChange={(event) => update("baseUrl", event.target.value)}
          />
        </label>

        <label className="field-label">
          API 密钥
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-..."
            value={draft.apiKey}
            disabled={Boolean(busy) || !customModelAllowed}
            onChange={(event) => update("apiKey", event.target.value)}
          />
        </label>

        <label className="field-label">
          模型名称
          {modelOptions?.length ? (
            <select
              value={draft.model}
              disabled={Boolean(busy) || !customModelAllowed}
              onChange={(event) => update("model", event.target.value)}
            >
              <option value="">选择模型</option>
              {modelOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="deepseek-chat"
              value={draft.model}
              disabled={Boolean(busy) || !customModelAllowed}
              onChange={(event) => update("model", event.target.value)}
            />
          )}
        </label>

        <label className="field-label">
          超时（秒）
          <input
            type="number"
            min={MIN_MODEL_TIMEOUT_MS / 1000}
            max={MAX_MODEL_TIMEOUT_MS / 1000}
            step={5}
            value={draft.timeoutSeconds}
            disabled={Boolean(busy) || !customModelAllowed}
            onChange={(event) => update("timeoutSeconds", event.target.value)}
          />
        </label>

        <div className="model-panel-actions">
          <button
            className="secondary-button"
            type="button"
            disabled={Boolean(busy) || !customModelAllowed}
            onClick={() => void callProbe("test")}
          >
            {busy === "test" ? "正在测试…" : "测试连接"}
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={Boolean(busy) || !customModelAllowed}
            onClick={() => void callProbe("list")}
          >
            {busy === "list" ? "正在读取…" : "读取模型列表"}
          </button>
        </div>

        <label className="model-remember">
          <input
            type="checkbox"
            checked={draft.remembered}
            disabled={Boolean(busy)}
            onChange={(event) => update("remembered", event.target.checked)}
          />
          <span>
            记住此配置
            <small>
              不勾选时配置只存在于当前标签页，关闭页面即失效；勾选后会写入本机 localStorage。
            </small>
          </span>
        </label>

        {result?.ok ? (
          <div className="model-probe-ok" role="status">
            <span aria-hidden="true">✓</span>
            <p>{result.message}</p>
          </div>
        ) : null}

        <ErrorNotice message={error} />

        <div className="model-panel-footer">
          {config ? (
            <button
              className="text-button"
              type="button"
              disabled={Boolean(busy)}
              onClick={() => {
                onClear();
                setDraft(draftFrom(undefined));
                setResult(undefined);
                setError(undefined);
                setModelOptions(undefined);
              }}
            >
              清除并改回服务端模型
            </button>
          ) : (
            <span />
          )}
          <LoadingButton
            className="primary-button"
            type="submit"
            disabled={!customModelAllowed}
          >
            {config ? "更新接入" : "启用自定义模型"}
          </LoadingButton>
        </div>
      </form>
    </section>
  );
}
