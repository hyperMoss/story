# 岔路

一个面向故事作者的动态剧情推演产品：导入短篇、章节或完整长篇，确认故事世界，从关键分歧点接管原作主角，在 4～12 次选择中持续发展并随时带走阶段回顾。

## 当前状态

这是可运行的 MVP，而不是线上交付完成状态。

| 能力 | 当前状态 |
| --- | --- |
| 粘贴故事、短文件导入、原创悬疑示例 | 已实现并通过浏览器测试 |
| UTF-8/GB18030 长篇导入、章节导航与有界上下文包 | 已实现并通过合成长篇浏览器测试 |
| 分歧点之前的有界原文证据 | 已实现代码路径；真实模型质量尚未验证 |
| 可编辑故事世界卡与三个分歧候选 | 已实现并通过浏览器测试 |
| 三个建议行动与自定义行动 | 已实现并通过浏览器测试 |
| 推演草案、状态变化、修正重做与接受边界 | 已实现并通过浏览器测试 |
| 4～12 回合持续推演、选择轨迹、按选择续写的路线结局、阶段回顾后继续、Markdown 复制与本地恢复 | 已实现并通过浏览器测试 |
| 演示访问码与服务端模型密钥 | 已实现并通过浏览器测试 |
| OpenAI-compatible 真实模型调用 | 已完成 DeepSeek 合成文本烟测；生产使用前需轮换本地密钥并复测 |
| 公开线上链接 | 尚未部署 |

`.env.example` 与自动化测试默认使用确定性假模型；实际本地运行模式由 `.env.local` 决定。顶栏会明确显示“本地假模型”或“真实模型”。假模型只用于开发和自动化测试，不应作为真实 AI 能力提交。

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
STORY_MODEL_TIMEOUT_MS=90000
```

模型服务需要返回 `choices[0].message.content`。内容必须是符合各任务领域结构的 JSON；服务端会先按契约裁剪模型多给的候选、规则、事件或依据，再使用 Zod 严格校验。缺字段、错误类型或候选不足时仍会拒绝写入剧情状态并提示重试。

部署前必须用真实模型完成一次“导入 → 世界卡 → 分歧点 → 至少四回合 → 阶段回顾与路线结局 → 继续推演”的人工验证。不要因为本地假模型测试通过就宣称真实模型已经可用。

## Cloudflare 部署

Worker 名为 `story`，构建产物由 [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare/get-started) 生成，配置见 `wrangler.jsonc` 与 `open-next.config.ts`。

```bash
pnpm run deploy
pnpm run preview   # 本地以 workerd 预览部署产物
```

首次部署前先在 Cloudflare 侧写入运行时密钥，不要把它们提交进仓库：

```bash
pnpm exec wrangler secret put STORY_MODEL_API_KEY
```

Cloudflare Builds 的构建命令填 `pnpm run deploy`，部署命令留空。`package.json` 的 `name` 必须与 `wrangler.jsonc` 的 `name` 一致（都是 `story`），否则 OpenNext 的 `WORKER_SELF_REFERENCE` 自引用绑定会指向一个不存在的 Worker，部署会以错误码 `10143` 失败。

## 验证

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Playwright 会用访问码 `story-test` 和确定性假模型启动隔离服务，验证：

- 四回合后阶段回顾并继续到第五回合的主路径；
- 作者修改世界卡；
- 建议行动与自定义行动；
- 带修正意见重新推演；
- 选择轨迹、逐项兑现选择的路线结局、阶段回顾与刷新恢复；
- 输入错误、模型失败与安全重试；
- GB18030 长篇导入、焦点章节选择、前后各最多两个相邻片段，以及不超过 12,000 字的上下文包。

## 架构

- `app/`：Next.js 页面与服务端 API 路由。
- `components/`：四阶段作者体验与客户端会话状态机。
- `lib/domain.ts`：所有模型输入、输出和剧情状态的运行时契约。
- `lib/story-service.ts`：分析、开始、回合推演与回顾四个用例。
- `lib/model-gateway.ts`：真实/假模型共同的结构化输出边界。
- `lib/long-source.ts`：长篇解码、章节/片段导航、上下文包和前序证据。
- `lib/fake-model.ts`：确定性测试实现。
- `tests/e2e/`：最高层浏览器测试缝隙。

关键原则是：推演草案与已接受剧情状态严格分离。只有作者点击接受后，场景与状态变化才会成为下一轮输入。详见 [ADR-0001](docs/adr/0001-use-explicit-structured-story-state.md)。

## 隐私与边界

- 短篇原文或长篇模式中可见的上下文包会发送到配置的模型服务。
- 长篇支持 UTF-8/GB18030 `.txt/.md`，文件上限 20 MiB。整本原文只在当前页面内存中存在，不整体上传，也不进入 `localStorage`。
- 长篇模式会把所选章节作为故事锚点，并在 12,000 字预算内自动带入前后各最多两个相邻阅读片段；这仍不代表模型已经理解整本书。刷新页面后如需继续引用原文，需要重新导入。
- 应用服务端不持久化原文或生成内容。
- 当前会话保存在作者浏览器的 `localStorage`，可通过“重新开始”清除。
- 模型密钥只读取服务端环境变量，不进入客户端包。
- 每次分析仍只发送约 400～12,000 字；长篇会先在浏览器中生成这个有界上下文包。

明确不支持全书自动语义理解/摘要、无限轮次、场景图片、账号与云端项目、公开分享、完整分支树、PDF/Word/EPUB 或文风模仿承诺。

完整产品范围、验收标准和五分钟录屏结构见 [产品定义](docs/product-definition.md)。基础流程见 [MVP 规格](docs/specs/dynamic-story-mvp.md)，长篇边界见 [长篇蓝本规格](docs/specs/long-form-story-blueprint.md) 与 [研究记录](docs/research/long-form-story-ingestion.md)。
