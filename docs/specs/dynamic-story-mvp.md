---
status: ready-for-agent
tracker: local-fallback
---

# 岔路：动态故事推演 MVP 规格

## Problem Statement

故事作者在已有短篇或章节中发现关键决定还有其他可能时，通常只能依靠脑内推演或让通用聊天工具继续写。前者很难同时追踪人物关系、风险和未解决冲突，后者又容易把原始故事事实、模型临时生成内容和作者真正接受的新剧情混在一起。作者需要一种既有游戏化探索感、又保留创作控制权的方式，从一个明确的分歧点连续推演另一条剧情线，并把结果带回后续写作。

## Solution

构建一个名为“岔路”的单人 Web 产品。故事作者粘贴短篇或章节，或导入 `.txt/.md`，由真实文本模型提炼可编辑的故事世界卡和三个分歧候选。作者选定分歧点后接管原故事主角，在四个场景回合中从三个建议行动或一个自定义行动中做选择。每次推演先作为草案展示状态变化和简短依据，只有作者接受后才提交到结构化剧情状态；作者也可提供一句修正意见，从相同的已接受状态重新推演。四轮结束后生成可复制的 Markdown 新剧情线回顾。

产品以原创当代悬疑示例保障首次体验，以浏览器本地存储恢复进度，以服务端环境变量保护模型密钥和演示访问码。服务端不持久化故事内容。

## User Stories

1. As a 故事作者, I want to understand the product promise before entering any story, so that I know this is a constrained story exploration tool rather than an unlimited writing chatbot.
2. As an evaluator, I want to enter a supplied access code, so that I can use the real model without supplying my own API key.
3. As a 故事作者, I want to paste a short story or chapter, so that I can explore material I already own or am creating.
4. As a 故事作者, I want to import a UTF-8 `.txt` or `.md` file, so that I do not need to copy a long chapter manually.
5. As a first-time user, I want to load an original suspense example, so that I can immediately understand the intended input and complete the main path.
6. As a 故事作者, I want clear feedback when my text is empty, too short, too long, or unreadable, so that I can correct it without losing work.
7. As a privacy-conscious author, I want to know that my text is sent to the configured model service, so that I can make an informed decision before analysis.
8. As a 故事作者, I want the model to extract core characters, world rules, and original plot events, so that later generation has explicit constraints.
9. As a 故事作者, I want to edit the story world card, so that model misunderstandings do not silently become story facts.
10. As a 故事作者, I want three high-value divergence candidates with short explanations, so that I can choose an interesting alternative without searching the whole chapter manually.
11. As a 故事作者, I want events before the chosen divergence point to remain fixed, so that the alternative timeline still grows from my original story.
12. As a 故事作者, I want to control the original protagonist, so that choices remain grounded in the character I wrote.
13. As a 故事作者, I want each scene to present three meaningfully different suggested actions, so that choosing between them feels consequential.
14. As a 故事作者, I want to enter a custom action, so that I am never limited to the model's suggestions.
15. As a 故事作者, I want to see a proposed result before it becomes canon in the new plotline, so that generation does not remove my editorial control.
16. As a 故事作者, I want to see relationship, goal, risk, and unresolved-conflict changes after a choice, so that the consequence chain is legible.
17. As a 故事作者, I want a concise causal explanation tied to my action and established world facts, so that I can judge whether the proposal is coherent.
18. As a 故事作者, I want to accept a proposal, so that it becomes the only state used by subsequent rounds.
19. As a 故事作者, I want to reject a proposal with one correction instruction, so that the model can retry without advancing the round or polluting accepted state.
20. As a 故事作者, I want exactly four accepted scene rounds in the MVP, so that the experience reaches a deliberate conclusion instead of becoming an endless generator.
21. As a 故事作者, I want a final synopsis, decision timeline, original-plot differences, character changes, preserved facts, and unresolved conflicts, so that the exploration becomes usable writing material.
22. As a 故事作者, I want to copy the final result as Markdown, so that I can continue working in my preferred writing tool.
23. As a returning author, I want my current session restored after a refresh, so that an accidental reload does not erase accepted work.
24. As a 故事作者, I want to clear local progress and start over, so that I remain in control of locally retained content.
25. As a 故事作者, I want model and validation failures to preserve my source and accepted state, so that retrying is safe.
26. As an evaluator, I want obvious waiting, success, error, and retry states, so that the product feels complete even when generation takes time.
27. As a mobile or desktop evaluator, I want the primary path to remain readable and operable across common viewport sizes, so that presentation quality does not depend on one screen.
28. As a repository reviewer, I want a README that separates real, mocked, incomplete, and out-of-scope capabilities, so that implementation claims are auditable.
29. As a maintainer, I want the model response validated before it reaches product state, so that malformed output cannot silently corrupt the session.
30. As a maintainer, I want the fake and real model paths to share the same domain contract, so that deterministic tests exercise the same external behavior as production.

## Implementation Decisions

- Build one TypeScript full-stack Web application with a responsive client and server-only model routes. Do not add a database.
- Keep the model vendor behind one gateway configured by environment variables. Production uses one real OpenAI-compatible text model; automated tests use a deterministic fake gateway with the same validated output contract.
- Protect model routes with a single demo access code stored server-side. The model API key must never be sent to the browser.
- Treat the editable story world card as canonical after author confirmation. It contains core characters, world rules, and original plot events.
- Use an explicit structured story state containing the confirmed world card, chosen divergence, protagonist situation, character states, relationships, risks, unresolved conflicts, and accepted rounds.
- Separate the current accepted state from a turn proposal. A proposal contains the resulting scene, three next suggested actions, state changes, concise rationale, and proposed next state. Only acceptance commits it.
- Regeneration with a correction instruction uses the same accepted state, current scene, and selected action. It replaces the proposal but does not increase the accepted-round count.
- Finish after four accepted rounds. Generate the final review only from confirmed world facts, the chosen divergence, accepted rounds, and final accepted state.
- Save the current session in browser local storage. Never persist source stories or generated content on the application server.
- Support pasted text, UTF-8 `.txt` and `.md` files, and one bundled original suspense sample. Reject unsupported formats and enforce a bounded source length with clear feedback.
- Present the experience as a restrained suspense text-adventure stage with readable long-form typography, transitions, action cards, a progress rail, and an author-facing state panel. Do not generate images.
- Expose concise causal rationale only. Never request or display hidden chain-of-thought.
- Surface provider, timeout, authorization, validation, and file-reading failures as recoverable user-facing errors while preserving accepted work.
- The local fallback spec carries `ready-for-agent` status because the repository has no configured issue tracker. It replaces issue publication for this implementation run.

## Testing Decisions

- Test external behavior rather than internal functions or prompt wording.
- Use one primary automated seam: a browser-level end-to-end test running the complete application against the deterministic fake model gateway.
- The main happy-path test covers access, built-in example, analysis, author edits, divergence selection, suggested and custom actions, correction regeneration, four accepted rounds, final review, Markdown copy availability, and local session recovery.
- Additional browser scenarios cover invalid source input, failed or malformed model responses, safe retry, and clearing local progress.
- Exercise server validation through the same browser flow by configuring the fake gateway to produce a controlled malformed or failed response; do not duplicate behavior with low-level route tests unless the browser seam cannot express it.
- Perform a separate manual smoke test against the configured real model after deployment. This verifies provider compatibility and content quality but is not an automated assertion because it is nondeterministic and incurs cost.
- Perform one production-build check and one secret-exposure check in addition to the browser tests.
- No prior test seam exists because this is a new repository.

## Out of Scope

- Whole-novel ingestion, chunking, embeddings, retrieval, or RAG.
- Unlimited scene generation or model-selected endings.
- Scene illustrations, video, voice, or generated character art.
- Accounts, cloud project storage, cross-device sync, or collaboration.
- Public sharing links or a separate reader/player experience.
- A persistent parallel-branch tree or version-control interface.
- PDF, Word, EPUB, or scanned-document ingestion.
- Multiple model selection or provider configuration in the UI.
- Promising imitation of an original author's prose style.
- Using cached outputs to impersonate a successful live-model request.

## Further Notes

- The canonical domain vocabulary is defined in `GLOSSARY.md`.
- The structured-state decision is recorded in ADR-0001.
- The assessment values a small, fully completed path over broad functionality. If time is constrained, remove decorative animation and secondary settings before weakening the real model path, author confirmation, proposal acceptance boundary, final review, error recovery, or deployment verification.
- The planned total implementation budget is nine hours, including README, deployment work, validation, and recording preparation.
