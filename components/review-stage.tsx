import { useState } from "react";
import type { StoryReview } from "@/lib/domain";

export function ReviewStage({
  review,
  canContinue,
  onContinue,
  onStartOver,
}: {
  review: StoryReview;
  canContinue: boolean;
  onContinue: () => void;
  onStartOver: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyMarkdown() {
    await navigator.clipboard.writeText(review.markdown);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="review-stage">
      <div className="review-hero">
        <span className="kicker">04 / NEW TIMELINE</span>
        <p>{review.choices.length} 个选择以后，这是当前路线的阶段回顾。</p>
        <h1>{review.title}</h1>
        <div className="review-actions">
          {canContinue ? (
            <button className="primary-button" type="button" onClick={onContinue}>
              继续这条故事线
            </button>
          ) : null}
          <button className="secondary-button" type="button" onClick={copyMarkdown}>
            {copied ? "已复制 Markdown" : "复制 Markdown"}
          </button>
          <button className="secondary-button" type="button" onClick={onStartOver}>
            推演另一段故事
          </button>
        </div>
      </div>

      <div className="review-grid">
        <article className="review-summary">
          <span className="panel-index">SYNOPSIS</span>
          <h2>阶段剧情梗概</h2>
          <p>{review.synopsis}</p>
        </article>

        <article className="timeline-panel">
          <span className="panel-index">DECISIONS</span>
          <h2>{review.choices.length} 次关键选择</h2>
          <ol className="review-timeline">
            {review.choices.map((choice) => (
              <li key={choice.round}>
                <span>{String(choice.round).padStart(2, "0")}</span>
                <div>
                  <strong>{choice.action}</strong>
                  <p>{choice.result}</p>
                </div>
              </li>
            ))}
          </ol>
        </article>

        {review.ending ? (
          <article className="ending-panel">
            <span className="panel-index">ROUTE ENDING</span>
            <h2>按当前选择续写的故事结局</h2>
            <h3>{review.ending.title}</h3>
            <p className="ending-scene">{review.ending.scene}</p>
            <h4>这些选择如何抵达结局</h4>
            <ol className="ending-payoff-list">
              {review.ending.choicePayoffs.map((payoff) => (
                <li key={payoff.round}>
                  <span>{String(payoff.round).padStart(2, "0")}</span>
                  <div>
                    <strong>{payoff.action}</strong>
                    <p>{payoff.payoff}</p>
                  </div>
                </li>
              ))}
            </ol>
          </article>
        ) : null}

        <ReviewList title="偏离原始剧情" eyebrow="DIFFERENCES" items={review.differences} />
        <ReviewList title="人物与关系变化" eyebrow="CHARACTERS" items={review.characterChanges} />
        <ReviewList title="仍未解决的冲突" eyebrow="OPEN THREADS" items={review.unresolvedConflicts} />
        <ReviewList title="始终遵守的事实" eyebrow="PRESERVED FACTS" items={review.preservedFacts} />
      </div>
    </section>
  );
}

function ReviewList({
  title,
  eyebrow,
  items,
}: {
  title: string;
  eyebrow: string;
  items: string[];
}) {
  return (
    <article className="review-list-card">
      <span className="panel-index">{eyebrow}</span>
      <h2>{title}</h2>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>这一条剧情线暂时没有留下未解决项。</p>
      )}
    </article>
  );
}
