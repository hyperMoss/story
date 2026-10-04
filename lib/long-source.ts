import type { SourceEvidence } from "@/lib/domain";

export const DIRECT_SOURCE_LIMIT = 12_000;
export const LONG_FILE_LIMIT_BYTES = 20 * 1024 * 1024;

const READING_UNIT_LIMIT = 6_200;
const EVIDENCE_EXCERPT_LIMIT = 1_600;
const CHAPTER_HEADING =
  /^[\t \u3000]*(第[0-9零〇一二两三四五六七八九十百千万]+(?:章|回|节)[^\n]{0,80})[\t \u3000]*$/gm;

export type StoryFileEncoding = "UTF-8" | "GB18030";

export type ReadingUnit = {
  id: string;
  label: string;
  content: string;
  chapterIndex: number;
  part: number;
  partCount: number;
};

export type LongStorySource = {
  fileName: string;
  encoding: StoryFileEncoding;
  byteSize: number;
  charCount: number;
  structure: "chapters" | "sections";
  chapterCount: number;
  units: ReadingUnit[];
};

function normalizeText(text: string) {
  return text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
}

function looksLikeText(text: string) {
  if (!text.trim()) return false;
  const sample = text.slice(0, 20_000);
  const controlCharacters = sample.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g);
  return (controlCharacters?.length ?? 0) / sample.length < 0.01;
}

export function decodeStoryBuffer(buffer: ArrayBuffer) {
  const attempts: Array<{ encoding: StoryFileEncoding; label: string }> = [
    { encoding: "UTF-8", label: "utf-8" },
    { encoding: "GB18030", label: "gb18030" },
  ];

  for (const attempt of attempts) {
    try {
      const text = normalizeText(
        new TextDecoder(attempt.label, { fatal: true }).decode(buffer),
      );
      if (looksLikeText(text)) return { text, encoding: attempt.encoding };
    } catch {
      // Try the next supported Chinese text encoding.
    }
  }

  throw new Error("无法按 UTF-8 或 GB18030 读取这个文件，请先转换为纯文本。");
}

function splitAtParagraphs(text: string, limit = READING_UNIT_LIMIT) {
  const pieces: string[] = [];
  let current = "";

  function flush() {
    const value = current.trim();
    if (value) pieces.push(value);
    current = "";
  }

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();
    if (line.length > limit) {
      flush();
      for (let offset = 0; offset < line.length; offset += limit) {
        pieces.push(line.slice(offset, offset + limit));
      }
      continue;
    }
    const addition = current ? `\n${line}` : line;
    if (current.length + addition.length > limit) flush();
    current += current ? `\n${line}` : line;
  }
  flush();
  return pieces;
}

function unitsForChapter(title: string, body: string, chapterIndex: number) {
  const pieces = splitAtParagraphs(body);
  const safePieces = pieces.length ? pieces : [body.trim() || title];
  return safePieces.map((piece, index): ReadingUnit => ({
    id: `chapter-${chapterIndex}-part-${index + 1}`,
    label:
      safePieces.length === 1
        ? title
        : `${title} · 片段 ${index + 1}/${safePieces.length}`,
    content: `${title}\n${piece}`.trim(),
    chapterIndex,
    part: index + 1,
    partCount: safePieces.length,
  }));
}

export function createLongStorySource({
  fileName,
  byteSize,
  text,
  encoding,
}: {
  fileName: string;
  byteSize: number;
  text: string;
  encoding: StoryFileEncoding;
}): LongStorySource {
  const matches = Array.from(text.matchAll(CHAPTER_HEADING));
  if (matches.length >= 2) {
    const units = matches.flatMap((match, chapterIndex) => {
      const bodyStart = (match.index ?? 0) + match[0].length;
      const bodyEnd = matches[chapterIndex + 1]?.index ?? text.length;
      return unitsForChapter(match[1].trim(), text.slice(bodyStart, bodyEnd), chapterIndex);
    });
    return {
      fileName,
      encoding,
      byteSize,
      charCount: text.length,
      structure: "chapters",
      chapterCount: matches.length,
      units,
    };
  }

  const pieces = splitAtParagraphs(text);
  return {
    fileName,
    encoding,
    byteSize,
    charCount: text.length,
    structure: "sections",
    chapterCount: 0,
    units: pieces.map((content, index) => ({
      id: `section-${index + 1}`,
      label: `长文片段 ${index + 1}`,
      content,
      chapterIndex: index,
      part: 1,
      partCount: 1,
    })),
  };
}

function takeStart(value: string, limit: number) {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function takeEnd(value: string, limit: number) {
  if (value.length <= limit) return value;
  return `…${value.slice(-Math.max(0, limit - 1)).trimStart()}`;
}

export function buildContextPackage(source: LongStorySource, focusIndex: number) {
  const safeIndex = Math.min(Math.max(focusIndex, 0), source.units.length - 1);
  const focus = source.units[safeIndex];
  const header = [
    `【长篇蓝本】${source.fileName}`,
    `【焦点章节】${focus.label}`,
    "【说明】焦点之外的相邻文字只用于确认分歧前语境，不代表新剧情必须沿原作发展。",
  ].join("\n");
  const focusBlock = `【焦点原文】\n${takeStart(focus.content, 7_600)}`;
  const reserved = header.length + focusBlock.length + 12;
  const neighborBudget = Math.max(0, DIRECT_SOURCE_LIMIT - reserved);
  const previous = source.units[safeIndex - 1];
  const next = source.units[safeIndex + 1];
  const previousBudget = next ? Math.floor(neighborBudget / 2) : neighborBudget;
  const nextBudget = previous ? neighborBudget - previousBudget : neighborBudget;
  const blocks = [header];

  if (previous && previousBudget > 80) {
    blocks.push(`【前文：${previous.label}】\n${takeEnd(previous.content, previousBudget - 18)}`);
  }
  blocks.push(focusBlock);
  if (next && nextBudget > 80) {
    blocks.push(`【后文：${next.label}】\n${takeStart(next.content, nextBudget - 18)}`);
  }

  return blocks.join("\n\n").slice(0, DIRECT_SOURCE_LIMIT);
}

function excerptAroundTerms(content: string, terms: string[]) {
  const normalized = content.toLocaleLowerCase("zh-CN");
  const firstMatch = terms
    .map((term) => normalized.indexOf(term))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];
  const start = Math.max(0, (firstMatch ?? 0) - Math.floor(EVIDENCE_EXCERPT_LIMIT / 3));
  const prefix = start > 0 ? "…" : "";
  const excerpt = content.slice(start, start + EVIDENCE_EXCERPT_LIMIT - prefix.length);
  return `${prefix}${excerpt}${start + excerpt.length < content.length ? "…" : ""}`;
}

export function retrieveSourceEvidence(
  source: LongStorySource,
  focusIndex: number,
  rawTerms: string[],
): SourceEvidence[] {
  const safeIndex = Math.min(Math.max(focusIndex, 0), source.units.length - 1);
  const terms = Array.from(
    new Set(rawTerms.map((term) => term.trim().toLocaleLowerCase("zh-CN")).filter((term) => term.length >= 2)),
  );
  const focus = source.units[safeIndex];
  const evidence: SourceEvidence[] = [
    {
      label: `焦点：${focus.label}`,
      excerpt: excerptAroundTerms(focus.content, terms),
    },
  ];

  const ranked = source.units
    .slice(0, safeIndex)
    .map((unit, index) => {
      const content = unit.content.toLocaleLowerCase("zh-CN");
      const matches = terms.reduce(
        (score, term) => score + (content.includes(term) ? Math.min(6, term.length) : 0),
        0,
      );
      return {
        unit,
        matches,
        score: matches * 10 + index / Math.max(1, safeIndex),
      };
    })
    .filter((candidate) => candidate.matches > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 2);

  for (const candidate of ranked) {
    evidence.push({
      label: `分歧前证据：${candidate.unit.label}`,
      excerpt: excerptAroundTerms(candidate.unit.content, terms),
    });
  }
  return evidence;
}
