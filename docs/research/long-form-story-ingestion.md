# 长篇小说接入研究：从“单段分析”升级为“可追溯的小说工程”

更新日期：2026-10-04

## 结论

可以用这部长篇小说作为故事蓝本，但不能把“兼容长文章”理解成把整本书一次性塞给模型。研究支持当前 [长篇蓝本规格](../specs/long-form-story-blueprint.md) 和 [ADR-0002](../adr/0002-use-local-long-form-navigation.md) 选择的最小切片：先在浏览器内正确解码并建立临时章节目录，由用户选择分歧位置，只向现有模型流程发送不超过 12,000 字的可编辑上下文包；推演时最多附带 3 段、每段不超过 1,800 字、且全部来自焦点之前的透明词法证据。

这一步解决的是“15 MB 长篇能真实导入、导航和选点”，不是“模型已经理解整本书”。完整的章节/篇章/全书层级摘要、带时间范围和证据引用的故事圣经、持久化任务恢复以及 embeddings/RAG 都是下一阶段的质量架构，不是本轮上线的阻断项。

长期来看，长篇兼容仍需要以下能力：

1. 正确解码和按章节切分；
2. 章节、篇章、全书三级摘要；
3. 带来源和生效时间的结构化事实；
4. 先按分歧点和角色知识过滤，再做检索；
5. 可中断、可恢复、不会重复付费的处理任务。

## 样本事实与当前缺口

本次只读取了文件元数据并做了解码/标题计数，没有复制小说正文。样本大小为 `15,079,878` bytes，UTF-8 严格解码失败，GB18030 严格解码成功；解码后约 761 万个 JavaScript UTF-16 code units、144,887 行，识别出 2,463 个章节标题候选。因此，现有“UTF-8 文件 + 单次分析”的路径不适用于该文件。

当前实现的主要限制来自 [领域模型](../../lib/domain.ts)、[导入界面](../../components/import-stage.tsx)、[故事应用](../../components/story-app.tsx) 和 [模型网关](../../lib/model-gateway.ts)：

| 当前行为 | 长篇小说上的问题 | 需要的变化 |
| --- | --- | --- |
| `AnalyzeRequest` 仅允许 400–12,000 字 | 不是截断就会拒绝，截断又会丢失绝大多数设定 | 导入与分析拆成两个阶段，整本只建立索引，模型按小任务处理 |
| 文件读取上限约 100 KB | 15 MB 样本无法进入 | 提升本地文件上限，并避免把整本放进单个 API 请求 |
| 只接受 UTF-8 | 样本实际是 GB18030 | 严格探测 UTF-8，失败后尝试 GB18030，并允许用户手动纠正 |
| 世界卡最多 8 人、12 条规则、12 个事件 | 会把跨越上千章的人物和状态压平 | 世界卡变成当前时间点的投影，完整事实存于故事圣经 |
| `sourceText` 整体写入 `localStorage` | 大文本会让会话快照臃肿，并把原文和游戏状态绑死 | 本轮原文与索引只驻留页面内存、刷新后重导；会话仅持久化已确认世界卡和分支状态 |
| 每轮只带扁平 `worldCard` | 无来源、无时间范围，容易发生角色穿越、物品归属错误和后期知识泄露 | 本轮增加受 schema 限制的前序证据；下一阶段再把事实升级为时间化故事圣经 |

如果部署到 Vercel，15 MB 也不可能作为一次 Route Handler 请求上传：Vercel Functions 的请求或响应体上限是 4.5 MB，官方建议大文件使用客户端直传或拆分请求。[Vercel Functions Limits](https://vercel.com/docs/functions/limitations) 因而，第一版应在浏览器读取原始文件，只把受控的小块发送给现有服务端模型路由；未来云端保存再改用对象存储直传。

## 下一阶段：为什么需要“时间切片的故事圣经”

这种超长成长型叙事不是一个静态世界卡。人物境界、所处地点、阵营关系、掌握的信息、持有物品和未解决冲突都会随章节变化。把全书事实合并成一张无时间字段的卡片，会产生两类严重错误：

- **时间穿越**：把后期能力、关系或物品放进早期分歧点；
- **知识泄漏**：某件事在世界中已经发生，但分歧点时主角还不知道。

这不是本轮临时章节导航的前置条件；它是未来声称“跨卷理解”之前必须补上的能力。届时故事圣经中的事实至少需要：

```ts
type ChapterRef = {
  chapterId: string;
  chapterOrdinal: number;
  startOffset: number;
  endOffset: number;
};

type TemporalScope = {
  introducedAt: number;
  validFrom: number;
  validTo: number | null;
  revealedToProtagonistAt: number | null;
};

type StoryFact = {
  id: string;
  kind: "character" | "relationship" | "rule" | "place" | "item" | "event" | "open-thread";
  subjectId: string;
  predicate: string;
  object: string;
  aliases: string[];
  temporal: TemporalScope;
  evidenceRefs: ChapterRef[];
  confidence: "explicit" | "inferred" | "author-confirmed";
  timeline: "source-canon" | "branch-canon";
};
```

`evidenceRefs` 是防止摘要逐层失真的底座：世界卡显示的是选定分歧点的事实投影，用户仍能定位到章节和字符范围复核。`revealedToProtagonistAt` 与事实的发生时间分开，解决“世界已发生、主角尚未知情”的问题。

下一阶段检索时必须先执行硬过滤：

```text
source-canon.validFrom <= divergenceChapter
AND (validTo IS NULL OR validTo >= divergenceChapter)
AND revealedToProtagonistAt <= divergenceChapter
```

分歧点之后的原作事件只能进入“原作对照”区，不能进入新分支的 canon。若分歧位于某一章内部，还要按 `startOffset/endOffset` 过滤，不能只按章号粗切。

## 两阶段处理流水线

当前切片实际落地到以下位置：

```text
原始 bytes
  → UTF-8/GB18030 严格解码
  → 页面内存中的章节/片段目录
  → 用户选择焦点
  → ≤12,000 字可编辑上下文包
  → 现有世界卡分析
  → 焦点及之前的透明词法证据（≤3 × 1,800 字）
  → 四回合推演
```

不做模型全书预处理，因此导入后立即可导航；刷新后要求重导原文件。下面是下一阶段的完整质量流水线，不阻塞当前切片：

```text
原始 bytes
  → 编码探测与严格解码
  → 章节目录（全书立即可浏览）
  → 段落/句子/令牌预算切片
  → 章节摘要 + 结构化事实
  → 篇章摘要
  → 全书故事圣经
  → 时间过滤 + 关键词检索（后续可叠加向量检索）
  → 本轮上下文包
  → 场景推演
```

### 1. 解码和稳定标识

浏览器的 File API 支持按字节范围切取 `Blob`，适合读取大文件而不先经过服务端；这是标准定义的能力。[W3C File API](https://www.w3.org/TR/FileAPI/) WHATWG Encoding Standard 定义了 JavaScript 解码 API，并明确包含 GB18030/GBK 解码器。[WHATWG Encoding Standard](https://encoding.spec.whatwg.org/)

建议顺序：

1. 检查 BOM；
2. 用 `TextDecoder("utf-8", { fatal: true })` 严格解码；
3. 失败后用 `TextDecoder("gb18030", { fatal: true })`；
4. 两者都失败时让用户选择编码，不要静默插入 `�`；
5. 统一换行符，但保留原始字节偏移映射；
6. 当前用文件元数据标识页面内会话；下一阶段对原始 bytes 计算 SHA-256，得到可恢复的 `sourceId`。

Web Crypto 标准提供异步 `digest`，并规范了 SHA-256，可用于下一阶段在浏览器侧生成稳定文件标识。[Web Cryptography Level 2](https://www.w3.org/TR/WebCryptoAPI/#SubtleCrypto-method-digest) 届时由 `sourceId + parserVersion` 决定章节索引是否可复用；每个 chunk 再计算自己的 hash，使提示词或模型版本未变化时无需重复处理。本轮不持久化全文或索引，所以无需先实现这套 hash 缓存。

### 2. 先识别章节，再在章节内切片

第一层边界采用短行章节标题，兼容中文数字、阿拉伯数字和“章/回/卷/节”；用户应能在目录中修正少量误判。第二层优先保留段落，过长段落再用 `Intl.Segmenter("zh-CN", { granularity: "sentence" })` 切句。ECMA-402 将 `Intl.Segmenter` 定义为按 locale 和句/词/字素粒度分段的标准 API。[ECMA-402 Segmenter](https://402.ecma-international.org/#sec-segmenter-objects)

切片不要以“汉字数等于 token 数”为假设。初始设计默认可设为约 900 tokens、约 120 tokens 重叠，但它只是待评测参数。OpenAI 的 File Search 同样允许按 token 设置 chunk 大小与重叠，当前自动策略使用 800/400，这只能作为“按 token 而不是按字符预算”的官方实例，不代表本项目的最优值。[OpenAI vector store file chunking](https://platform.openai.com/docs/api-reference/vector-stores-files/createFile)

本轮 reading unit 保存章节/片段 ID、顺序和字符范围，用于导航和证据标注。下一阶段的持久化 chunk 再增加文本 hash 和 token 数；任何摘要或事实都只能引用这些稳定 ID，不能只保存模型生成的一句话。

### 3. 下一阶段用确定性层级代替一次性“全书总结”

推荐四层：

| 层级 | 内容 | 用途 |
| --- | --- | --- |
| L0 | 原文章节与 chunk、精确范围 | 证据和局部细节 |
| L1 | 章节摘要、事件、人物状态变化、未解线索 | 当前章节附近推演 |
| L2 | 每个篇章/卷的摘要和状态快照 | 跨章节因果、长期目标 |
| L3 | 全书人物/规则/地点/物品索引和时间线 | 路由到相关篇章，不直接替代证据 |

RAPTOR 的一手论文采用自底向上的聚类和递归摘要树，并在检索时组合不同抽象层级，说明“长文档需要多层抽象而非只有平坦小块”的方向有研究依据。[ICLR 2024 RAPTOR](https://proceedings.iclr.cc/paper_files/paper/2024/hash/8a2acd174940dbca361a6398a4f9df91-Abstract-Conference.html) 但本项目第一版不必实现其向量聚类：小说已经天然提供章节/卷顺序，先做确定性的章节 → 篇章 → 全局层级，更便于调试和引用。

同时不要因为模型宣称支持长上下文就跳过检索。TACL 的原始研究发现，当相关信息位于长输入中间时，多种模型的表现会下降。[Lost in the Middle](https://direct.mit.edu/tacl/article/doi/10.1162/tacl_a_00638/119630/Lost-in-the-Middle-How-Language-Models-Use-Long) 这进一步支持“只装配相关事实和证据，而不是把所有摘要拼成超长 prompt”。

### 4. 检索先做硬约束，再做相关性排序

一次推演的检索查询由当前章节、地点、登场实体 ID、玩家行动、当前目标和未解冲突构成。顺序应是：

1. 按 `sourceId` 和分歧章节过滤；
2. 按主角可知时间过滤；
3. 命中实体别名和精确术语；
4. 对候选做相关性排序；
5. 补入命中 chunk 的相邻 chunk，防止边界断句；
6. 去重，并在 token 预算内打包。

当前切片采用浏览器内的透明字符/关键词评分，返回最多 3 段、每段最多 1,800 字的证据，无需新增模型端点。未来落地 SQLite 时，FTS5 的 trigram tokenizer 支持任意子串匹配，而官方也明确说明 Porter stemmer 是面向英文的，不应直接当中文方案。[SQLite FTS5](https://www.sqlite.org/fts5.html) 向量检索适合作为第二路召回：OpenAI 官方将 embeddings 的典型用途列为搜索、聚类和推荐，并以向量距离衡量文本相关性。[OpenAI embeddings guide](https://developers.openai.com/api/docs/guides/embeddings) 但当前网关只有 Chat Completions 配置，第一版引入 embeddings 会增加端点、模型、费用和降级路径，因此应暂缓。

### 5. 明确上下文预算

上下文窗口包含输入、输出，并且对某些模型还包含 reasoning tokens；总量超过窗口可能导致输出截断。[OpenAI conversation state guide](https://developers.openai.com/api/docs/guides/conversation-state#managing-the-context-window) 因为当前支持任意 OpenAI-compatible 模型，不能把某个 OpenAI 模型的窗口硬编码成系统事实。本轮延续现有 12,000 字 schema 上限，并在服务端再次校验证据数量和每段 1,800 字上限；这是一条明确的应用边界，不等同于精确 token 预算。下一阶段应新增提供方配置：

```text
STORY_MODEL_CONTEXT_TOKENS
STORY_MODEL_MAX_OUTPUT_TOKENS
STORY_MODEL_TOKENIZER
```

每次请求使用：

```text
inputBudget = contextWindow - maxOutput - safetyReserve
```

上下文包按优先级裁剪：系统与输出契约 → 分歧点与 branch canon → 当前人物/地点/规则 → 检索证据 → 最近已接受回合 → 低优先级篇章背景。使用 OpenAI 模型时可通过官方 tiktoken 方法计数；官方 Cookbook 也提醒聊天消息的计数方式与模型有关，应把结果视为估算而不是跨提供方真值。[How to count tokens with tiktoken](https://developers.openai.com/cookbook/examples/how_to_count_tokens_with_tiktoken)

若提供方支持严格 JSON Schema，应优先使用 Structured Outputs；官方文档说明可直接指定 JSON Schema，但只支持其子集。[OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) 对不支持的 OpenAI-compatible 服务，保留当前“解析 JSON + Zod 校验 + 一次可控重试”的降级路径。

## 下一阶段：渐进式、可恢复处理

本轮不运行全书摘要任务，章节目录建好即可选焦点和生成上下文；全文与目录只在页面内存，刷新后重新导入。若下一阶段开始构建全书摘要，2,463 个章节不能让用户在空白页面等待全部处理完成，届时建议分成两个就绪状态：

- `FOCUS_READY`：章节目录已建立，用户选定分歧点；只处理分歧点之前的邻近窗口和检索命中的早期章节，随后即可开始游戏；
- `INDEX_READY`：后台逐步完成全书的章节、篇章和全局索引，后续回合质量随索引完善而提升。

下一阶段可由用户明确选择是否用 IndexedDB 保存原文、章节、chunks、摘要、事实与任务。IndexedDB 标准定义了带 key 和 index 的结构化记录数据库，也允许保存字符串、Blob 和 File。[W3C Indexed Database API](https://www.w3.org/TR/IndexedDB/) `localStorage` 仍只保留小型 UI/session 引用，不保存整本 `sourceText`。

任务记录建议包含：

```ts
type IngestionJob = {
  sourceId: string;
  parserVersion: string;
  promptVersion: string;
  modelId: string;
  stage: "decode" | "segment" | "summarize-chapter" | "summarize-arc" | "build-bible";
  itemId: string;
  status: "pending" | "running" | "done" | "failed";
  attempts: number;
  inputHash: string;
  outputHash?: string;
  lastError?: string;
};
```

下一阶段每完成一个 item，就用事务同时写入结果和 `done` 状态；重新打开页面时把遗留 `running` 改回 `pending`，仅重跑 hash 或版本发生变化的 item。原始文件不上传和服务端不持久化仍可保持：浏览器逐项向 Route Handler 发送小请求，成功后在本地 checkpoint；用户重新选择同一文件时以 `sourceId` 关联已有进度。

## 最小可实现切片（本轮建议）

目标不是一次实现完整 RAG，而是让这个 15 MB、GB18030、2,463 章的文件真实进入产品，并在一个明确章节开始可信推演。

### P0：本轮应实现

1. **长篇导入器**：接受 `.txt/.md`，上限至少 20 MiB；自动严格识别 UTF-8/GB18030，显示检测结果和无法解码的可恢复错误。
2. **本地章节目录**：按中文章节标题生成可搜索目录；没有可靠标题时按段落生成编号片段，超长章节继续拆成标注清楚的 parts。
3. **焦点选择**：用户选择一个章节或片段作为焦点，产品据此确定原作证据的时间上界，不假设已经理解其他章节。
4. **有界上下文包**：优先放入完整焦点，再按确定性规则补邻近文本，总长度不超过 12,000 字；用户可以预览和编辑后再发送分析。
5. **有界原文证据**：开始剧情和每轮推演最多附带 3 段、每段最多 1,800 字的证据；候选只来自焦点及更早单元，以已确认世界卡中的人物名和当前决策做透明词法评分。世界卡与证据冲突时以用户确认的世界卡为准。
6. **仅内存保存原文**：全文、章节目录和词法索引只在当前页面内存；不进 `localStorage`、IndexedDB 或服务端，刷新后明确要求重新导入。
7. **诚实披露**：显示编码、字符数、章节/片段数、当前焦点和实际发送长度；明确说明这是长篇导航与局部证据，不是全书语义理解，也不模仿原作者文风。

### P1：随后补齐

- 带 `evidenceRefs`、`introducedAt/validFrom/validTo/revealedToProtagonistAt` 的时间化故事圣经；
- L1 章节、L2 篇章、L3 全书层级摘要，以及后台渐进任务和手动暂停/继续；
- 经用户明确同意的 IndexedDB 持久化、内容 hash、断点恢复和版本失效；
- 人物别名合并、同名消歧和作者确认队列；
- 故事圣经的证据浏览器与事实纠错；
- 模型相关 token 计数、上下文预算仪表和关键词召回离线质量集；
- 对支持 embeddings 的提供方增加混合检索，并保留无 embeddings 降级路径；
- 若上线云端，再增加对象存储直传、账号隔离和删除机制。

### 本轮明确不实现

- 把整本文件一次上传给 Route Handler 或一次发给模型；
- 承诺“模型已经完整记住全书”；
- RAPTOR 式向量聚类树、云端 vector store 或新的向量数据库；
- 自动模仿原作者文风；产品只使用人物、世界规则和剧情事实作为用户控制的创作背景；
- PDF、EPUB、扫描件/OCR、多文件书库；
- 多用户同步、共享索引或服务端长期保存小说全文。

## 验收与回归测试

1. **编码**：用自制的 UTF-8 与 GB18030 小样本做自动测试；对用户文件做手动 smoke，严格解码后无替换字符，不把小说正文提交进仓库。
2. **章节与分片**：章节序号单调、范围不重叠、最后一个 reading unit 覆盖至文件末尾；无标题与超长章节 fixture 也能生成可选片段。本样本手动 smoke 显示 2,463 个标题候选。
3. **上下文**：选择靠后的焦点，生成的可编辑上下文包不超过 12,000 字，并能进入现有世界卡阶段。
4. **前序证据**：构造焦点前后都含相同关键词的合成长篇；召回最多 3 段、每段最多 1,800 字，且绝不返回焦点之后的单元。
5. **内存边界**：刷新后要求重新导入原文；已确认世界卡和分支状态仍可恢复，但不会假装原文证据仍可用。
6. **短篇回归**：粘贴、示例和短文件路径行为保持不变，长篇索引在切换来源或重新开始时清除。
7. **部署边界**：网络面板中不出现 15 MB 的单请求；若部署到 Vercel，不触发 4.5 MB Function payload 限制。

时间事实防泄漏、摘要任务断点恢复、token 预算和证据引用完整性属于下一阶段故事圣经的验收集，不应阻塞本轮临时导航交付。

## 数据与版权提示

界面应继续在处理前明确提示“哪些文本会发送给所配置的模型提供商”。OpenAI 官方说明 API 输入输出默认不用于训练，除非客户主动选择共享；但默认的滥用监控日志可能保留客户内容最长 30 天。[OpenAI API data controls](https://platform.openai.com/docs/models/default-usage-policies-by-endpoint) 这只适用于 OpenAI 本身，不能推广到任意 OpenAI-compatible 端点，因此产品必须展示实际 provider，并让用户决定是否发送。

长篇模式应默认只发送当前焦点分析或本轮推演所需的小片段，不上传整本，也不对外展示小说原文。生成目标应表述为“在经用户确认的世界规则与剧情事实下探索另一条路径”，而不是复刻作者原文或承诺文风模仿。
