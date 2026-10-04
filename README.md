# 岔路

一个面向故事作者的动态剧情推演产品：导入短篇或章节，确认故事世界，从关键分歧点接管原作主角，经过四次选择得到一条可继续创作的新剧情线。

## 当前状态

这是可运行的 MVP，而不是线上交付完成状态。

| 能力 | 当前状态 |
| --- | --- |
| 粘贴故事、导入 `.txt/.md`、原创悬疑示例 | 已实现并通过浏览器测试 |
| 可编辑故事世界卡与三个分歧候选 | 已实现并通过浏览器测试 |
| 三个建议行动与自定义行动 | 已实现并通过浏览器测试 |
| 推演草案、状态变化、修正重做与接受边界 | 已实现并通过浏览器测试 |
| 四回合回顾、Markdown 复制与本地恢复 | 已实现并通过浏览器测试 |
| 演示访问码与服务端模型密钥 | 已实现并通过浏览器测试 |
| OpenAI-compatible 真实模型调用 | 已实现代码路径；当前环境没有凭据，尚未完成真实供应商验证 |
| 公开线上链接 | 尚未部署 |

本地默认使用确定性假模型，并在页面顶栏显示“本地假模型”。假模型只用于开发和自动化测试，不应作为真实 AI 能力提交。

## 本地启动

要求 Node.js 20+ 与 pnpm。

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

打开 `http://localhost:3000`。

`.env.example` 默认配置为：

```env
STORY_MODEL_MODE=fake
```

如未设置 `DEMO_ACCESS_CODE`，本地开发会跳过访问码页面。

## 接入真实模型

服务端使用 OpenAI-compatible `POST /chat/completions` 接口。将以下变量写入 `.env.local`：

```env
DEMO_ACCESS_CODE=交给评审的访问码
STORY_MODEL_MODE=live
STORY_MODEL_BASE_URL=https://你的模型服务/v1
STORY_MODEL_API_KEY=服务端密钥
STORY_MODEL_NAME=模型名称
STORY_MODEL_TIMEOUT_MS=45000
```

模型服务需要返回 `choices[0].message.content`。内容必须是符合各任务领域结构的 JSON；服务端会使用 Zod 校验，格式不完整时拒绝写入剧情状态并提示重试。

部署前必须用真实模型完成一次“导入 → 世界卡 → 分歧点 → 四回合 → 回顾”的人工验证。不要因为本地假模型测试通过就宣称真实模型已经可用。

## 验证

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Playwright 会用访问码 `story-test` 和确定性假模型启动隔离服务，验证：

- 完整四回合主路径；
- 作者修改世界卡；
- 建议行动与自定义行动；
- 带修正意见重新推演；
- 最终回顾与刷新恢复；
- 输入错误、模型失败与安全重试。

## 架构

- `app/`：Next.js 页面与服务端 API 路由。
- `components/`：四阶段作者体验与客户端会话状态机。
- `lib/domain.ts`：所有模型输入、输出和剧情状态的运行时契约。
- `lib/story-service.ts`：分析、开始、回合推演与回顾四个用例。
- `lib/model-gateway.ts`：真实/假模型共同的结构化输出边界。
- `lib/fake-model.ts`：确定性测试实现。
- `tests/e2e/`：最高层浏览器测试缝隙。

关键原则是：推演草案与已接受剧情状态严格分离。只有作者点击接受后，场景与状态变化才会成为下一轮输入。详见 [ADR-0001](docs/adr/0001-use-explicit-structured-story-state.md)。

## 隐私与边界

- 原始故事会发送到配置的模型服务。
- 应用服务端不持久化原文或生成内容。
- 当前会话保存在作者浏览器的 `localStorage`，可通过“重新开始”清除。
- 模型密钥只读取服务端环境变量，不进入客户端包。
- 首版只支持约 400～12,000 字的章节级输入；推荐 3,000～8,000 字。

明确不支持整本长篇、无限轮次、场景图片、账号与云端项目、公开分享、完整分支树、PDF/Word/EPUB 或文风模仿承诺。

完整产品范围、验收标准和五分钟录屏结构见 [产品定义](docs/product-definition.md)，实现规格见 [MVP 规格](docs/specs/dynamic-story-mvp.md)。
