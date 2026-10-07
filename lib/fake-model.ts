import type {
  DivergenceCandidate,
  StoryReviewContent,
  StoryState,
  StoryWorldCard,
  TurnRequest,
} from "@/lib/domain";
import { MAX_STORY_ROUNDS } from "@/lib/domain";

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
    const sourceText = String((payload as { sourceText?: unknown })?.sourceText ?? "");
    if (sourceText.includes("[测试：世界卡条目过多]")) {
      return {
        worldCard: {
          ...worldCard,
          rules: [...worldCard.rules, ...Array.from({ length: 10 }, (_, index) => `额外规则 ${index + 1}`)],
          originalPlot: [
            ...worldCard.originalPlot,
            ...Array.from({ length: 9 }, (_, index) => `额外事件 ${index + 1}`),
          ],
        },
        divergenceCandidates: divergences,
      };
    }
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
    const rationale = [
      `“${input.action.label}”直接改变了双方的信息差，因此周明必须用行动而不是沉默回应。`,
      "旧展厅锁死规则仍然成立，所以新的线索同时带来更强的时间压力。",
    ];
    if (input.action.label.includes("[测试：推演依据过多]")) {
      rationale.push("额外依据一。", "额外依据二。", "额外依据三。");
    }
    const correction = input.correction
      ? `她同时遵守了作者的修正：${input.correction}`
      : "她没有等待别人替她作出决定。";
    const newRisk = `第 ${round} 轮后，馆内可用时间进一步缩短`;
    return {
      resultScene: `${input.storyState.protagonistName}选择“${input.action.label}”。${correction} 周明短暂地移开视线，旧展厅里随即传来金属柜门合拢的回声。这个反应没有直接给出答案，却让她确认有人正在利用断电前的最后几分钟转移东西。`,
      nextActions: actionSet(Math.min(round + 1, MAX_STORY_ROUNDS)),
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
      rationale,
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
  const choiceCount = rounds.length;
  let choices = rounds.map((round) => ({
    round: round.round,
    action: round.action,
    result: round.stateChanges.map((change) => change.summary).join("；"),
  }));
  if (input.worldCard.title.includes("[测试：回顾回合错位]")) {
    choices = choices.map((choice, index) =>
      index === choices.length - 1 ? { ...choice, round: 1 } : choice,
    );
  }
  const synopsis = `林夏没有沿着原始故事独自潜入，而是在不断交换信息与承担风险的过程中迫使周明参与调查。${choiceCount} 次选择让秘密从个人追踪变成一场随时可能破裂的有限合作。`;
  const ending = {
    title: "午夜前的最后一扇门",
    scene: `旧展厅的自动锁发出最后一声倒计时提示时，林夏没有再独自追向地下库房。她把一路保留下来的证据摊在总控台上，也把每一次试探、退让与交换过的信息逐一说给周明听。周明望着监控中正在关闭的防火门，终于承认顾馆长利用他的家庭困境，逼他覆盖了林舟最后一次进入库房的记录。林夏没有因这句坦白放下戒备，而是让周明当着她的面恢复备份，并把录音和出入记录同时发送给馆外的同事。警报响起后，地下库房传来林舟断断续续的回应。两人赶在断电前开启应急通道，发现林舟受伤却仍守着那件被调包的展品。天亮时，警方封锁了旧展厅，捐赠展被迫延期。周明需要为自己的隐瞒负责，却也因最后的证词保住了林舟。林夏站在重新亮起的走廊里，明白这条路并没有让所有人毫发无伤，但她没有再让秘密只掌握在某一个人手中。她把修复台上的工作灯关掉，与弟弟一起走出博物馆；身后的门缓缓合拢，这一次，门内留下的是等待查明的证据，而不是被迫沉默的人。`,
    choicePayoffs: choices.map((choice) => ({
      round: choice.round,
      action: choice.action,
      payoff: `第 ${choice.round} 次选择留下的信息与风险，最终成为林夏迫使周明公开证据的一部分。`,
    })),
  };
  const review: StoryReviewContent = {
    title: "闭馆之后：另一条走廊",
    synopsis,
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
    ending,
  };
  return review;
}
