export type PathwayColor = {
  background: string;
  border: string;
};

const PATHWAY_COLORS: Record<string, PathwayColor> = {
  "Energy and recovery after effort": { background: "#e5f2eb", border: "#5f8f78" },
  "Symptoms triggered by exertion": { background: "#e6f0f7", border: "#5d7f9a" },
  "Hormonal and body-system changes": { background: "#f6f1e6", border: "#a08a62" },
  "Balance, dizziness and visual motion": { background: "#efe8f7", border: "#7d6d9a" },
  "Eye tracking, focusing and screen strain": { background: "#f8e8ec", border: "#a15d6e" },
  "Neck tension and sensory sensitivity": { background: "#e5f3f2", border: "#4f8a86" },
};

const FALLBACK_COLOR: PathwayColor = { background: "#f6f6f6", border: "#545454" };

export function pathwayColor(name: string): PathwayColor {
  return PATHWAY_COLORS[name] ?? FALLBACK_COLOR;
}
