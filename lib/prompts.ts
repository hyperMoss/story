export const ANALYZE_INSTRUCTION = `
阅读作者提供的短篇或章节，提炼可编辑的故事世界卡，并找出三个高价值分歧候选。
返回 JSON：
{
  "worldCard": {
    "title": "故事标题",
    "characters": [{"name":"","identity":"","goal":"","relationships":[""]}],
    "rules": ["分歧后仍必须成立的事实"],
    "originalPlot": ["按顺序排列的关键事件"]
  },
  "divergenceCandidates": [{
    "id":"稳定短标识", "title":"", "moment":"关键时刻", "originalAction":"主角原本做了什么", "reason":"为什么值得探索"
  }]
}
必须恰好返回三个候选。只提取文本能够支持的事实，不虚构人物背景。`;

export const START_INSTRUCTION = `
根据作者确认的故事世界卡与分歧点，建立替代剧情的初始场景。
如果输入包含 sourceEvidence，它只是分歧点及之前的原文证据。作者确认的世界卡优先级更高；不得把分歧点之后的原作走向当作必须发生的未来，也不得模仿原作者文风。
返回 JSON：
{
  "frame": {"scene":"分歧刚发生时的场景", "suggestedActions":[{"id":"","label":"主角可采取的行动","intent":"行动意图"}]},
  "storyState": {
    "protagonistName":"", "protagonistGoal":"", "situation":"",
    "characterStates":[{"name":"","status":""}],
    "relationships":[{"between":"","status":""}],
    "risks":[""], "unresolvedConflicts":[""], "acceptedRounds":[]
  }
}
suggestedActions 必须恰好三个，彼此导向不同后果。主角是世界卡中的第一位核心人物。`;

export const TURN_INSTRUCTION = `
根据已接受剧情状态、当前场景和作者选择的行动，提出下一幕推演草案。
如果有修正意见，必须遵守，但不得改变既有世界事实。不要把尚未接受的草案写入 acceptedRounds。
如果输入包含 sourceEvidence，只用它核对分歧前人物、关系和世界事实。作者确认的世界卡优先级更高；不要续写或模仿原作者文风，也不要让原作后续结果覆盖作者已经接受的新剧情状态。
返回 JSON：
{
  "resultScene":"行动之后的新场景",
  "nextActions":[{"id":"","label":"","intent":""}],
  "stateChanges":[{"area":"goal|relationship|risk|conflict|character","summary":""}],
  "rationale":["只描述可公开核验的因果关系"],
  "nextState": {
    "protagonistName":"", "protagonistGoal":"", "situation":"",
    "characterStates":[{"name":"","status":""}],
    "relationships":[{"between":"","status":""}],
    "risks":[""], "unresolvedConflicts":[""], "acceptedRounds":[]
  }
}
nextActions 必须恰好三个；rationale 必须为 1～4 条。场景应推进而非复述选择，保持角色边界和世界规则。`;

export const REVIEW_INSTRUCTION = `
只根据作者确认的世界卡、分歧点、四个已接受回合和最终剧情状态，生成作者可继续使用的新剧情线回顾。
返回 JSON：
{
  "title":"新剧情线标题", "synopsis":"完整梗概",
  "choices":[{"round":1,"action":"","result":""}],
  "differences":["与原始剧情线的主要差异"],
  "characterChanges":["人物或关系变化"],
  "unresolvedConflicts":[""], "preservedFacts":["始终遵守的世界事实"],
  "markdown":"包含以上内容的完整 Markdown"
}
choices 必须恰好四项，并与已接受回合一致。`;
