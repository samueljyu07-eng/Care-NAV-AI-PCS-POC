"use client";

import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type MouseEvent,
} from "react";
import type { AgeBand } from "../../lib/catalog";
import { practitionerTypeLabel } from "../../lib/catalog";
import { libraryStepById, libraryStepType } from "../../lib/careSteps";
import { pathwayColor } from "../../lib/pathwayColors";
import { pathwayIcon, stepTileIcon } from "./node-icons";
import { visibleStepNodeLines } from "./step-node-text";
import StepWindow from "./step-window";

const NODE_WIDTH = 260;
const TILE_SIZE = 80;
const SIMPLE_NODE_WIDTH = 128;
const SIMPLE_GAP = 56;
const SIMPLE_ROW_SPAN = 210;
const HORIZONTAL_GAP = 48;
const CONTENT_PAD = 48;
const INTAKE_GAP = 80;
const ROW_START_Y = 24;
const CLOSED_ROW_SPAN = 170;
const PHONE_QUERY = "(max-width: 639px)";

export type CarePathway = {
  name: string;
  scoreText?: string | null;
  steps: {
    order: number;
    title: string;
    practitioner_type: string;
    step_id?: string | null;
    rationale?: string;
    draft_label?: string | null;
    safety_note?: string;
    sources?: { title: string; url: string; limits: string }[];
  }[];
};

type IntakeNode = Node<{ label: string }, "intake">;
type PathwayNode = Node<
  { label: string; scoreText?: string | null; background: string; border: string },
  "pathway"
>;
type StepNode = Node<
  {
    title: string;
    practitionerType: string;
    practitionerTypeId: string;
    shortLabel: string;
    background: string;
    stepTypeLabel: string | null;
    libraryStepId: string | null;
    border: string;
    rationale: string;
    draftLabel: string | null;
    safetyNote: string;
    sources: { title: string; url: string; limits: string }[];
  },
  "step"
>;
type CareNode = IntakeNode | PathwayNode | StepNode;

function practitionerLabel(type: string) {
  return practitionerTypeLabel(type);
}

function stepTypeLabel(stepType: string | null): string | null {
  if (stepType === "assessment") {
    return "Assessment";
  }
  if (stepType === "care") {
    return "Care";
  }
  if (stepType === "self_management") {
    return "Self-management";
  }
  if (stepType === "ask_your_gp") {
    return "Ask your GP";
  }
  return stepType;
}

function columnX(column: number, simple = false) {
  if (column <= 0) {
    return CONTENT_PAD;
  }

  if (!simple) {
    return (
      CONTENT_PAD +
      NODE_WIDTH +
      INTAKE_GAP +
      (column - 1) * (NODE_WIDTH + HORIZONTAL_GAP)
    );
  }

  const afterIntake = CONTENT_PAD + NODE_WIDTH + INTAKE_GAP;
  return afterIntake + (column - 1) * (SIMPLE_NODE_WIDTH + SIMPLE_GAP);
}

function connectionDot(color: string, side: "left" | "right"): CSSProperties {
  const edge = (SIMPLE_NODE_WIDTH - TILE_SIZE) / 2 - 5;
  return {
    width: 10,
    height: 10,
    background: "#ffffff",
    border: `2px solid ${color}`,
    borderRadius: 999,
    top: TILE_SIZE / 2,
    ...(side === "left" ? { left: edge } : { right: edge }),
  };
}

function tileStyle(background: string, border: string): CSSProperties {
  return {
    boxSizing: "border-box",
    width: TILE_SIZE,
    height: TILE_SIZE,
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderStyle: "solid",
    borderWidth: 2,
    borderColor: border,
    background,
  };
}

const captionStyle: CSSProperties = {
  width: SIMPLE_NODE_WIDTH,
  marginTop: 8,
  overflow: "hidden",
  color: "#1e293b",
  fontSize: 12,
  lineHeight: "16px",
  textAlign: "center",
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
};

function matchReadout(scoreText: string | null | undefined): {
  strength: string | null;
  percent: number | null;
} {
  if (!scoreText) {
    return { strength: null, percent: null };
  }
  const percentMatch = /(\d+(?:\.\d+)?)%\s*$/.exec(scoreText);
  const parsed = percentMatch ? Number(percentMatch[1]) : null;
  const percent =
    parsed !== null && Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : null;
  const first = scoreText.split("·")[0]?.trim() ?? "";
  const strength = first !== "" && !/^\d/.test(first) ? first : null;
  return { strength, percent };
}

function subscribeToPhone(onStoreChange: () => void) {
  const media = window.matchMedia(PHONE_QUERY);
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function phoneSnapshot() {
  return window.matchMedia(PHONE_QUERY).matches;
}

function phoneServerSnapshot() {
  return false;
}

const shellStyle = {
  boxSizing: "border-box" as const,
  width: NODE_WIDTH,
  padding: "14px 16px",
  borderRadius: 12,
  borderStyle: "solid",
  borderWidth: 1,
  color: "#1e293b",
  fontSize: 15,
  lineHeight: 1.45,
};

function IntakeNodeView({ data }: NodeProps<IntakeNode>) {
  const ui = useContext(StepUiContext);
  const simple = ui?.detail === "simple";
  return (
    <div style={{ ...shellStyle, background: "#f8faf9", borderColor: "#94a3b8" }}>
      <div style={{ fontWeight: 600 }}>{data.label}</div>
      <Handle
        type="source"
        position={Position.Right}
        style={
          simple
            ? {
                width: 10,
                height: 10,
                background: "#ffffff",
                border: "2px solid #64748b",
                borderRadius: 999,
              }
            : undefined
        }
      />
    </div>
  );
}

function PathwayNodeView({ data }: NodeProps<PathwayNode>) {
  const ui = useContext(StepUiContext);
  if (ui?.detail === "simple") {
    const Icon = pathwayIcon(data.label);
    const readout = matchReadout(data.scoreText);
    return (
      <div style={{ width: SIMPLE_NODE_WIDTH }}>
        <div style={{ position: "relative", height: TILE_SIZE }}>
          <Handle type="target" position={Position.Left} style={connectionDot(data.border, "left")} />
          <div aria-hidden="true" style={tileStyle(data.background, data.border)}>
            <Icon size={28} color={data.border} strokeWidth={1.75} />
          </div>
          <Handle type="source" position={Position.Right} style={connectionDot(data.border, "right")} />
        </div>
        <div style={captionStyle} title={data.label}>
          {data.label}
        </div>
        {readout.percent !== null ? (
          <div style={{ marginTop: 6 }}>
            {readout.strength ? (
              <div
                style={{
                  color: "#1e293b",
                  fontSize: 12,
                  lineHeight: "16px",
                  textAlign: "center",
                }}
              >
                {readout.strength}
              </div>
            ) : null}
            <div
              role="meter"
              aria-label={readout.strength ? `${readout.strength} match` : "Match"}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(readout.percent)}
              style={{
                width: 72,
                height: 6,
                margin: "4px auto 0",
                overflow: "hidden",
                borderRadius: 999,
                background: "#E2E2E2",
              }}
            >
              <div
                style={{
                  width: `${readout.percent}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: data.border,
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      style={{
        ...shellStyle,
        background: data.background,
        borderColor: data.border,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div style={{ fontWeight: 600 }}>{data.label}</div>
      {data.scoreText ? (
        <div style={{ marginTop: 6, fontSize: 13, color: "#334155" }}>{data.scoreText}</div>
      ) : null}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

type TreeDetail = "simple" | "detailed";

type StepUi = {
  detail: TreeDetail;
  isPhone: boolean;
  selectedStepId: string | null;
  bookedStepIds: Record<string, boolean>;
};

const StepUiContext = createContext<StepUi | null>(null);

function StepNodeView({ id, data }: NodeProps<StepNode>) {
  const ui = useContext(StepUiContext);
  const selected = ui?.selectedStepId === id;
  const booked = Boolean(ui?.bookedStepIds[id]);
  const detailed = ui?.detail === "detailed";
  const lines = visibleStepNodeLines({
    mode: detailed ? "detailed" : "simple",
    title: data.title,
    shortLabel: data.shortLabel,
    stepTypeLabel: data.stepTypeLabel,
    practitionerType: data.practitionerType,
    draftLabel: data.draftLabel,
    rationale: data.rationale,
    safetyNote: data.safetyNote,
    sourceTitles: data.sources.map((source) => source.title),
  });
  const showStepType = lines.includes(data.stepTypeLabel ?? "");

  if (!detailed) {
    const Icon = stepTileIcon(data.libraryStepId, data.practitionerTypeId);
    const border = booked ? "#15803d" : selected ? "#0f766e" : data.border;
    const background = booked ? "#dcfce7" : data.background;
    return (
      <div style={{ width: SIMPLE_NODE_WIDTH, cursor: "pointer" }}>
        <div style={{ position: "relative", height: TILE_SIZE }}>
          <Handle type="target" position={Position.Left} style={connectionDot(border, "left")} />
          <div
            aria-pressed={selected}
            style={{
              ...tileStyle(background, border),
              borderWidth: booked || selected ? 3 : 2,
              boxShadow: booked
                ? "0 0 0 3px rgba(21, 128, 61, 0.2)"
                : selected
                  ? "0 0 0 3px rgba(15, 118, 110, 0.25)"
                  : "none",
            }}
          >
            <Icon size={28} color={border} strokeWidth={1.75} aria-hidden />
          </div>
          <Handle type="source" position={Position.Right} style={connectionDot(border, "right")} />
        </div>
        <div style={captionStyle}>{lines[0]}</div>
      </div>
    );
  }

  return (
    <div style={{ width: NODE_WIDTH }}>
      <div
        aria-pressed={selected}
        style={{
          ...shellStyle,
          minHeight: ui?.isPhone ? 72 : undefined,
          background: booked ? "#dcfce7" : selected ? "#f0fdfa" : "#ffffff",
          borderColor: booked ? "#15803d" : selected ? "#0f766e" : data.border,
          borderWidth: booked || selected ? 3 : 1,
          boxShadow: booked
            ? "0 0 0 3px rgba(21, 128, 61, 0.2)"
            : selected
              ? "0 0 0 3px rgba(15, 118, 110, 0.25)"
              : "none",
          cursor: "pointer",
        }}
      >
        <Handle type="target" position={Position.Left} style={{ top: 48 }} />
        <div>{lines[0]}</div>
        {showStepType && data.stepTypeLabel ? (
          <div
            style={{
              display: "inline-block",
              marginTop: 8,
              borderRadius: 999,
              background: "#F6F6F6",
              padding: "2px 8px",
              fontSize: 12,
              lineHeight: 1.4,
              color: "#1e293b",
            }}
          >
            {data.stepTypeLabel}
          </div>
        ) : null}
        <div style={{ marginTop: 6, fontSize: 13, color: "#475569" }}>
          {data.practitionerType}
        </div>
        <Handle type="source" position={Position.Right} style={{ top: 48 }} />
      </div>
    </div>
  );
}

const nodeTypes = {
  intake: IntakeNodeView,
  pathway: PathwayNodeView,
  step: StepNodeView,
};

function PathwayLegend({ pathways }: { pathways: CarePathway[] }) {
  return (
    <ul
      aria-label="Pathway colors"
      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-2"
    >
      {pathways.map((pathway) => {
        const color = pathwayColor(pathway.name);
        return (
          <li
            key={pathway.name}
            className="flex items-center gap-2 text-base leading-6 text-black"
          >
            <span
              aria-hidden="true"
              className="size-3.5 shrink-0 rounded-sm border"
              style={{ background: color.background, borderColor: color.border }}
            />
            <span>
              {pathway.name}
              {pathway.scoreText ? (
                <span className="mt-0.5 block text-sm leading-6 text-[#545454]">
                  {pathway.scoreText}
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function buildCareTree(
  pathways: CarePathway[],
  selectedStepId: string | null,
  simple: boolean,
) {
  const rowSpan = simple ? SIMPLE_ROW_SPAN : CLOSED_ROW_SPAN;
  const nodeWidth = simple ? SIMPLE_NODE_WIDTH : NODE_WIDTH;
  const closedSpan = Math.max(pathways.length - 1, 0) * rowSpan;
  const nodes: CareNode[] = [
    {
      id: "intake",
      type: "intake",
      position: { x: columnX(0, simple), y: ROW_START_Y + closedSpan / 2 },
      data: { label: "Your intake" },
      draggable: false,
      style: { width: NODE_WIDTH },
    },
  ];

  const edges: Edge[] = [];
  let rowY = ROW_START_Y;

  pathways.forEach((pathway, pathwayIndex) => {
    const color = pathwayColor(pathway.name);
    const pathwayId = `pathway-${pathwayIndex}`;
    const steps = [...pathway.steps].sort((a, b) => a.order - b.order);

    nodes.push({
      id: pathwayId,
      type: "pathway",
      position: { x: columnX(1, simple), y: rowY },
      data: {
        label: pathway.name,
        scoreText: pathway.scoreText,
        background: color.background,
        border: color.border,
      },
      draggable: false,
      style: { width: nodeWidth },
    });

    edges.push({
      id: `intake-${pathwayId}`,
      source: "intake",
      target: pathwayId,
      type: "smoothstep",
      style: { stroke: "#64748b", strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
    });

    steps.forEach((step, stepIndex) => {
      const stepId = `step-${pathwayIndex}-${step.order}`;
      nodes.push({
        id: stepId,
        type: "step",
        position: { x: columnX(stepIndex + 2, simple), y: rowY },
        data: {
          title: step.title,
          practitionerType: practitionerLabel(step.practitioner_type),
          practitionerTypeId: step.practitioner_type,
          shortLabel: libraryStepById(step.step_id)?.short_label ?? "",
          background: color.background,
          stepTypeLabel: stepTypeLabel(libraryStepType(step.step_id)),
          libraryStepId: step.step_id ?? null,
          border: color.border,
          rationale: step.rationale ?? "",
          draftLabel: step.draft_label ?? null,
          safetyNote: step.safety_note ?? "",
          sources: step.sources ?? [],
        },
        draggable: false,
        zIndex: selectedStepId === stepId ? 20 : 0,
        style: { width: nodeWidth, cursor: "pointer" },
      });

      const source =
        stepIndex === 0
          ? pathwayId
          : `step-${pathwayIndex}-${steps[stepIndex - 1].order}`;
      edges.push({
        id: `${source}-${stepId}`,
        source,
        target: stepId,
        type: "smoothstep",
        style: { stroke: "#64748b", strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
      });
    });

    rowY += rowSpan;
  });

  return { nodes, edges };
}

export default function CareTree({
  pathways,
  patientCity,
  ageBand,
}: {
  pathways: CarePathway[];
  patientCity: string;
  ageBand: AgeBand | null;
}) {
  const [detail, setDetail] = useState<TreeDetail>("simple");
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [bookedStepIds, setBookedStepIds] = useState<Record<string, boolean>>({});
  const closeStep = useCallback(() => setSelectedStepId(null), []);
  const finishBooking = useCallback(() => {
    setBookedStepIds((booked) =>
      selectedStepId ? { ...booked, [selectedStepId]: true } : booked,
    );
    setSelectedStepId(null);
  }, [selectedStepId]);
  const isPhone = useSyncExternalStore(
    subscribeToPhone,
    phoneSnapshot,
    phoneServerSnapshot,
  );

  useEffect(() => {
    if (isPhone) {
      setDetail("simple");
    }
  }, [isPhone]);
  const { nodes, edges } = useMemo(
    () => buildCareTree(pathways, selectedStepId, detail === "simple"),
    [pathways, selectedStepId, detail],
  );
  const flowRef = useRef<ReactFlowInstance<CareNode, Edge> | null>(null);

  useEffect(() => {
    const instance = flowRef.current;
    if (!instance) {
      return;
    }

    if (isPhone) {
      instance.setViewport({ x: 24, y: 24, zoom: 1 });
      return;
    }

    instance.fitView({ padding: 0.12 });
  }, [isPhone, detail, pathways]);

  function handleNodeClick(_event: MouseEvent, node: Node) {
    if (node.type !== "step") {
      return;
    }

    setSelectedStepId((current) => (current === node.id ? null : node.id));
  }

  const selected = selectedStep(nodes, selectedStepId);

  return (
    <div className="flex flex-col gap-3">
      <div
        role="radiogroup"
        aria-label="How much each step shows"
        className="inline-flex w-fit gap-1 rounded-full border border-[#E2E2E2] bg-white p-1"
      >
        <button
          type="button"
          role="radio"
          aria-checked={detail === "simple"}
          onClick={() => setDetail("simple")}
          className={
            detail === "simple"
              ? "cursor-pointer rounded-full bg-black px-4 py-2 text-sm font-medium text-white"
              : "cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-black"
          }
        >
          Simple
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={detail === "detailed"}
          onClick={() => setDetail("detailed")}
          className={
            detail === "detailed"
              ? "cursor-pointer rounded-full bg-black px-4 py-2 text-sm font-medium text-white"
              : "cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-black"
          }
        >
          Detailed
        </button>
      </div>
      <PathwayLegend pathways={pathways} />
      <div
        role="region"
        aria-label="Care pathway diagram"
        className={
          isPhone
            ? "h-[70svh] w-full overflow-hidden rounded-xl border border-[#E2E2E2] bg-[#F6F6F6]"
            : "h-[75vh] min-h-[640px] w-full overflow-hidden rounded-xl border border-[#E2E2E2] bg-[#F6F6F6]"
        }
      >
        <div className="h-full w-full">
          <StepUiContext.Provider
            value={{
              detail,
              isPhone,
              selectedStepId,
              bookedStepIds,
            }}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onInit={(instance) => {
                flowRef.current = instance;
                if (window.matchMedia(PHONE_QUERY).matches) {
                  instance.setViewport({ x: 24, y: 24, zoom: 1 });
                  return;
                }
                instance.fitView({ padding: 0.12 });
              }}
              minZoom={0.35}
              maxZoom={1.4}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              panOnDrag
              panOnScroll={isPhone}
              zoomOnScroll={!isPhone}
              zoomOnPinch={!isPhone}
              zoomOnDoubleClick={!isPhone}
              preventScrolling
              onNodeClick={handleNodeClick}
            >
              <Background color="#d7e0dc" gap={18} />
              <Controls showInteractive={false} position="top-right" />
            </ReactFlow>
          </StepUiContext.Provider>
        </div>
      </div>
      {selected ? (
        <StepWindow
          title={selected.title}
          stepId={selected.stepId}
          practitionerType={selected.practitionerType}
          patientCity={patientCity}
          ageBand={ageBand}
          onClose={closeStep}
          onBooked={finishBooking}
        />
      ) : null}
    </div>
  );
}

function selectedStep(nodes: CareNode[], selectedStepId: string | null) {
  if (!selectedStepId) {
    return null;
  }
  const node = nodes.find((item) => item.id === selectedStepId);
  if (!node || node.type !== "step") {
    return null;
  }
  return {
    title: node.data.title,
    stepId: node.data.libraryStepId,
    practitionerType: node.data.practitionerTypeId,
  };
}
