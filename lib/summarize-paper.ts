import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { getOpenAIModel } from "@/lib/openai-config";
import { loadPaperAgentPrompt } from "@/lib/prompts";
import { hashString, sanitizeJsonValue, sanitizeText, truncate } from "@/lib/utils";
import { paperSummarySchema, type PaperSummaryPayload } from "@/lib/summary-schema";
import { embedText, projectEmbedding } from "@/lib/embedding";
import { ensureLocalPdf, extractFiguresFromPdf, mergeFigureData } from "@/lib/figure-extraction";
import { pickArchitectureFigure, prioritizeFigures } from "@/lib/figure-ranking";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function guessShape(label: string, description: string, index: number) {
  const text = `${label} ${description}`.toLowerCase();

  if (text.includes("image") || text.includes("vision") || text.includes("frame")) {
    return {
      input: index === 0 ? "(B, H, W, C)" : "(B, N, D)",
      output: "(B, N, D)"
    };
  }

  if (text.includes("language") || text.includes("token")) {
    return {
      input: "(B, T)",
      output: "(B, T, D)"
    };
  }

  if (text.includes("state")) {
    return {
      input: "state vector s in R^d",
      output: "(B, D)"
    };
  }

  if (text.includes("latent") || text.includes("embedding")) {
    return {
      input: "(B, D)",
      output: "(B, M)"
    };
  }

  if (text.includes("reward") || text.includes("value") || text.includes("head")) {
    return {
      input: "(B, M)",
      output: "(B, 1)"
    };
  }

  if (text.includes("action") || text.includes("policy")) {
    return {
      input: "(B, M)",
      output: "action logits / distribution over |A|"
    };
  }

  return {
    input: index === 0 ? "paper inputs in batched form (B, ...)" : "(B, D)",
    output: "(B, D')"
  };
}

function collectPaperText(input: {
  title: string;
  abstract: string | null;
  sections: { heading: string | null; content: string }[];
  references?: { title: string | null; rawText: string }[];
}) {
  return [
    input.title,
    input.abstract ?? "",
    ...input.sections.map((section) => `${section.heading ?? ""} ${section.content}`),
    ...(input.references?.map((reference) => `${reference.title ?? ""} ${reference.rawText}`) ?? [])
  ]
    .join("\n")
    .toLowerCase();
}

function classifyPaperType(input: {
  title: string;
  abstract: string | null;
  sections: { heading: string | null; content: string }[];
  references: { title: string | null; rawText: string }[];
}): PaperSummaryPayload["paperType"] {
  const text = collectPaperText(input);

  if (/(survey|review|taxonomy|meta-analysis|systematic review|scoping review|literature review|overview of)/i.test(text)) {
    return "survey_review";
  }

  if (/(theorem|lemma|proof|proposition|corollary|we prove|assume that|convergence|bound)/i.test(text)) {
    return "theory";
  }

  if (/(benchmark|dataset|task suite|leaderboard|evaluation protocol|baseline|metrics|corpus)/i.test(text)) {
    return "benchmark_dataset";
  }

  if (/(participants|subjects|cohort|questionnaire|interview|observational study|clinical|trial|randomized)/i.test(text)) {
    return "empirical_study";
  }

  if (/(position paper|perspective|commentary|opinion|we argue|policy implications|ethical implications)/i.test(text)) {
    return "position_argument";
  }

  if (/(case study|case report|field deployment|real-world deployment)/i.test(text)) {
    return "case_study";
  }

  if (/(historical|chronology|timeline|retrospective|history of|archival)/i.test(text)) {
    return "historical_descriptive";
  }

  if (/(architecture|model|network|framework|pipeline|encoder|decoder|algorithm|training|inference|system)/i.test(text)) {
    return "method_system";
  }

  return "other";
}

function visualizationTypeForPaperType(paperType: PaperSummaryPayload["paperType"]): PaperSummaryPayload["visualization"]["type"] {
  switch (paperType) {
    case "method_system":
      return "architecture";
    case "survey_review":
      return "taxonomy";
    case "benchmark_dataset":
      return "benchmark_flow";
    case "theory":
    case "position_argument":
    case "empirical_study":
      return "argument_flow";
    default:
      return "concept_map";
  }
}

function buildFallbackGraph(input: {
  sections: { heading: string | null; content: string }[];
  abstract: string | null;
}) {
  const sectionSteps = input.sections.slice(0, 5);
  const hasLanguage = /language|instruction|text|token/i.test(`${input.abstract ?? ""} ${sectionSteps.map((item) => item.content).join(" ")}`);
  const hasVision = /image|vision|rgb|frame|pixel/i.test(`${input.abstract ?? ""} ${sectionSteps.map((item) => item.content).join(" ")}`);
  const hasState = /state|observation|sensor/i.test(`${input.abstract ?? ""} ${sectionSteps.map((item) => item.content).join(" ")}`);

  const nodes: PaperSummaryPayload["visualization"]["graph"]["nodes"] = [];
  const edges: PaperSummaryPayload["visualization"]["graph"]["edges"] = [];
  const groups: PaperSummaryPayload["visualization"]["graph"]["groups"] = [];

  if (hasVision) {
    nodes.push({
      id: "vision-input",
      label: "Visual observations",
      type: "input",
      description: "Image or frame observations entering the model.",
      shape: "(B, T, H, W, C)",
      shapeConfidence: "inferred",
      groupId: "inputs",
      layer: 0,
      inputPorts: [],
      outputPorts: [{ id: "vision-out", label: "images", side: "right" }]
    });
  }

  if (hasLanguage) {
    nodes.push({
      id: "language-input",
      label: "Task language",
      type: "input",
      description: "Instructions, prompts, or textual task context.",
      shape: "(B, T_txt)",
      shapeConfidence: "inferred",
      groupId: "inputs",
      layer: 0,
      inputPorts: [],
      outputPorts: [{ id: "language-out", label: "tokens", side: "right" }]
    });
  }

  if (hasState || !nodes.length) {
    nodes.push({
      id: "state-input",
      label: "State / task config",
      type: "input",
      description: "Low-dimensional state, scenario configuration, or raw structured observation.",
      shape: "(B, d_state)",
      shapeConfidence: "inferred",
      groupId: "inputs",
      layer: 0,
      inputPorts: [],
      outputPorts: [{ id: "state-out", label: "state", side: "right" }]
    });
  }

  const coreSection = sectionSteps[0];
  const coreGuess = guessShape(coreSection?.heading ?? "Core model", coreSection?.content ?? input.abstract ?? "", 1);
  nodes.push({
    id: "core-model",
    label: coreSection?.heading ?? "Core model",
    type: "fusion",
    description: truncate(coreSection?.content ?? input.abstract ?? "Central model block combining the paper's main inputs.", 180),
    shape: coreGuess.output,
    shapeConfidence: "inferred",
    groupId: "core",
    layer: 1,
    inputPorts: [
      { id: "core-in-1", label: "input stream 1", side: "left" },
      { id: "core-in-2", label: "input stream 2", side: "left" }
    ],
    outputPorts: [{ id: "core-out", label: "latent", side: "right" }]
  });

  const headSection = sectionSteps[1];
  const headGuess = guessShape(headSection?.heading ?? "Prediction head", headSection?.content ?? "", 2);
  nodes.push({
    id: "prediction-head",
    label: headSection?.heading ?? "Prediction / control head",
    type: "head",
    description: truncate(
      headSection?.content ?? "Produces the paper's main prediction, control signal, or output distribution from the shared latent state.",
      180
    ),
    shape: headGuess.output,
    shapeConfidence: "inferred",
    groupId: "outputs",
    layer: 2,
    inputPorts: [{ id: "head-in", label: "latent", side: "left" }],
    outputPorts: [{ id: "head-out", label: "output", side: "right" }]
  });

  nodes.forEach((node) => {
    if (node.layer === 0) {
      edges.push({
        fromNodeId: node.id,
        fromPort: node.outputPorts[0]?.id,
        toNodeId: "core-model",
        toPort: "core-in-1",
        tensorLabel: node.outputPorts[0]?.label ?? "input",
        shape: node.shape,
        shapeConfidence: node.shapeConfidence,
        semanticRole: "input stream"
      });
    }
  });

  edges.push({
    fromNodeId: "core-model",
    fromPort: "core-out",
    toNodeId: "prediction-head",
    toPort: "head-in",
    tensorLabel: "latent representation",
    shape: coreGuess.output,
    shapeConfidence: "inferred",
    semanticRole: "shared latent state"
  });

  groups.push(
    {
      id: "inputs",
      label: "Inputs",
      description: "Observed inputs and task context entering the model.",
      layerStart: 0,
      layerEnd: 0
    },
    {
      id: "core",
      label: "Core model",
      description: "The main fusion or latent-dynamics system described by the paper.",
      layerStart: 1,
      layerEnd: 1
    },
    {
      id: "outputs",
      label: "Outputs",
      description: "Prediction or control heads consuming the learned representation.",
      layerStart: 2,
      layerEnd: 2
    }
  );

  return {
    story:
      "Read the paper as a directed graph rather than a single chain: multiple input streams feed the core model, which forms a shared internal representation and then routes that representation into the output head.",
    nodes,
    edges,
    groups,
    paths: [
      {
        id: "main-path",
        label: "Main execution path",
        description: "Primary route from inputs through the core model to the final output head.",
        edgeSequence: edges.map((_, index) => index),
        nodeSequence: nodes.map((node) => node.id)
      }
    ],
    shapeNotes: [
      {
        target: "graph",
        note: "Fallback mode uses symbolic dimensions inferred from section headings and abstract cues, not exact layer specs from the paper."
      }
    ]
  };
}

function buildConceptualFallbackGraph(input: {
  paperType: Exclude<PaperSummaryPayload["paperType"], "method_system">;
  sections: { heading: string | null; content: string }[];
}) {
  const sections = input.sections.slice(0, 6);
  const nodes: PaperSummaryPayload["visualization"]["graph"]["nodes"] = [];
  const edges: PaperSummaryPayload["visualization"]["graph"]["edges"] = [];

  const labelsByType = {
    survey_review: ["Scope", "Taxonomy", "Comparisons", "Open problems"],
    benchmark_dataset: ["Setup", "Evaluation", "Results", "Takeaways"],
    theory: ["Assumptions", "Argument", "Claims", "Implications"],
    empirical_study: ["Question", "Method", "Findings", "Interpretation"],
    position_argument: ["Premise", "Argument", "Claims", "Implications"],
    case_study: ["Context", "Case", "Analysis", "Implications"],
    historical_descriptive: ["Context", "Events", "Analysis", "Implications"],
    other: ["Context", "Core ideas", "Evidence", "Implications"]
  } as const;

  const layerLabels = labelsByType[input.paperType];

  sections.forEach((section, index) => {
    const layer = Math.min(index, layerLabels.length - 1);
    const nodeId = `section-${index + 1}`;
    nodes.push({
      id: nodeId,
      label: section.heading ?? layerLabels[layer],
      type: "concept",
      description: truncate(section.content, 180),
      shape:
        input.paperType === "benchmark_dataset"
          ? "artifact -> metric -> result"
          : input.paperType === "theory"
            ? "assumption -> claim"
            : "conceptual unit",
      shapeConfidence: "inferred",
      groupId: `group-${layer + 1}`,
      layer,
      inputPorts: [{ id: `${nodeId}-in`, label: "incoming", side: "left" }],
      outputPorts: [{ id: `${nodeId}-out`, label: "outgoing", side: "right" }]
    });

    if (index > 0) {
      const previous = `section-${index}`;
      edges.push({
        fromNodeId: previous,
        fromPort: `${previous}-out`,
        toNodeId: nodeId,
        toPort: `${nodeId}-in`,
        tensorLabel:
          input.paperType === "survey_review"
            ? "theme transition"
            : input.paperType === "benchmark_dataset"
              ? "evaluation flow"
              : input.paperType === "theory"
                ? "logical dependency"
                : "idea flow",
        shape:
          input.paperType === "benchmark_dataset"
            ? "setup -> metric -> result"
            : input.paperType === "theory"
              ? "premise -> claim"
              : "concept -> concept",
        shapeConfidence: "inferred",
        semanticRole: "narrative progression"
      });
    }
  });

  return {
    story:
      input.paperType === "survey_review"
        ? "This paper is best read as a map of categories, comparisons, and gaps rather than a model architecture."
        : input.paperType === "benchmark_dataset"
          ? "This paper is best understood as an evaluation flow showing what is tested, how it is measured, and what the results imply."
          : input.paperType === "theory"
            ? "This paper is structured around assumptions, supporting arguments, and claims rather than a system pipeline."
            : "This paper is better read as connected concepts and arguments than as a computational architecture.",
    nodes,
    edges,
    groups: layerLabels.map((label, index) => ({
      id: `group-${index + 1}`,
      label,
      description: `${label} stage in the paper's structure.`,
      layerStart: index,
      layerEnd: index
    })),
    paths: [
      {
        id: "main-path",
        label:
          input.paperType === "survey_review"
            ? "Taxonomy route"
            : input.paperType === "benchmark_dataset"
              ? "Evaluation route"
              : input.paperType === "theory"
                ? "Claim route"
                : "Main path",
        description: "Follows the paper's main intellectual progression from setup or premise to conclusion.",
        edgeSequence: edges.map((_, index) => index),
        nodeSequence: nodes.map((node) => node.id)
      }
    ],
    shapeNotes: [
      {
        target: "graph",
        note: "This visualization is conceptual rather than tensor-based because this paper type is not primarily a model architecture paper."
      }
    ]
  };
}

function buildFallbackInferenceVisualization(graph: PaperSummaryPayload["visualization"]["graph"]) {
  const inferenceEdgeIndices = graph.edges
    .map((edge, index) => ({ edge, index }))
    .filter(({ edge }) => !/loss|update|gradient|objective/i.test(`${edge.tensorLabel} ${edge.semanticRole}`))
    .map(({ index }) => index);

  const inferenceNodeIds = new Set<string>();
  inferenceEdgeIndices.forEach((index) => {
    const edge = graph.edges[index];
    inferenceNodeIds.add(edge.fromNodeId);
    inferenceNodeIds.add(edge.toNodeId);
  });

  const nodes = graph.nodes.filter((node) => inferenceNodeIds.has(node.id) || node.layer === 0);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = graph.edges.filter((edge, index) => inferenceEdgeIndices.includes(index) && nodeIds.has(edge.fromNodeId) && nodeIds.has(edge.toNodeId));

  const paths = [
    {
      id: "inference-path",
      label: "Main inference",
      description: "Follows the forward pass used at test time or during planning.",
      edgeSequence: edges.map((_, index) => index),
      nodeSequence: nodes.map((node) => node.id)
    }
  ];

  return {
    type: "architecture" as const,
    title: "Inference flow",
    purpose: "Shows only the forward-pass or planning path used during inference, with the most important shapes preserved.",
    viewMode: "inference" as const,
    graph: {
      story: "This graph isolates what happens when the trained model is actually used: inputs are encoded, transformed through the core model, and turned into predictions, actions, or decoded outputs.",
      nodes,
      edges,
      groups: graph.groups.filter((group) => nodes.some((node) => node.groupId === group.id)),
      paths,
      shapeNotes: [
        ...graph.shapeNotes,
        {
          target: "inference",
          note: "This view intentionally excludes training-only objectives and parameter-update steps."
        }
      ]
    }
  };
}

function buildFallbackSummary(input: {
  title: string;
  abstract: string | null;
  sections: { heading: string | null; content: string }[];
  figures: { label: string; caption: string | null; imageUrl?: string | null }[];
  references: { title: string | null; rawText: string }[];
}): PaperSummaryPayload {
  const prioritizedFigures = prioritizeFigures(input.figures);
  const primaryFigure = prioritizedFigures[0] ?? input.figures[0];
  const paperType = classifyPaperType(input);
  const visualizationType = visualizationTypeForPaperType(paperType);
  const fallbackGraph =
    paperType === "method_system"
      ? buildFallbackGraph(input)
      : buildConceptualFallbackGraph({
          paperType,
          sections: input.sections
        });

  return {
    title: input.title,
    paperType,
    oneLiner: truncate(input.abstract ?? "Interactive summary generated from the paper contents.", 160),
    narrativeSummary:
      input.abstract ??
      "This paper was parsed successfully, but no OpenAI key is configured so the app is using a local narrative fallback summary.",
    whyItMatters:
      paperType === "method_system"
        ? "This fallback summary highlights the paper's likely pipeline and context so the UI remains usable even without a model response."
        : paperType === "survey_review"
          ? "This fallback summary treats the paper as a structured map of themes, comparisons, and open questions instead of forcing a systems pipeline."
          : paperType === "benchmark_dataset"
            ? "This fallback summary emphasizes the benchmark setup, metrics, results, and practical takeaways rather than pretending the paper is a model architecture."
            : paperType === "theory"
              ? "This fallback summary focuses on assumptions, claims, and implications rather than inventing architecture that the paper does not contain."
              : "This fallback summary keeps the paper readable by using a concept-first structure instead of an ML-specific architecture view.",
    keyTakeaways: input.sections.slice(0, 4).map((section) => truncate(section.content, 120)),
    figureStory: {
      label: primaryFigure?.label ?? "Figure 1",
      title: primaryFigure?.label ?? "Key figure",
      takeaway: primaryFigure?.caption ?? "No figure caption was extracted, so the summary falls back to text evidence.",
      caption: primaryFigure?.caption ?? "",
      imageUrl: primaryFigure?.imageUrl ?? undefined,
      whyThisFigure: "This is the first figure mention extracted from the paper and is likely part of the core explanation."
    },
    visualization: {
      type: visualizationType,
      title:
        visualizationType === "architecture"
          ? "System graph"
          : visualizationType === "taxonomy"
            ? "Theme map"
            : visualizationType === "benchmark_flow"
              ? "Benchmark flow"
              : visualizationType === "argument_flow"
                ? "Argument map"
                : "Concept map",
      purpose:
        visualizationType === "architecture"
          ? "Shows how the paper's inputs, core model, and outputs connect in one place with symbolic shapes on each edge."
          : visualizationType === "taxonomy"
            ? "Organizes the paper as themes, comparisons, and gaps rather than a system pipeline."
            : visualizationType === "benchmark_flow"
              ? "Shows the setup, evaluation protocol, results, and takeaways in one connected view."
              : visualizationType === "argument_flow"
                ? "Shows how premises, evidence, and claims connect across the paper."
                : "Shows the main concepts and how they relate across the paper.",
      viewMode: "full",
      graph: fallbackGraph
    },
    trainingExplainer:
      paperType === "method_system"
        ? {
            title: "Training, intuitively",
            summary:
              "Training is repeated guess-and-correct: the model sees batches of paper-specific inputs, produces internal representations and predictions, measures how wrong those predictions are, and updates its parameters to reduce that error.",
            steps: [
              `Start with a batch of inputs such as ${fallbackGraph.nodes
                .filter((node) => node.type === "input")
                .map((node) => `${node.label} ${node.shape}`)
                .join("; ")}.`,
              `Encode or fuse those inputs into the shared internal state ${fallbackGraph.nodes.find((node) => node.id === "core-model")?.shape ?? "(B, D)"}.`,
              "Run the prediction head to produce the paper's task output for each example in the batch.",
              "Compare that output against the correct target for the task and turn the mismatch into a scalar loss.",
              "Backpropagate the loss through the whole model and update weights with gradient-based optimization."
            ],
            shapeWalkthrough: [
              `Inputs enter in batched form, for example ${fallbackGraph.nodes
                .filter((node) => node.type === "input")
                .map((node) => node.shape)
                .join(", ")}.`,
              `The core model produces a shared latent like ${fallbackGraph.nodes.find((node) => node.id === "core-model")?.shape ?? "(B, D)"}.`,
              `The final head maps that latent to task outputs like ${fallbackGraph.nodes.find((node) => node.id === "prediction-head")?.shape ?? "(B, D')"}.`
            ],
            lossAndOptimization: [
              "Loss means a single number that gets larger when the model's prediction is worse.",
              "If the exact objective is unknown in fallback mode, assume a task-appropriate loss such as cross-entropy for classification or mean squared error for regression/prediction.",
              "Optimization means taking the loss gradient with respect to the parameters and nudging the weights so the same batch would score better next time."
            ],
            workedExample: []
          }
        : undefined,
    inferenceExplainer:
      paperType === "method_system"
        ? {
            title: "Inference, intuitively",
            summary:
              "Inference is just the trained model being used: inputs go forward through the network once, the model produces a prediction or action, and the weights stay fixed.",
            steps: [
              "Take the current input available at test time and format it into the same kind of tensor structure used by the model.",
              "Run the encoder or input-processing stage to get features or latents.",
              "Pass those features through the core model to produce the internal state needed for the final decision.",
              "Use the output head to emit the prediction, decoded output, score, or action needed by the task.",
              "Do not compute gradients or update parameters during this pass."
            ],
            shapeWalkthrough: [
              `A single example usually looks like batch size 1, for example ${(fallbackGraph.nodes.find((node) => node.layer === 0)?.shape ?? "(B, ...)").replace("(B,", "(1,")}.`,
              `The encoder/core path produces an internal representation like ${(fallbackGraph.nodes.find((node) => node.id === "core-model")?.shape ?? "(B, D)").replace("(B,", "(1,")}.`,
              `The output head returns the final result in shape ${(fallbackGraph.nodes.find((node) => node.id === "prediction-head")?.shape ?? "(B, D')").replace("(B,", "(1,")}.`
            ],
            lossAndOptimization: [],
            workedExample: [
              `Example: if the input is a single item with batch size 1, the model maps it from input tensors to ${(fallbackGraph.nodes.find((node) => node.id === "core-model")?.shape ?? "(B, D)").replace("(B,", "(1,")} and then to ${(fallbackGraph.nodes.find((node) => node.id === "prediction-head")?.shape ?? "(B, D')").replace("(B,", "(1,")}.`,
              "The important intuition is that inference only runs the learned computation forward; it does not compare against a target or adjust any weights."
            ]
          }
        : {
            title: "Inference, intuitively",
            summary:
              "This paper is better understood as a stage-by-stage operating procedure: what comes in, what gets transformed, and what final result or claim comes out.",
            steps: [
              "Identify the starting input, premise, or evaluation setup.",
              "Follow the main processing or reasoning stages in order.",
              "Read the final output, claim, or measurement as the result of those stages."
            ],
            shapeWalkthrough: [],
            lossAndOptimization: [],
            workedExample: []
          },
    inferenceVisualization: paperType === "method_system"
      ? buildFallbackInferenceVisualization(fallbackGraph)
      : undefined,
    intuition: [
      {
        title: "What to keep in mind",
        body:
          paperType === "method_system"
            ? "Read the method as a sequence of representations rather than isolated sections."
            : "Read this paper according to its actual argument or evidence structure rather than forcing a model-architecture lens onto it.",
        bullets:
          paperType === "method_system"
            ? ["What enters the model?", "What latent state does it build?", "What prediction or control heads read that latent?"]
            : paperType === "survey_review"
              ? ["What categories organize the literature?", "What trade-offs separate those categories?", "What gaps or open problems remain?"]
              : paperType === "benchmark_dataset"
                ? ["What is being benchmarked?", "How is performance measured?", "Which results matter for practice?"]
                : paperType === "theory"
                  ? ["What assumptions does the paper start from?", "What claim is actually proven?", "Where is the result likely to be narrow or fragile?"]
                  : ["What question is the paper asking?", "What evidence supports the claims?", "What practical implication should the reader take away?"]
      }
    ],
    relatedConcepts: input.references.slice(0, 3).map((reference) => ({
      label: reference.title ?? "Referenced method",
      whyItMatters: truncate(reference.rawText, 160)
    })),
    importantFigures: prioritizedFigures.slice(0, 4).map((figure) => ({
      label: figure.label,
      title: figure.label,
      reason: figure.caption ?? "Mentioned as an important figure in the paper.",
      caption: figure.caption ?? "",
      imageUrl: figure.imageUrl ?? undefined
    })),
    detailSections: [
      {
        title:
          paperType === "method_system"
            ? "Core method"
            : paperType === "survey_review"
              ? "Theme map"
              : paperType === "benchmark_dataset"
                ? "Benchmark structure"
                : paperType === "theory"
                  ? "Claim structure"
                  : "Core structure",
        body:
          paperType === "method_system"
            ? "This fallback mode reconstructs a plausible end-to-end story from the extracted sections."
            : "This fallback mode reconstructs the paper's main structure from extracted sections without forcing an ML architecture summary.",
        bullets: fallbackGraph.nodes.map((node) => `${node.label}: ${node.description}`)
      },
      {
        title: "Useful references",
        body: "These references are likely prerequisites or inherited ideas for the paper.",
        bullets: input.references.slice(0, 3).map((reference) => reference.title ?? truncate(reference.rawText, 100))
      }
    ],
    limitations: [
      "This summary is using local heuristics rather than the OpenAI summarization prompt.",
      visualizationType === "architecture"
        ? "The architecture and shape walkthrough are heuristic in fallback mode."
        : "The conceptual visualization is heuristic in fallback mode and may simplify the paper's true structure."
    ]
  };
}

async function plannerPass(context: string) {
  if (!openai) {
    return {
      figures: [],
      citations: []
    };
  }

  const response = await openai.chat.completions.create({
    model: getOpenAIModel("planner"),
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "Select the single most explanatory figure and the most relevant references for understanding a paper."
      },
      {
        role: "user",
        content: `Return JSON with keys "figures" and "citations". Prefer 1-3 entries each.\n\n${context}`
      }
    ]
  });

  const content = response.choices[0]?.message.content ?? "{\"figures\":[],\"citations\":[]}";
  const parsed = JSON.parse(content) as {
    figures?: string[];
    citations?: string[];
  };

  return {
    figures: parsed.figures ?? [],
    citations: parsed.citations ?? []
  };
}

export async function summarizePaper(paperId: string) {
  let paper = await prisma.paper.findUnique({
    where: { id: paperId },
    include: {
      sections: {
        orderBy: {
          orderIndex: "asc"
        }
      },
      figures: true,
      references: true
    }
  });

  if (!paper) {
    throw new Error("Paper not found.");
  }

  if (paper.pdfUrl && paper.figures.some((figure) => !figure.imageUrl)) {
    const extractedFigures = await extractFiguresFromPdf(paperId, await ensureLocalPdf(paperId, paper.pdfUrl));
    const mergedFigures = mergeFigureData(
      extractedFigures,
      paper.figures.map((figure) => ({
        label: figure.label,
        caption: figure.caption,
        imageUrl: figure.imageUrl,
        page: figure.page
      }))
    );

    if (mergedFigures.some((figure) => figure.imageUrl)) {
      await prisma.$transaction([
        prisma.paperFigure.deleteMany({
          where: {
            paperId
          }
        }),
        prisma.paper.update({
          where: { id: paperId },
          data: {
            figures: {
              createMany: {
                data: mergedFigures
              }
            }
          }
        })
      ]);

      paper = await prisma.paper.findUnique({
        where: { id: paperId },
        include: {
          sections: {
            orderBy: {
              orderIndex: "asc"
            }
          },
          figures: true,
          references: true
        }
      });

      if (!paper) {
        throw new Error("Paper not found after figure refresh.");
      }
    }
  }

  await prisma.paper.update({
    where: { id: paperId },
    data: {
      summaryStatus: "PROCESSING",
      summaryError: null
    }
  });

  try {
    const prompt = await loadPaperAgentPrompt();
    const plannerInput = [
      `Title: ${paper.title}`,
      `Abstract: ${paper.abstract ?? "N/A"}`,
      `Figures available: ${paper.figures.map((figure) => `${figure.label} - ${figure.caption ?? "No caption"}`).join("; ") || "None"}`,
      `References available: ${paper.references.map((reference) => `${reference.citeKey ?? ""} ${reference.title ?? reference.rawText}`).join("; ") || "None"}`
    ].join("\n");

    const plan = await plannerPass(plannerInput);
    const architectureFigure = pickArchitectureFigure(
      paper.figures.map((figure) => ({
        label: figure.label,
        caption: figure.caption,
        imageUrl: figure.imageUrl
      }))
    );
    const selectedFigures = prioritizeFigures(
      paper.figures.filter(
        (figure) => plan.figures.includes(figure.label) || figure.label === architectureFigure?.label
      )
    ).slice(0, 5);
    const selectedReferences = paper.references
      .filter((reference) => plan.citations.includes(reference.citeKey ?? "") || plan.citations.includes(reference.title ?? ""))
      .slice(0, 4);

    let summaryPayload: PaperSummaryPayload;

    if (!openai) {
      summaryPayload = buildFallbackSummary(paper);
    } else {
      const response = await openai.chat.completions.create({
        model: getOpenAIModel("summary"),
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: prompt
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                paper: {
                  title: paper.title,
                  abstract: paper.abstract,
                  sections: paper.sections.slice(0, 12),
                  figures: (selectedFigures.length ? selectedFigures : prioritizeFigures(paper.figures).slice(0, 5)).map((figure) => ({
                    label: figure.label,
                    caption: figure.caption,
                    imageUrl: figure.imageUrl
                  })),
                  architectureFigureLabel: architectureFigure?.label ?? null,
                  references: selectedReferences.length ? selectedReferences : paper.references.slice(0, 6),
                  rawTextExcerpt: paper.rawText?.slice(0, 22000)
                }
              },
              null,
              2
            )
          }
        ]
      });

      const content = response.choices[0]?.message.content;

      if (!content) {
        throw new Error("The model returned an empty summary.");
      }

      summaryPayload = sanitizeJsonValue(paperSummarySchema.parse(JSON.parse(content)));
    }

    summaryPayload = sanitizeJsonValue(summaryPayload);

    const vector = await embedText(
      `${paper.title}\n${summaryPayload.oneLiner}\n${summaryPayload.narrativeSummary}\n${summaryPayload.keyTakeaways.join("\n")}`
    );
    const projection = projectEmbedding(vector);
    const promptHash = hashString(prompt);

    await prisma.$transaction([
      prisma.paper.update({
        where: { id: paperId },
        data: {
          summaryStatus: "READY",
          summaryVersion: { increment: 1 },
          summaryData: summaryPayload,
          embedding2d: projection
        }
      }),
      prisma.paperSummary.create({
        data: {
          paperId,
          version: paper.summaryVersion + 1,
          model: openai ? getOpenAIModel("summary") : "local-fallback",
          promptHash,
          content: summaryPayload
        }
      }),
      prisma.embedding.create({
        data: {
          userId: paper.userId,
          paperId,
          kind: "SUMMARY",
          sourceId: paperId,
          vector,
          projection2d: projection
        }
      })
    ]);

    return summaryPayload;
  } catch (error) {
    const message = sanitizeText(error instanceof Error ? error.message : "Failed to summarize paper.");

    await prisma.paper.update({
      where: { id: paperId },
      data: {
        summaryStatus: "FAILED",
        summaryError: message
      }
    });

    throw error;
  }
}
