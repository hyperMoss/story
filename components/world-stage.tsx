import type { DivergenceCandidate, StoryWorldCard } from "@/lib/domain";
import { ErrorNotice, LoadingButton } from "@/components/stage-shell";

function lines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function WorldStage({
  worldCard,
  candidates,
  selectedId,
  loading,
  error,
  onWorldCardChange,
  onSelect,
  onStart,
  onBack,
}: {
  worldCard: StoryWorldCard;
  candidates: DivergenceCandidate[];
  selectedId?: string;
  loading?: string;
  error?: string;
  onWorldCardChange: (card: StoryWorldCard) => void;
  onSelect: (id: string) => void;
  onStart: () => void;
  onBack: () => void;
}) {
  function updateCharacter(
    index: number,
    field: "name" | "identity" | "goal" | "relationships",
    value: string,
  ) {
    const characters = worldCard.characters.map((character, characterIndex) =>
      characterIndex === index
        ? {
            ...character,
            [field]: field === "relationships" ? lines(value) : value,
          }
        : character,
    );
    onWorldCardChange({ ...worldCard, characters });
  }

  return (
    <section className="world-stage">
      <div className="stage-heading centered-heading">
        <span className="kicker">02 / 故事世界卡</span>
        <h1>先确认哪些事实不能被改变。</h1>
        <p>AI 的理解不是答案。请修正人物、规则和原始剧情，确认后的内容才约束后续推演。</p>
      </div>

      <div className="world-layout">
        <div className="world-card-editor">
          <div className="editor-section">
            <div className="section-title-row">
              <span className="number-chip">01</span>
              <div>
                <h2>核心人物</h2>
                <p>第一位人物将作为你接管的主角。</p>
              </div>
            </div>
            <label className="field-label">
              故事标题
              <input
                value={worldCard.title}
                onChange={(event) =>
                  onWorldCardChange({ ...worldCard, title: event.target.value })
                }
              />
            </label>
            <div className="character-grid">
              {worldCard.characters.map((character, index) => (
                <article className="character-card" key={`${character.name}-${index}`}>
                  <span className="character-role">{index === 0 ? "主角" : `人物 ${index + 1}`}</span>
                  <label>
                    姓名
                    <input
                      value={character.name}
                      onChange={(event) => updateCharacter(index, "name", event.target.value)}
                    />
                  </label>
                  <label>
                    身份
                    <textarea
                      value={character.identity}
                      onChange={(event) => updateCharacter(index, "identity", event.target.value)}
                    />
                  </label>
                  <label>
                    当前目标
                    <textarea
                      value={character.goal}
                      onChange={(event) => updateCharacter(index, "goal", event.target.value)}
                    />
                  </label>
                  <label>
                    关键关系 · 每行一条
                    <textarea
                      value={character.relationships.join("\n")}
                      onChange={(event) =>
                        updateCharacter(index, "relationships", event.target.value)
                      }
                    />
                  </label>
                </article>
              ))}
            </div>
          </div>

          <div className="editor-section two-column-editor">
            <div>
              <div className="section-title-row compact">
                <span className="number-chip">02</span>
                <h2>世界规则</h2>
              </div>
              <textarea
                className="list-editor"
                value={worldCard.rules.join("\n")}
                onChange={(event) =>
                  onWorldCardChange({ ...worldCard, rules: lines(event.target.value) })
                }
                aria-label="世界规则，每行一条"
              />
            </div>
            <div>
              <div className="section-title-row compact">
                <span className="number-chip">03</span>
                <h2>原始剧情</h2>
              </div>
              <textarea
                className="list-editor"
                value={worldCard.originalPlot.join("\n")}
                onChange={(event) =>
                  onWorldCardChange({ ...worldCard, originalPlot: lines(event.target.value) })
                }
                aria-label="原始剧情，每行一条"
              />
            </div>
          </div>
        </div>

        <aside className="divergence-panel">
          <span className="panel-index">CHOOSE THE TURN</span>
          <h2>选择分歧点</h2>
          <p>这里以前有一个答案。接下来由你决定。</p>
          <div className="divergence-list">
            {candidates.map((candidate, index) => (
              <button
                type="button"
                key={candidate.id}
                className={`divergence-card ${selectedId === candidate.id ? "is-selected" : ""}`}
                onClick={() => onSelect(candidate.id)}
              >
                <span className="choice-number">0{index + 1}</span>
                <strong>{candidate.title}</strong>
                <em>{candidate.moment}</em>
                <small>{candidate.reason}</small>
              </button>
            ))}
          </div>
          <ErrorNotice message={error} />
          <LoadingButton
            className="primary-button wide-button"
            type="button"
            busy={Boolean(loading)}
            disabled={!selectedId}
            onClick={onStart}
          >
            {loading || "从这里走向另一条路"}
          </LoadingButton>
          <button className="text-button back-button" type="button" onClick={onBack}>
            返回修改原文
          </button>
        </aside>
      </div>
    </section>
  );
}
