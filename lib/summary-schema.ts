import { z } from "zod";

const shapeConfidenceSchema = z.enum(["stated", "inferred"]);
const paperTypeValues = [
  "method_system",
  "theory",
  "survey_review",
  "benchmark_dataset",
  "empirical_study",
  "position_argument",
  "case_study",
  "historical_descriptive",
  "other"
] as const;
const visualizationTypeValues = ["architecture", "concept_map", "benchmark_flow", "taxonomy", "argument_flow"] as const;
const viewModeValues = ["inference", "training", "full"] as const;
const graphNodeTypeValues = [
  "input",
  "encoder",
  "fusion",
  "latent",
  "planner",
  "decoder",
  "head",
  "environment",
  "memory",
  "loss",
  "output",
  "concept",
  "other"
] as const;

const figureFocusSchema = z.object({
  label: z.string(),
  title: z.string(),
  takeaway: z.string(),
  caption: z.string().default(""),
  imageUrl: z.string().optional(),
  whyThisFigure: z.string()
});

const detailSectionSchema = z.object({
  title: z.string(),
  body: z.string(),
  bullets: z.array(z.string()).default([])
});

const graphPortSchema = z.object({
  id: z.string(),
  label: z.string(),
  side: z.enum(["left", "right", "top", "bottom"]).default("left")
});

const graphNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(graphNodeTypeValues),
  description: z.string(),
  shape: z.string(),
  shapeConfidence: shapeConfidenceSchema,
  groupId: z.string().optional(),
  layer: z.number().int().nonnegative(),
  inputPorts: z.array(graphPortSchema).default([]),
  outputPorts: z.array(graphPortSchema).default([])
});

const graphEdgeSchema = z.object({
  fromNodeId: z.string(),
  fromPort: z.string().optional(),
  toNodeId: z.string(),
  toPort: z.string().optional(),
  tensorLabel: z.string(),
  shape: z.string(),
  shapeConfidence: shapeConfidenceSchema,
  semanticRole: z.string()
});

const graphGroupSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  layerStart: z.number().int().nonnegative(),
  layerEnd: z.number().int().nonnegative()
});

const graphPathSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  edgeSequence: z.array(z.number().int().nonnegative()).default([]),
  nodeSequence: z.array(z.string()).default([])
});

const graphShapeNoteSchema = z.object({
  target: z.string(),
  note: z.string()
});

const baseSummarySchema = z.object({
  title: z.string(),
  paperType: z.enum(paperTypeValues).default("method_system"),
  oneLiner: z.string(),
  narrativeSummary: z.string(),
  whyItMatters: z.string(),
  keyTakeaways: z.array(z.string()),
  figureStory: figureFocusSchema,
  visualization: z.object({
    type: z.enum(visualizationTypeValues).default("architecture"),
    title: z.string(),
    purpose: z.string(),
    viewMode: z.enum(viewModeValues).default("full"),
    graph: z.object({
      story: z.string(),
      nodes: z.array(graphNodeSchema),
      edges: z.array(graphEdgeSchema),
      groups: z.array(graphGroupSchema).default([]),
      paths: z.array(graphPathSchema).default([]),
      shapeNotes: z.array(graphShapeNoteSchema).default([])
    })
  }),
  intuition: z.array(detailSectionSchema),
  relatedConcepts: z.array(
    z.object({
      label: z.string(),
      whyItMatters: z.string(),
      paperReference: z.string().nullable().optional()
    })
  ),
  importantFigures: z.array(
    z.object({
      label: z.string(),
      title: z.string(),
      reason: z.string(),
      caption: z.string().default(""),
      imageUrl: z.string().optional()
    })
  ),
  detailSections: z.array(detailSectionSchema),
  limitations: z.array(z.string())
});

const legacySummarySchema = z.object({
  title: z.string(),
  oneLiner: z.string(),
  narrativeSummary: z.string(),
  whyItMatters: z.string(),
  keyTakeaways: z.array(z.string()),
  figureStory: figureFocusSchema,
  architecture: z.object({
    story: z.string(),
    nodes: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        summary: z.string(),
        inputShape: z.string(),
        outputShape: z.string(),
        shapeConfidence: shapeConfidenceSchema,
        kind: z.enum(["input", "encoder", "latent", "transition", "head", "output", "other"]).default("other")
      })
    ),
    edges: z.array(
      z.object({
        from: z.string(),
        to: z.string(),
        label: z.string().default("")
      })
    ),
    walkthrough: z.array(
      z.object({
        step: z.number(),
        label: z.string(),
        explanation: z.string(),
        inputShape: z.string(),
        outputShape: z.string(),
        shapeConfidence: shapeConfidenceSchema
      })
    )
  }),
  intuition: z.array(detailSectionSchema),
  relatedConcepts: z.array(
    z.object({
      label: z.string(),
      whyItMatters: z.string(),
      paperReference: z.string().nullable().optional()
    })
  ),
  importantFigures: z.array(
    z.object({
      label: z.string(),
      title: z.string(),
      reason: z.string(),
      caption: z.string().default(""),
      imageUrl: z.string().optional()
    })
  ),
  detailSections: z.array(detailSectionSchema),
  limitations: z.array(z.string())
});

function normalizeVisualizationGraph(visualization: z.infer<typeof baseSummarySchema>["visualization"]) {
  const nodesById = new Map(visualization.graph.nodes.map((node) => [node.id, node]));
  const minLayer = Math.min(...visualization.graph.nodes.map((node) => node.layer));
  const rootNodeIds = new Set(
    visualization.graph.nodes
      .filter((node) => node.layer === minLayer)
      .map((node) => node.id)
  );

  const keptEdgeIndexMap = new Map<number, number>();
  const normalizedEdges = visualization.graph.edges.flatMap((edge, originalIndex) => {
    const fromNode = nodesById.get(edge.fromNodeId);
    const toNode = nodesById.get(edge.toNodeId);

    if (!fromNode || !toNode) {
      return [];
    }

    if (rootNodeIds.has(edge.toNodeId)) {
      return [];
    }

    keptEdgeIndexMap.set(originalIndex, keptEdgeIndexMap.size);
    return [edge];
  });

  const survivingNodeIds = new Set<string>();
  normalizedEdges.forEach((edge) => {
    survivingNodeIds.add(edge.fromNodeId);
    survivingNodeIds.add(edge.toNodeId);
  });
  visualization.graph.nodes.forEach((node) => {
    if (node.layer === minLayer) {
      survivingNodeIds.add(node.id);
    }
  });

  const normalizedPaths = visualization.graph.paths
    .map((path) => {
      const survivingEdgeIndices = path.edgeSequence
        .map((edgeIndex) => keptEdgeIndexMap.get(edgeIndex))
        .filter((edgeIndex): edgeIndex is number => edgeIndex !== undefined);
      const survivingNodeSequence = path.nodeSequence.filter((nodeId) => survivingNodeIds.has(nodeId));

      return {
        ...path,
        edgeSequence: survivingEdgeIndices,
        nodeSequence: survivingNodeSequence
      };
    })
    .filter((path) => path.nodeSequence.length > 0);

  return {
    ...visualization,
    graph: {
      ...visualization.graph,
      edges: normalizedEdges,
      paths: normalizedPaths
    }
  };
}

function mapLegacyKindToGraphNodeType(kind: "input" | "encoder" | "latent" | "transition" | "head" | "output" | "other"): typeof graphNodeTypeValues[number] {
  if (kind === "transition") {
    return "planner";
  }

  if (kind === "latent") {
    return "latent";
  }

  if (kind === "head") {
    return "head";
  }

  if (kind === "output") {
    return "output";
  }

  if (kind === "encoder") {
    return "encoder";
  }

  if (kind === "input") {
    return "input";
  }

  return "other";
}

export const paperSummarySchema = z.union([baseSummarySchema, legacySummarySchema]).transform((payload) => {
  if ("visualization" in payload) {
    return {
      ...payload,
      visualization: normalizeVisualizationGraph(payload.visualization),
      relatedConcepts: payload.relatedConcepts.map((concept) => ({
        ...concept,
        paperReference: concept.paperReference ?? undefined
      }))
    };
  }

  return {
    title: payload.title,
    paperType: "method_system" as const,
    oneLiner: payload.oneLiner,
    narrativeSummary: payload.narrativeSummary,
    whyItMatters: payload.whyItMatters,
    keyTakeaways: payload.keyTakeaways,
    figureStory: payload.figureStory,
    visualization: normalizeVisualizationGraph({
      type: "architecture" as const,
      title: "System graph",
      purpose: "Converted from an earlier linear summary into the current graph-based visualization contract.",
      viewMode: "full" as const,
      graph: {
        story: payload.architecture.story,
        nodes: payload.architecture.nodes.map((node, index) => ({
          id: node.id,
          label: node.label,
          type: mapLegacyKindToGraphNodeType(node.kind),
          description: node.summary,
          shape: node.outputShape || node.inputShape,
          shapeConfidence: node.shapeConfidence,
          groupId: undefined,
          layer: index,
          inputPorts: [{ id: `${node.id}-in`, label: "input", side: "left" as const }],
          outputPorts: [{ id: `${node.id}-out`, label: "output", side: "right" as const }]
        })),
        edges: payload.architecture.edges.map((edge, index) => {
          const target = payload.architecture.nodes.find((node) => node.id === edge.to);
          return {
            fromNodeId: edge.from,
            fromPort: `${edge.from}-out`,
            toNodeId: edge.to,
            toPort: `${edge.to}-in`,
            tensorLabel: edge.label || `flow ${index + 1}`,
            shape: target?.inputShape ?? "(B, D)",
            shapeConfidence: target?.shapeConfidence ?? "inferred",
            semanticRole: edge.label || "data flow"
          };
        }),
        groups: [],
        paths: [
          {
            id: "legacy-main-path",
            label: "Main path",
            description: "Converted from the legacy sequential architecture summary.",
            edgeSequence: payload.architecture.edges.map((_, index) => index),
            nodeSequence: payload.architecture.nodes.map((node) => node.id)
          }
        ],
        shapeNotes: [
          {
            target: "graph",
            note: "This graph was converted from an older summary format and may still be more sequential than a fresh re-summarization."
          }
        ]
      }
    }),
    intuition: payload.intuition,
    relatedConcepts: payload.relatedConcepts.map((concept) => ({
      ...concept,
      paperReference: concept.paperReference ?? undefined
    })),
    importantFigures: payload.importantFigures,
    detailSections: payload.detailSections,
    limitations: payload.limitations
  };
});

export type PaperSummaryPayload = z.infer<typeof baseSummarySchema>;
