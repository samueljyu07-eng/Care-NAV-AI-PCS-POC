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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import PractitionerPanel, { type Practitioner } from "./practitioner-panel";

const NODE_WIDTH = 280;
const COLUMN_GAP = 64;
const INTAKE_Y = 0;
const PATHWAY_Y = 150;
const FIRST_STEP_Y = 300;
const STEP_GAP = 200;

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

function columnX(index: number, count: number) {
  const totalWidth = count * NODE_WIDTH + (count - 1) * COLUMN_GAP;
  const start = -totalWidth / 2;
  return start + index * (NODE_WIDTH + COLUMN_GAP);
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
      <Handle type="source" position={Position.Bottom} />
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
      <Handle type="target" position={Position.Top} />
      <div style={{ fontWeight: 600 }}>{data.label}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const SelectedStepContext = createContext<string | null>(null);

function StepNodeView({ id, data }: NodeProps<StepNode>) {
  const selectedStepId = useContext(SelectedStepContext);
  const selected = selectedStepId === id;

  return (
    <div
      aria-pressed={selected}
      style={{
        ...shellStyle,
        background: selected ? "#f0fdfa" : "#ffffff",
        borderColor: selected ? "#0f766e" : data.border,
        borderWidth: selected ? 3 : 1,
        boxShadow: selected ? "0 0 0 3px rgba(15, 118, 110, 0.25)" : "none",
        cursor: "pointer",
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div>{data.title}</div>
      <div style={{ marginTop: 6, fontSize: 13, color: "#475569" }}>
        {data.practitionerType}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = {
  intake: IntakeNodeView,
  pathway: PathwayNodeView,
  step: StepNodeView,
};

function buildCareTree(pathways: CarePathway[]) {
  const nodes: CareNode[] = [
    {
      id: "intake",
      type: "intake",
      position: { x: -NODE_WIDTH / 2, y: INTAKE_Y },
      data: { label: "Your intake" },
      draggable: false,
      style: { width: NODE_WIDTH },
    },
  ];

  const edges: Edge[] = [];

  pathways.forEach((pathway, pathwayIndex) => {
    const color = PATHWAY_COLORS[pathwayIndex % PATHWAY_COLORS.length];
    const pathwayId = `pathway-${pathwayIndex}`;
    const x = columnX(pathwayIndex, pathways.length);
    const steps = [...pathway.steps].sort((a, b) => a.order - b.order);

    nodes.push({
      id: pathwayId,
      type: "pathway",
      position: { x, y: PATHWAY_Y },
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
        position: { x, y: FIRST_STEP_Y + stepIndex * STEP_GAP },
        data: {
          title: step.title,
          practitionerType: practitionerLabel(step.practitioner_type),
          practitionerTypeId: step.practitioner_type,
          border: color.border,
        },
        draggable: false,
        style: { width: NODE_WIDTH, cursor: "pointer" },
      });

      const source = stepIndex === 0 ? pathwayId : `step-${pathwayIndex}-${steps[stepIndex - 1].order}`;
      edges.push({
        id: `${source}-${stepId}`,
        source,
        target: stepId,
        type: "smoothstep",
        style: { stroke: "#64748b", strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
      });
    });
  });

  return { nodes, edges };
}

function selectedStep(nodes: CareNode[], selectedStepId: string | null) {
  if (!selectedStepId) {
    return null;
  }

  const node = nodes.find((item) => item.id === selectedStepId);
  if (node?.type !== "step") {
    return null;
  }

  return node.data;
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
  const { nodes, edges } = useMemo(() => buildCareTree(pathways), [pathways]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [chosenByStep, setChosenByStep] = useState<Record<string, string>>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const step = selectedStep(nodes, selectedStepId);

  useEffect(() => {
    if (!selectedStepId) {
      return;
    }

    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedStepId]);

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
      <div className="h-[75vh] min-h-[640px] w-full overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="h-full w-full" role="region" aria-label="Care pathway diagram">
          <SelectedStepContext.Provider value={selectedStepId}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.12 }}
              minZoom={0.2}
              maxZoom={1.5}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              panOnDrag
              zoomOnScroll
              zoomOnPinch
              onNodeClick={handleNodeClick}
            >
              <Background color="#d7e0dc" gap={18} />
              <Controls showInteractive={false} position="top-right" />
            </ReactFlow>
          </SelectedStepContext.Provider>
        </div>
      </div>
      <div ref={panelRef}>
        <PractitionerPanel
          open={step !== null}
          stepTitle={step?.title ?? null}
          practitionerType={step?.practitionerTypeId ?? null}
          patientCity={patientCity}
          practitioners={practitioners}
          chosenId={selectedStepId ? (chosenByStep[selectedStepId] ?? null) : null}
          onChoose={choosePractitioner}
        />
      </div>
    </div>
  );
}
