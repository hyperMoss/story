---
status: ready-for-agent
tracker: local-fallback
---

# 岔路：长篇蓝本导航与有界原文证据规格

## Problem Statement

故事作者希望以完整长篇小说作为动态剧情蓝本，但现有产品只接受 400～12,000 字的 UTF-8 短篇或章节。真实蓝本可能达到数百万字、包含数千章并使用 GB18030 编码，无法直接放入模型上下文，也不能安全写入浏览器本地存储。简单扩大输入上限既不能让模型准确定位作者想改变的情节，还会制造“应用已经理解整本书”的错误预期。

## Solution

在现有导入阶段增加“长篇蓝本”路径。浏览器读取 `.txt/.md` 文件后自动尝试 UTF-8 与 GB18030 解码，识别章节，并把过长章节拆成可导航片段。作者搜索和选择一个焦点章节，应用围绕它生成不超过 12,000 字的上下文包，继续沿用现有世界卡确认、分歧点选择和 4～12 回合有界推演流程。

整本原文只在当前页面内存中存在，不进入 `localStorage`，也不整体发送给服务端。只发送当前上下文包；页面仍保有长篇蓝本时，开始剧情和每轮推演可附带焦点章节及其之前的少量原文证据，帮助模型遵守人物关系和世界事实。界面明确展示文件编码、字符数、章节数、当前焦点与实际发送长度，不承诺模仿原作者文风或完整理解全书。

## User Stories

1. As a 故事作者, I want to import a multi-megabyte `.txt` novel, so that I do not need to manually extract a chapter before using the product.
2. As a 故事作者, I want GB18030 and UTF-8 text to decode correctly, so that common Chinese ebook files do not become mojibake.
3. As a 故事作者, I want unsupported or oversized files rejected with a recoverable message, so that the page does not freeze or lose my current work.
4. As a 故事作者, I want the product to show the detected encoding, character count, and chapter count, so that I can verify the import result.
5. As a 故事作者, I want chapter headings recognized automatically, so that a book with thousands of chapters remains navigable.
6. As a 故事作者, I want long documents without chapter headings divided into readable sections, so that the long-form path is not limited to one ebook format.
7. As a 故事作者, I want an overlong chapter divided into labelled parts, so that any position in that chapter can become a focus without exceeding model limits.
8. As a 故事作者, I want to search chapter titles, so that I can reach a known plot arc without scrolling through thousands of options.
9. As a 故事作者, I want to choose a focus chapter or part, so that the model analyzes the location I actually intend to branch from.
10. As a 故事作者, I want nearby text included only within a clear character budget, so that the request has useful context without pretending to contain the whole book.
11. As a 故事作者, I want to preview and edit the generated context package, so that I remain in control of what is sent to the model.
12. As a privacy-conscious author, I want to know that the full book stays in the current page and only the context package is sent, so that the transfer boundary is explicit.
13. As a 故事作者, I want changing the focus to rebuild the context package deterministically, so that I can compare possible branch locations.
14. As a 故事作者, I want the existing short-story import path to continue working unchanged, so that long-form support does not complicate small inputs.
15. As a 故事作者, I want the long-form source index to be discarded when I restart, so that the application does not silently retain the book.
16. As a returning author, I want confirmed world facts and accepted rounds to remain restorable without persisting the full book, so that privacy does not destroy useful progress.
17. As a 故事作者, I want the product to explain that re-import is required after a refresh when original-text evidence is needed, so that missing evidence is not invisible.
18. As a 故事作者, I want turn generation to consult only source evidence at or before the focus, so that original post-divergence events do not force the new timeline.
19. As a 故事作者, I want source evidence treated as supporting material and the edited story world card treated as canonical, so that my corrections win over noisy retrieval.
20. As a 故事作者, I want generation to preserve facts and character logic without imitating the original author's prose, so that the feature is about constrained exploration rather than style cloning.
21. As an evaluator, I want a deterministic browser test that uploads a synthetic long book and completes analysis, so that the long-form path is demonstrably real.
22. As a maintainer, I want parsing and context assembly isolated from model calls, so that the file boundary can evolve without changing the story-state contract.
23. As a maintainer, I want all model-bound excerpts capped by runtime schemas, so that a client bug cannot send the complete book through an API route.
24. As a repository reviewer, I want README claims to distinguish long-file navigation from full-book semantic understanding, so that product capability is not overstated.

## Implementation Decisions

- Preserve the existing browser-level end-to-end workflow and four-stage product state machine.
- Accept `.txt` and `.md` files up to 20 MiB. Try strict UTF-8 decoding first and fall back to GB18030. Reject files that cannot be decoded into meaningful text.
- Build a transient long-form source index in the browser. It contains file metadata and navigable reading units; it is not part of the persisted story session.
- Recognize Chinese chapter headings. If a document has no reliable headings, split it at paragraph boundaries into labelled sections. Split any oversized chapter into labelled parts.
- Call the author-selected reading unit the焦点章节 even when it represents one part of an oversized chapter.
- Build a context package of at most 12,000 characters, prioritizing the complete focal unit, then up to two reading units before and after it. Include distance labels that distinguish focal and neighboring text, and explain in the UI that the selected unit is an anchor rather than the only material sent.
- Put the context package into the existing editable source field. Analysis continues to use the existing validated request contract and world-card confirmation boundary.
- Do not upload, cache, or persist the full long-form source. The server receives only the context package and bounded source-evidence excerpts.
- Add an optional source-evidence contract to story start and turn requests. Permit no more than three excerpts, each no more than 1,800 characters.
- Retrieve evidence only from the focal unit and earlier units. Rank earlier units with transparent lexical matches from confirmed character names and the current decision context; do not introduce embeddings or opaque remote retrieval.
- Treat the edited story world card as canonical when evidence conflicts with it. Evidence constrains facts but never forces the original post-divergence outcome.
- Clear the in-memory source index when the author selects the sample, pastes a different story, imports a short file, or restarts.
- Keep the current fake-model contract. It may ignore optional source evidence, while real-model prompts explain the evidence hierarchy and prohibit style imitation.
- Continue using the repository-local spec fallback with `ready-for-agent` because no issue tracker workflow is configured.

## Testing Decisions

- Keep one highest-level browser seam using the deterministic fake model.
- Add a synthetic long-book browser scenario that uploads a file larger than the direct-input limit, verifies detected metadata and chapter navigation, selects a later focus, confirms the generated context is at most 12,000 characters, and reaches the editable world-card stage.
- Add a GB18030 browser fixture assembled in the test process, so the repository does not contain or depend on the user-provided novel.
- Retain the existing short-input, failure recovery, session restoration, reset-race and four-round tests.
- Verify type checking, linting, production build, and the complete Playwright suite.
- Manually inspect desktop and narrow mobile layouts for the long-form navigator.
- A real-model smoke test remains separate and must not be claimed without credentials.

## Out of Scope

- Uploading or storing the complete book on the application server.
- Embeddings, a vector database, accounts, cloud bookshelves, or cross-device source indexes.
- Automatically summarizing every chapter or claiming full-book comprehension.
- EPUB, PDF, Word, archive files, DRM removal, or OCR.
- Importing the provided copyrighted novel into the repository or test fixtures.
- Reproducing long source passages in generated reports or imitating the original author's prose style.
- Choosing a divergence without author-selected source location.
- Searching original events after the focal chapter during alternative-timeline generation.

## Further Notes

- The inspected novel is about 15.1 MB and 7.61 million decoded characters with roughly 2450 chapter headings. This validates the need for structural navigation and bounded context rather than a larger textarea limit.
- The canonical vocabulary is recorded in `GLOSSARY.md`, and the transient-index decision is recorded in ADR-0002.
- The prior browser test seam remains the approved acceptance boundary; this autonomous iteration does not introduce a second testing architecture.
