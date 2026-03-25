type FigureLike = {
  label: string;
  caption: string | null;
  imageUrl?: string | null;
};

const ARCHITECTURE_KEYWORDS = [
  "architecture",
  "overview",
  "method",
  "framework",
  "pipeline",
  "diagram",
  "system",
  "model",
  "approach",
  "workflow"
];

const RESULT_KEYWORDS = [
  "ablation",
  "benchmark",
  "result",
  "score",
  "returns",
  "performance",
  "comparison",
  "curve",
  "accuracy",
  "evaluation"
];

function scoreKeywordHits(text: string, keywords: string[], weight: number) {
  return keywords.reduce((total, keyword) => total + (text.includes(keyword) ? weight : 0), 0);
}

export function scoreArchitectureFigure(figure: FigureLike) {
  const text = `${figure.label} ${figure.caption ?? ""}`.toLowerCase();
  let score = 0;

  score += scoreKeywordHits(text, ARCHITECTURE_KEYWORDS, 12);
  score -= scoreKeywordHits(text, RESULT_KEYWORDS, 8);

  if (figure.imageUrl) {
    score += 10;
  }

  if (figure.label.toLowerCase().includes("figure 1")) {
    score += 6;
  }

  if (text.includes("overall")) {
    score += 5;
  }

  if (text.includes("task") || text.includes("dataset")) {
    score -= 2;
  }

  return score;
}

export function pickArchitectureFigure<T extends FigureLike>(figures: T[]) {
  return [...figures]
    .sort((left, right) => scoreArchitectureFigure(right) - scoreArchitectureFigure(left))
    .find((figure) => scoreArchitectureFigure(figure) > 0);
}

export function prioritizeFigures<T extends FigureLike>(figures: T[]) {
  return [...figures].sort((left, right) => scoreArchitectureFigure(right) - scoreArchitectureFigure(left));
}
