"use client";

import { Expand, Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PaperSummaryPayload } from "@/lib/summary-schema";

type Visualization = PaperSummaryPayload["visualization"];
type GraphNode = Visualization["graph"]["nodes"][number];
type GraphPath = Visualization["graph"]["paths"][number];
type PortSide = GraphNode["inputPorts"][number]["side"];

function nodeTypeLabel(type: GraphNode["type"]) {
  return type.replace("_", " ");
}

function estimateNodeHeight(node: GraphNode, compact: boolean) {
  const labelLines = Math.ceil(node.label.length / (compact ? 15 : 17));
  const descriptionLines = Math.ceil(node.description.length / (compact ? 28 : 32));
  const shapeLines = Math.ceil(node.shape.length / 24);
  const portLines = Math.max(node.inputPorts.length, node.outputPorts.length, 1);
  const baseHeight = compact ? 220 : 256;
  const lineHeight = compact ? 24 : 26;

  return Math.max(
    baseHeight,
    baseHeight + (labelLines - 1) * 26 + descriptionLines * lineHeight + shapeLines * 20 + (portLines - 1) * 12
  );
}

function normalizePathLabel(path: GraphPath, index: number) {
  const raw = `${path.label} ${path.description}`.toLowerCase();

  if (raw.includes("inference")) {
    return "Main inference";
  }

  if (raw.includes("training") || raw.includes("loss") || raw.includes("update")) {
    return "Training update";
  }

  if (raw.includes("vision") || raw.includes("observer") || raw.includes("perception")) {
    return "Perception branch";
  }

  if (raw.includes("plan") || raw.includes("controller") || raw.includes("policy") || raw.includes("action")) {
    return "Planning branch";
  }

  return index === 0 ? "Main path" : `Path ${index + 1}`;
}

function edgeIsInPath(edgeIndex: number, path: GraphPath | undefined, activeStep: number) {
  if (!path) {
    return false;
  }

  return path.edgeSequence.slice(0, activeStep + 1).includes(edgeIndex);
}

function portPoint(
  node: GraphNode,
  side: PortSide,
  portId: string | undefined,
  x: number,
  y: number,
  height: number,
  nodeWidth: number
) {
  const ports = side === "left" || side === "top" ? node.inputPorts : node.outputPorts;
  const index = Math.max(ports.findIndex((port) => port.id === portId), 0);
  const count = Math.max(ports.length, 1);
  const spacing = height / (count + 1);

  if (side === "left") {
    return { x, y: y + spacing * (index + 1) };
  }

  if (side === "right") {
    return { x: x + nodeWidth, y: y + spacing * (index + 1) };
  }

  if (side === "top") {
    return { x: x + (nodeWidth / (count + 1)) * (index + 1), y };
  }

  return { x: x + (nodeWidth / (count + 1)) * (index + 1), y: y + height };
}

function pathForEdge(from: { x: number; y: number }, to: { x: number; y: number }) {
  const deltaX = to.x - from.x;
  const curve = Math.max(Math.abs(deltaX) * 0.42, 90);
  return `M ${from.x} ${from.y} C ${from.x + curve} ${from.y}, ${to.x - curve} ${to.y}, ${to.x} ${to.y}`;
}

function GraphCanvas({
  visualization,
  isFullscreen,
  onOpenFullscreen,
  onCloseFullscreen
}: {
  visualization: Visualization;
  isFullscreen: boolean;
  onOpenFullscreen: () => void;
  onCloseFullscreen: () => void;
}) {
  const graph = visualization.graph;
  const [pathIndex, setPathIndex] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const embeddedViewportRef = useRef<HTMLDivElement | null>(null);

  const compact = !isFullscreen;
  const NODE_WIDTH = compact ? 292 : 360;
  const NODE_MIN_HEIGHT = compact ? 220 : 256;
  const COLUMN_GAP = compact ? 156 : 220;
  const ROW_GAP = compact ? 72 : 96;
  const PADDING_X = compact ? 48 : 80;
  const PADDING_Y = compact ? 56 : 80;

  const layers = useMemo(() => {
    const map = new Map<number, GraphNode[]>();

    for (const node of graph.nodes) {
      const bucket = map.get(node.layer) ?? [];
      bucket.push(node);
      map.set(node.layer, bucket);
    }

    return Array.from(map.entries())
      .sort((left, right) => left[0] - right[0])
      .map(([layer, nodes]) => ({
        layer,
        nodes
      }));
  }, [graph.nodes]);

  const paths = useMemo(() => {
    const basePaths = graph.paths.length
      ? graph.paths
      : [
          {
            id: "main-path",
            label: "Main path",
            description: "Highlights the main graph route.",
            edgeSequence: graph.edges.map((_, index) => index),
            nodeSequence: graph.nodes.map((node) => node.id)
          }
        ];

    return basePaths.map((path, index) => ({
      ...path,
      label: normalizePathLabel(path, index)
    }));
  }, [graph.edges, graph.nodes, graph.paths]);

  const layout = useMemo(() => {
    const nodeHeights = new Map<string, number>();
    const positions = new Map<string, { x: number; y: number }>();
    const layerHeights = layers.map((layer) =>
      layer.nodes.reduce((total, node, index) => total + estimateNodeHeight(node, compact) + (index > 0 ? ROW_GAP : 0), 0)
    );
    const tallestLayer = Math.max(...layerHeights, NODE_MIN_HEIGHT);
    const width = PADDING_X * 2 + layers.length * NODE_WIDTH + Math.max(layers.length - 1, 0) * COLUMN_GAP + (compact ? 36 : 64);
    const height = PADDING_Y * 2 + tallestLayer;

    layers.forEach((layer, layerIndex) => {
      const currentLayerHeight = layer.nodes.reduce(
        (total, node, index) => total + estimateNodeHeight(node, compact) + (index > 0 ? ROW_GAP : 0),
        0
      );
      let currentY = PADDING_Y + (tallestLayer - currentLayerHeight) / 2;

      layer.nodes.forEach((node) => {
        const nodeHeight = estimateNodeHeight(node, compact);
        nodeHeights.set(node.id, nodeHeight);
        positions.set(node.id, {
          x: PADDING_X + layerIndex * (NODE_WIDTH + COLUMN_GAP),
          y: currentY
        });
        currentY += nodeHeight + ROW_GAP;
      });
    });

    return { positions, width, height, nodeHeights };
  }, [COLUMN_GAP, NODE_MIN_HEIGHT, NODE_WIDTH, PADDING_X, PADDING_Y, ROW_GAP, compact, layers]);

  const selectedPath = paths[Math.min(pathIndex, paths.length - 1)];
  const maxStep = Math.max(selectedPath.edgeSequence.length - 1, 0);

  useEffect(() => {
    setActiveStep(0);
  }, [pathIndex]);

  useEffect(() => {
    if (!isPlaying || maxStep <= 0) {
      return;
    }

    const interval = window.setInterval(() => {
      setActiveStep((current) => (current >= maxStep ? 0 : current + 1));
    }, 2200);

    return () => window.clearInterval(interval);
  }, [isPlaying, maxStep]);

  useEffect(() => {
    if (!isFullscreen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, onCloseFullscreen]);

  useEffect(() => {
    if (isFullscreen) {
      return;
    }

    const element = embeddedViewportRef.current;

    if (!element) {
      return;
    }

    const updateWidth = () => {
      setContainerWidth(element.clientWidth);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);

    return () => observer.disconnect();
  }, [isFullscreen]);

  const highlightedNodes = new Set(selectedPath.nodeSequence.slice(0, activeStep + 2));
  const currentNodeId =
    selectedPath.nodeSequence[Math.min(activeStep + 1, selectedPath.nodeSequence.length - 1)] ?? selectedPath.nodeSequence[0] ?? graph.nodes[0]?.id;
  const currentNode = graph.nodes.find((node) => node.id === currentNodeId) ?? graph.nodes[0];
  const embedScale = isFullscreen || !containerWidth ? 1 : Math.min(1, containerWidth / layout.width);
  const scaledHeight = layout.height * embedScale;

  if (!graph.nodes.length) {
    return null;
  }

  return (
    <div className={`rounded-[26px] border border-white/8 bg-[#111111] ${compact ? "p-5" : "p-6"}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-mist">{visualization.type.replace("_", " ")}</p>
          <h3 className="mt-2 text-3xl font-semibold text-white">{visualization.title}</h3>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-mist">{visualization.purpose}</p>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#e6ddd1]">{graph.story}</p>
        </div>
        <div className="flex items-center gap-2">
          {!isFullscreen ? (
            <button
              type="button"
              onClick={onOpenFullscreen}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white transition hover:bg-white/[0.08]"
              title="Open fullscreen"
            >
              <Expand className="h-4 w-4" />
              Full screen
            </button>
          ) : (
            <button
              type="button"
              onClick={onCloseFullscreen}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white transition hover:bg-white/[0.08]"
              title="Close fullscreen"
            >
              <X className="h-4 w-4" />
              Close
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveStep((current) => (current <= 0 ? maxStep : current - 1))}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/[0.08]"
            title="Previous step"
          >
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsPlaying((current) => !current)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#cdb79e]/20 bg-[#f0e6d8] text-[#111111] transition hover:bg-white"
            title={isPlaying ? "Pause animation" : "Play animation"}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setActiveStep((current) => (current >= maxStep ? 0 : current + 1))}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/[0.08]"
            title="Next step"
          >
            <SkipForward className="h-4 w-4" />
          </button>
        </div>
      </div>

      {paths.length > 1 ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {paths.map((path, index) => (
            <button
              key={path.id}
              type="button"
              onClick={() => setPathIndex(index)}
              className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.18em] transition ${
                index === pathIndex
                  ? "border-[#d2b08b]/40 bg-[#1b1713] text-[#f0e6d8]"
                  : "border-white/10 bg-white/[0.03] text-mist hover:bg-white/[0.06]"
              }`}
            >
              {path.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4 rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-3">
        <div className="flex items-center justify-between gap-4 text-xs uppercase tracking-[0.16em] text-mist">
          <span>
            Step {Math.min(activeStep + 1, maxStep + 1)} of {maxStep + 1}
          </span>
          <span>{visualization.viewMode} view</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#c48052] via-[#f0e6d8] to-[#e0b58e] transition-all duration-500"
            style={{ width: `${maxStep <= 0 ? 100 : ((activeStep + 1) / (maxStep + 1)) * 100}%` }}
          />
        </div>
        <p className="mt-3 text-sm leading-6 text-mist">{selectedPath.description}</p>
      </div>

      <div
        ref={embeddedViewportRef}
        className={`mt-6 ${isFullscreen ? "overflow-x-auto" : "overflow-hidden"}`}
      >
        <div
          className="rounded-[26px] border border-white/8 bg-[#0f0f0f] p-6"
          style={
            isFullscreen
              ? undefined
              : {
                  height: scaledHeight + 48
                }
          }
        >
          <div
            className="relative origin-top-left"
            style={{
              width: layout.width,
              height: layout.height,
              transform: isFullscreen ? "none" : `scale(${embedScale})`
            }}
          >
            <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${layout.width} ${layout.height}`} fill="none">
              {graph.groups.map((group) => {
                const startIndex = layers.findIndex((layer) => layer.layer === group.layerStart);
                const endIndex = layers.findIndex((layer) => layer.layer === group.layerEnd);

                if (startIndex === -1 || endIndex === -1) {
                  return null;
                }

                const x = PADDING_X - 26 + startIndex * (NODE_WIDTH + COLUMN_GAP);
                const width = (endIndex - startIndex + 1) * NODE_WIDTH + Math.max(endIndex - startIndex, 0) * COLUMN_GAP + 52;

                return (
                  <g key={group.id}>
                    <rect
                      x={x}
                      y={20}
                      width={width}
                      height={layout.height - 40}
                      rx={30}
                      fill="rgba(255,255,255,0.015)"
                      stroke="rgba(255,255,255,0.06)"
                    />
                    <text x={x + 22} y={46} fill="rgba(240,230,216,0.88)" fontSize="14" letterSpacing="2.2">
                      {group.label.toUpperCase()}
                    </text>
                  </g>
                );
              })}

              {graph.edges.map((edge, index) => {
                const fromNode = graph.nodes.find((node) => node.id === edge.fromNodeId);
                const toNode = graph.nodes.find((node) => node.id === edge.toNodeId);
                const from = layout.positions.get(edge.fromNodeId);
                const to = layout.positions.get(edge.toNodeId);

                if (!fromNode || !toNode || !from || !to) {
                  return null;
                }

                const fromHeight = layout.nodeHeights.get(fromNode.id) ?? NODE_MIN_HEIGHT;
                const toHeight = layout.nodeHeights.get(toNode.id) ?? NODE_MIN_HEIGHT;
                const start = portPoint(fromNode, "right", edge.fromPort, from.x, from.y, fromHeight, NODE_WIDTH);
                const end = portPoint(toNode, "left", edge.toPort, to.x, to.y, toHeight, NODE_WIDTH);
                const pathDef = pathForEdge(start, end);
                const isActive = edgeIsInPath(index, selectedPath, activeStep);
                const labelX = Math.max(Math.min((start.x + end.x) / 2, layout.width - (compact ? 112 : 130)), compact ? 112 : 130);
                const labelY = (start.y + end.y) / 2 - 14;
                const labelWidth = compact ? 184 : 216;
                const tensorText = edge.tensorLabel.length > (compact ? 22 : 28) ? `${edge.tensorLabel.slice(0, compact ? 22 : 28)}...` : edge.tensorLabel;
                const shapeText = edge.shape.length > (compact ? 24 : 30) ? `${edge.shape.slice(0, compact ? 24 : 30)}...` : edge.shape;

                return (
                  <g key={`${edge.fromNodeId}-${edge.toNodeId}-${index}`}>
                    <path d={pathDef} stroke={isActive ? "#f0e6d8" : "rgba(255,255,255,0.12)"} strokeWidth={isActive ? 2.5 : 1.25} />
                    <rect
                      x={labelX - labelWidth / 2}
                      y={labelY - 18}
                      width={labelWidth}
                      height={40}
                      rx={12}
                      fill="rgba(15,15,15,0.92)"
                      stroke={isActive ? "rgba(205,183,158,0.25)" : "rgba(255,255,255,0.06)"}
                    />
                    <text x={labelX} y={labelY - 2} textAnchor="middle" fill={isActive ? "#f0e6d8" : "rgba(232,223,212,0.82)"} fontSize="12">
                      {tensorText}
                    </text>
                    <text x={labelX} y={labelY + 13} textAnchor="middle" fill="rgba(205,183,158,0.95)" fontSize="11">
                      {shapeText}
                    </text>
                  </g>
                );
              })}
            </svg>

            {graph.nodes.map((node) => {
              const position = layout.positions.get(node.id);

              if (!position) {
                return null;
              }

              const isHighlighted = highlightedNodes.has(node.id);
              const isCurrent = node.id === currentNodeId;
              const nodeHeight = layout.nodeHeights.get(node.id) ?? NODE_MIN_HEIGHT;

              return (
                <div
                  key={node.id}
                  className={`absolute rounded-[24px] border p-5 transition duration-500 ${
                    isCurrent
                      ? "border-[#d2b08b]/40 bg-[#1b1713] shadow-[0_0_0_1px_rgba(210,176,139,0.14),0_24px_80px_rgba(196,128,82,0.18)]"
                      : isHighlighted
                        ? "border-white/12 bg-[#171717]"
                        : "border-white/8 bg-[#141414]"
                  }`}
                  style={{
                    left: position.x,
                    top: position.y,
                    width: NODE_WIDTH,
                    minHeight: nodeHeight
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-mist">{nodeTypeLabel(node.type)}</p>
                      <h4 className={`mt-2 font-semibold leading-tight text-white ${compact ? "text-[1.65rem]" : "text-[2rem]"}`}>{node.label}</h4>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.15em] ${
                        node.shapeConfidence === "stated"
                          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                          : "border-white/10 bg-white/[0.03] text-mist"
                      }`}
                    >
                      {node.shapeConfidence}
                    </span>
                  </div>
                  <p className={`mt-4 text-[#e6ddd1] ${compact ? "text-[0.95rem] leading-7" : "text-base leading-8"}`}>{node.description}</p>
                  <div className="mt-5 rounded-[18px] border border-white/8 bg-[#101010] p-4">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-mist">Node shape</p>
                    <p className={`${compact ? "mt-2 text-[0.95rem] leading-6" : "mt-2 text-base leading-7"} text-[#f0e6d8]`}>{node.shape}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
          <p className="text-sm uppercase tracking-[0.18em] text-mist">Current node</p>
          <h4 className="mt-3 text-2xl font-semibold text-white">{currentNode.label}</h4>
          <p className="mt-3 text-sm leading-7 text-[#e6ddd1]">{currentNode.description}</p>
          <div className="mt-4 rounded-[18px] border border-white/8 bg-[#121212] p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-mist">Node shape</p>
            <p className="mt-2 text-sm leading-6 text-[#f1e8dc]">{currentNode.shape}</p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
          <p className="text-sm uppercase tracking-[0.18em] text-mist">Shape notes</p>
          <div className="mt-4 space-y-3">
            {graph.shapeNotes.length ? (
              graph.shapeNotes.map((note) => (
                <div key={`${note.target}-${note.note}`} className="rounded-[18px] border border-white/8 bg-[#121212] p-4 text-sm leading-6 text-mist">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-[#cdb79e]">{note.target}</span>
                  <p className="mt-2">{note.note}</p>
                </div>
              ))
            ) : (
              <div className="rounded-[18px] border border-white/8 bg-[#121212] p-4 text-sm leading-6 text-mist">
                No additional shape notes were returned for this graph.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function GraphVisualization({ visualization }: { visualization: Visualization }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <>
      <GraphCanvas
        visualization={visualization}
        isFullscreen={false}
        onOpenFullscreen={() => setIsFullscreen(true)}
        onCloseFullscreen={() => setIsFullscreen(false)}
      />

      {isFullscreen ? (
        <div className="fixed inset-0 z-50 overflow-auto bg-black/85 p-4 backdrop-blur-sm">
          <div className="mx-auto min-h-full max-w-[1800px]">
            <GraphCanvas
              visualization={visualization}
              isFullscreen
              onOpenFullscreen={() => setIsFullscreen(true)}
              onCloseFullscreen={() => setIsFullscreen(false)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
