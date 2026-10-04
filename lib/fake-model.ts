import type {
  DivergenceCandidate,
  StoryReview,
  StoryState,
  StoryWorldCard,
  TurnRequest,
} from "@/lib/domain";

export type ModelTask = "analyze" | "start" | "turn" | "review";

const worldCard: StoryWorldCard = {
  title: "闭馆之后",
  characters: [
    {
      name: "林夏",
      identity: "市立博物馆的年轻修复师，也是失踪保安林舟的姐姐",
      goal: "在午夜闭馆前找到弟弟失踪的真实原因",
      relationships: ["林舟：失踪三天的弟弟", "周明：谨慎但有所隐瞒的夜班保安"],
    },
    {
      name: "周明",
      identity: "当晚唯一值班的保安",
      goal: "阻止旧展厅的秘密被公开",
      relationships: ["林夏：表面协助，实际保持戒备", "馆长：受其秘密委托"],
    },
    {
      name: "顾馆长",
      identity: "博物馆馆长，正在推动一场重要捐赠展",
      goal: "确保捐赠展按时开幕",
      relationships: ["林舟：失踪前曾与其发生争执", "周明：掌握他的家庭困境"],
    },
  ],
  rules: [
    "午夜后旧展厅会自动断电并锁死，必须从外部总控室解除",
    "馆内无线电只能单向收到地下库房的信号",
    "所有出入记录会同步到馆长办公室，但记录可能被管理员覆盖",
  ],
  originalPlot: [
    "林舟在调查一件来源可疑的捐赠展品后失踪",
    "林夏借修复工作进入闭馆后的博物馆寻找线索",
    "周明要求林夏立即离开旧展厅，并声称那里发生了电路故障",
    "原始故事中，林夏假装离开，随后独自潜入地下库房",
  ],
};

const divergences: DivergenceCandidate[] = [
  {
    id: "tell-the-truth",
    title: "把录音交给周明",
    moment: "周明拦在旧展厅门口时，林夏口袋里的录音笔突然收到弟弟的呼救片段。",
    originalAction: "林夏隐瞒录音，假装离开后独自潜入地下库房。",
    reason: "公开录音会迫使周明立即表态，让原本暗中的调查变成一场关系与信任的赌博。",
  },
  {
    id: "call-curator",
    title: "当场联系馆长",
    moment: "林夏发现旧展厅的出入记录刚被管理员账户覆盖。",
    originalAction: "林夏没有声张，拍下记录后继续秘密调查。",
    reason: "直接对质可能得到正式权限，也可能让掌握系统的人提前销毁证据。",
  },
  {
    id: "follow-radio",
    title: "回应地下室的无线电",
    moment: "单向无线电里传来一句只有林夏和弟弟才知道的童年暗号。",
    originalAction: "林夏认为这是陷阱，没有回应。",
    reason: "回应会暴露她的位置，却也可能第一次改变失踪者只能单向传递信息的局面。",
  },
];

function actionSet(round: number) {
  return [
    {
      id: `probe-${round}`,
      label: "追问对方刚才话里的矛盾",
      intent: "用已经掌握的事实迫使对方透露更多信息",
    },
    {
      id: `protect-${round}`,
      label: "先保护证据，再寻找更安全的入口",
      intent: "降低立即风险，同时保留后续调查能力",
    },
    {
      id: `trust-${round}`,
      label: "暂时相信对方，交换一条关键信息",
      intent: "以有限信任换取合作，但不交出全部底牌",
    },
  ];
}

function initialState(card: StoryWorldCard): StoryState {
  const protagonist = card.characters[0];
  return {
    protagonistName: protagonist.name,
    protagonistGoal: protagonist.goal,
    situation: "分歧点已经发生，林夏必须在闭馆倒计时内决定下一步。",
    characterStates: card.characters.map((character) => ({
      name: character.name,
      status: `${character.identity}；当前目标：${character.goal}`,
    })),
    relationships: protagonist.relationships.map((relationship) => ({
      between: `${protagonist.name}与${relationship.split("：")[0]}`,
      status: relationship.split("：").slice(1).join("：") || "关系尚未明确",
    })),
    risks: ["旧展厅将在午夜锁死"],
    unresolvedConflicts: ["林舟是否仍在馆内", "谁覆盖了出入记录"],
    acceptedRounds: [],
  };
}

export function fakeModelResponse(task: ModelTask, payload: unknown): unknown {
  if (task === "analyze") {
    return { worldCard, divergenceCandidates: divergences };
  }

  if (task === "start") {
    const input = payload as {
      worldCard: StoryWorldCard;
      divergence: DivergenceCandidate;
    };
    const protagonist = input.worldCard.characters[0].name;
    return {
      frame: {
        scene: `${input.divergence.moment} ${protagonist}没有照原来的方式退开。走廊尽头的应急灯每隔三秒闪烁一次，周明的手仍压在旧展厅门禁上，像是在等待一个不会再来的命令。`,
        suggestedActions: actionSet(1),
      },
      storyState: initialState(input.worldCard),
    };
  }

  if (task === "turn") {
    const input = payload as TurnRequest;
    const round = input.storyState.acceptedRounds.length + 1;
    const correction = input.correction
      ? `她同时遵守了作者的修正：${input.correction}`
      : "她没有等待别人替她作出决定。";
    const newRisk = `第 ${round} 轮后，馆内可用时间进一步缩短`;
    return {
      resultScene: `${input.storyState.protagonistName}选择“${input.action.label}”。${correction} 周明短暂地移开视线，旧展厅里随即传来金属柜门合拢的回声。这个反应没有直接给出答案，却让她确认有人正在利用断电前的最后几分钟转移东西。`,
      nextActions: actionSet(Math.min(round + 1, 4)),
      stateChanges: [
        {
          area: "risk",
          summary: newRisk,
        },
        {
          area: "relationship",
          summary: `林夏与周明之间的信任变得更脆弱，但周明开始认真回应她。`,
        },
      ],
      rationale: [
        `“${input.action.label}”直接改变了双方的信息差，因此周明必须用行动而不是沉默回应。`,
        "旧展厅锁死规则仍然成立，所以新的线索同时带来更强的时间压力。",
      ],
      nextState: {
        ...input.storyState,
        situation: `林夏确认旧展厅内仍有人活动，并承受第 ${round} 轮选择带来的新压力。`,
        relationships: input.storyState.relationships.map((relationship, index) =>
          index === 0
            ? { ...relationship, status: "有限合作与明显戒备并存" }
            : relationship,
        ),
        risks: Array.from(new Set([...input.storyState.risks, newRisk])),
        unresolvedConflicts: Array.from(
          new Set([
            ...input.storyState.unresolvedConflicts,
            "旧展厅里正在被转移的物品是什么",
          ]),
        ),
      },
    };
  }

  const input = payload as { storyState: StoryState; worldCard: StoryWorldCard };
  const rounds = input.storyState.acceptedRounds;
  const choices = rounds.map((round) => ({
    round: round.round,
    action: round.action,
    result: round.stateChanges.map((change) => change.summary).join("；"),
  }));
  const markdown = [
    "# 闭馆之后：另一条走廊",
    "",
    "## 新剧情梗概",
    "林夏没有沿着原始故事独自潜入，而是在不断交换信息与承担风险的过程中迫使周明参与调查。四次选择让秘密从个人追踪变成一场随时可能破裂的有限合作。",
    "",
    "## 关键选择",
    ...choices.map((choice) => `${choice.round}. **${choice.action}**：${choice.result}`),
    "",
    "## 未解决冲突",
    ...input.storyState.unresolvedConflicts.map((conflict) => `- ${conflict}`),
  ].join("\n");
  const review: StoryReview = {
    title: "闭馆之后：另一条走廊",
    synopsis:
      "林夏没有沿着原始故事独自潜入，而是在不断交换信息与承担风险的过程中迫使周明参与调查。四次选择让秘密从个人追踪变成一场随时可能破裂的有限合作。",
    choices,
    differences: [
      "林夏没有独自潜入地下库房，而是让周明成为不稳定的同行者。",
      "调查从寻找单一线索转向确认馆内仍有人转移物品。",
    ],
    characterChanges: [
      "林夏从隐秘调查者变成主动协商风险的决策者。",
      "周明从单纯阻拦者变成仍有隐瞒的有限合作者。",
    ],
    unresolvedConflicts: input.storyState.unresolvedConflicts,
    preservedFacts: input.worldCard.rules.slice(0, 3),
    markdown,
  };
  return review;
}
