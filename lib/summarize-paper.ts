import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { loadPaperAgentPrompt } from "@/lib/prompts";
import { hashString, truncate } from "@/lib/utils";
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

function buildFallbackSummary(input: {
  title: string;
  abstract: string | null;
  sections: { heading: string | null; content: string }[];
  figures: { label: string; caption: string | null; imageUrl?: string | null }[];
  references: { title: string | null; rawText: string }[];
}): PaperSummaryPayload {
  const prioritizedFigures = prioritizeFigures(input.figures);
  const primaryFigure = prioritizedFigures[0] ?? input.figures[0];
  const fallbackGraph = buildFallbackGraph(input);

  return {
    title: input.title,
    oneLiner: truncate(input.abstract ?? "Interactive summary generated from the paper contents.", 160),
    narrativeSummary:
      input.abstract ??
      "This paper was parsed successfully, but no OpenAI key is configured so the app is using a local narrative fallback summary.",
    whyItMatters:
      "This fallback summary highlights the paper's likely pipeline and context so the UI remains usable even without a model response.",
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
      type: "architecture",
      title: "System graph",
      purpose: "Shows how the paper's inputs, core model, and outputs connect in one place with symbolic shapes on each edge.",
      viewMode: "full",
      graph: fallbackGraph
    },
    intuition: [
      {
        title: "What to keep in mind",
        body: "Read the method as a sequence of representations rather than isolated sections.",
        bullets: [
          "What enters the model?",
          "What latent state does it build?",
          "What prediction or control heads read that latent?"
        ]
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
        title: "Core method",
        body: "This fallback mode reconstructs a plausible end-to-end story from the extracted sections.",
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
      "The architecture and shape walkthrough are heuristic in fallback mode."
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
    model: "gpt-4.1-mini",
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
        model: "gpt-4.1",
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

      summaryPayload = paperSummarySchema.parse(JSON.parse(content));
    }

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
          model: openai ? "gpt-4.1" : "local-fallback",
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
    const message = error instanceof Error ? error.message : "Failed to summarize paper.";

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
