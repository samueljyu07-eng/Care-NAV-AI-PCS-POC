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
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
} from "react";
import PractitionerPanel, { type Practitioner } from "./practitioner-panel";

const NODE_WIDTH = 260;
const HORIZONTAL_GAP = 48;
const CONTENT_PAD = 48;
const INTAKE_GAP = 80;
const ROW_START_Y = 24;
const CLOSED_ROW_SPAN = 170;
const OPEN_ROW_SPAN = 860;
const PHONE_QUERY = "(max-width: 639px)";

const PATHWAY_COLORS = [
  { background: "#e5f2eb", border: "#6d9b86" },
  { background: "#e6f0f7", border: "#7593ad" },
  { background: "#f6f1e6", border: "#b19772" },
];

const PRACTITIONER_TYPE_LABELS: Record<string, string> = {
  vestibular_physio: "Vestibular physiotherapist",
  physiotherapist: "Physiotherapist",
  vision_therapist: "Vision therapist",
  sports_medicine_physician: "Sports medicine physician",
  sleep_specialist: "Sleep specialist",
  psychologist: "Psychologist",
};

export type CarePathway = {
  name: string;
  steps: {
    order: number;
    title: string;
    practitioner_type: string;
  }[];
};

type IntakeNode = Node<{ label: string }, "intake">;
type PathwayNode = Node<
  { label: string; background: string; border: string },
  "pathway"
>;
type StepNode = Node<
  {
    title: string;
    practitionerType: string;
    practitionerTypeId: string;
    border: string;
  },
  "step"
>;
type CareNode = IntakeNode | PathwayNode | StepNode;

function practitionerLabel(type: string) {
  return PRACTITIONER_TYPE_LABELS[type] ?? type.replaceAll("_", " ");
}

function columnX(column: number) {
  if (column <= 0) {
    return CONTENT_PAD;
  }

  return (
    CONTENT_PAD +
    NODE_WIDTH +
    INTAKE_GAP +
    (column - 1) * (NODE_WIDTH + HORIZONTAL_GAP)
  );
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
  lineHeight: 1.4,
};

function IntakeNodeView({ data }: NodeProps<IntakeNode>) {
  return (
    <div style={{ ...shellStyle, background: "#f8faf9", borderColor: "#94a3b8" }}>
      <div style={{ fontWeight: 600 }}>{data.label}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function PathwayNodeView({ data }: NodeProps<PathwayNode>) {
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
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

type StepUi = {
  selectedStepId: string | null;
  chosenByStep: Record<string, string>;
  practitioners: Practitioner[];
  patientCity: string;
  onChoose: (practitionerId: string) => void;
};

const StepUiContext = createContext<StepUi | null>(null);

function StepNodeView({ id, data }: NodeProps<StepNode>) {
  const ui = useContext(StepUiContext);
  const selected = ui?.selectedStepId === id;
  const chosen = Boolean(ui && ui.chosenByStep[id]);

  return (
    <div style={{ width: NODE_WIDTH }}>
      <div
        aria-pressed={selected}
        style={{
          ...shellStyle,
          background: chosen ? "#dcfce7" : selected ? "#f0fdfa" : "#ffffff",
          borderColor: chosen ? "#15803d" : selected ? "#0f766e" : data.border,
          borderWidth: chosen || selected ? 3 : 1,
          boxShadow: chosen
            ? "0 0 0 3px rgba(21, 128, 61, 0.2)"
            : selected
              ? "0 0 0 3px rgba(15, 118, 110, 0.25)"
              : "none",
          cursor: "pointer",
        }}
      >
        <Handle type="target" position={Position.Left} style={{ top: 48 }} />
        <div>{data.title}</div>
        <div style={{ marginTop: 6, fontSize: 13, color: "#475569" }}>
          {data.practitionerType}
        </div>
        <Handle type="source" position={Position.Right} style={{ top: 48 }} />
      </div>
      {selected && ui ? (
        <div
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <PractitionerPanel
            open
            stepTitle={data.title}
            practitionerType={data.practitionerTypeId}
            patientCity={ui.patientCity}
            practitioners={ui.practitioners}
            chosenId={ui.chosenByStep[id] ?? null}
            onChoose={ui.onChoose}
          />
        </div>
      ) : null}
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
      {pathways.map((pathway, index) => {
        const color = PATHWAY_COLORS[index % PATHWAY_COLORS.length];
        return (
          <li
            key={pathway.name}
            className="flex items-center gap-2 text-sm leading-5 text-slate-700"
          >
            <span
              aria-hidden="true"
              className="size-3.5 shrink-0 rounded-sm border"
              style={{ background: color.background, borderColor: color.border }}
            />
            {pathway.name}
          </li>
        );
      })}
    </ul>
  );
}

function buildCareTree(pathways: CarePathway[], selectedStepId: string | null) {
  const closedSpan = Math.max(pathways.length - 1, 0) * CLOSED_ROW_SPAN;
  const nodes: CareNode[] = [
    {
      id: "intake",
      type: "intake",
      position: { x: columnX(0), y: ROW_START_Y + closedSpan / 2 },
      data: { label: "Your intake" },
      draggable: false,
      style: { width: NODE_WIDTH },
    },
  ];

  const edges: Edge[] = [];
  let rowY = ROW_START_Y;

  pathways.forEach((pathway, pathwayIndex) => {
    const color = PATHWAY_COLORS[pathwayIndex % PATHWAY_COLORS.length];
    const pathwayId = `pathway-${pathwayIndex}`;
    const steps = [...pathway.steps].sort((a, b) => a.order - b.order);
    const rowIsOpen = steps.some(
      (step) => `step-${pathwayIndex}-${step.order}` === selectedStepId,
    );

    nodes.push({
      id: pathwayId,
      type: "pathway",
      position: { x: columnX(1), y: rowY },
      data: {
        label: pathway.name,
        background: color.background,
        border: color.border,
      },
      draggable: false,
      style: { width: NODE_WIDTH },
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
        position: { x: columnX(stepIndex + 2), y: rowY },
        data: {
          title: step.title,
          practitionerType: practitionerLabel(step.practitioner_type),
          practitionerTypeId: step.practitioner_type,
          border: color.border,
        },
        draggable: false,
        zIndex: selectedStepId === stepId ? 20 : 0,
        style: { width: NODE_WIDTH, cursor: "pointer" },
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

    rowY += rowIsOpen ? OPEN_ROW_SPAN : CLOSED_ROW_SPAN;
  });

  return { nodes, edges };
}

export default function CareTree({
  pathways,
  practitioners,
  patientCity,
}: {
  pathways: CarePathway[];
  practitioners: Practitioner[];
  patientCity: string;
}) {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [chosenByStep, setChosenByStep] = useState<Record<string, string>>({});
  const isPhone = useSyncExternalStore(
    subscribeToPhone,
    phoneSnapshot,
    phoneServerSnapshot,
  );
  const { nodes, edges } = useMemo(
    () => buildCareTree(pathways, selectedStepId),
    [pathways, selectedStepId],
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
  }, [isPhone]);

  useEffect(() => {
    const instance = flowRef.current;
    if (!selectedStepId || !instance) {
      return;
    }

    const node = instance.getNode(selectedStepId);
    if (!node) {
      return;
    }

    instance.setCenter(node.position.x + NODE_WIDTH / 2, node.position.y + 260, {
      zoom: instance.getZoom(),
      duration: 300,
    });
  }, [selectedStepId, nodes]);

  function handleNodeClick(_event: MouseEvent, node: Node) {
    if (node.type !== "step") {
      return;
    }

    setSelectedStepId((current) => (current === node.id ? null : node.id));
  }

  function choosePractitioner(practitionerId: string) {
    if (!selectedStepId) {
      return;
    }

    setChosenByStep((current) => ({
      ...current,
      [selectedStepId]: practitionerId,
    }));
  }

  return (
    <div className="flex flex-col gap-3">
      <PathwayLegend pathways={pathways} />
      <div
        role="region"
        aria-label="Care pathway diagram"
        className={
          isPhone
            ? "h-[70svh] w-full overflow-hidden rounded-xl border border-slate-200 bg-white"
            : "h-[75vh] min-h-[640px] w-full overflow-hidden rounded-xl border border-slate-200 bg-white"
        }
      >
        <div className="h-full w-full">
          <StepUiContext.Provider
            value={{
              selectedStepId,
              chosenByStep,
              practitioners,
              patientCity,
              onChoose: choosePractitioner,
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
    </div>
  );
}
