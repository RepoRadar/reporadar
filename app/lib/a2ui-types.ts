// A2UI subset — declarative component spec emitted by the deploy-agent.
// This is a deliberately small slice of the A2UI vocabulary so the agent has
// a tight schema to fill and the renderer stays trivial.

export type A2UINode =
  | { type: "Layout"; direction: "row" | "column"; gap?: number; children: A2UINode[] }
  | { type: "Container"; padding?: number; children: A2UINode[]; tone?: "default" | "subtle" | "highlight" }
  | { type: "Heading"; level: 1 | 2 | 3; text: string }
  | { type: "Text"; text: string; tone?: "default" | "muted" | "danger" | "success" }
  | { type: "Button"; label: string; action: string; variant?: "primary" | "secondary" | "ghost" }
  | { type: "TextField"; id: string; label: string; placeholder?: string; defaultValue?: string }
  | { type: "CheckBox"; id: string; label: string; defaultChecked?: boolean }
  | { type: "Slider"; id: string; label: string; min: number; max: number; step?: number; defaultValue: number }
  | { type: "List"; items: { title: string; subtitle?: string; meta?: string }[] }
  | { type: "Tabs"; tabs: { label: string; content: A2UINode }[] }
  | { type: "ProgressBar"; label?: string; value: number; max: number }
  | { type: "Image"; src: string; alt: string; width?: number; height?: number }
  | { type: "Code"; language?: string; code: string };

export type A2UISurface = {
  title: string;
  formFactor: "dashboard" | "playground" | "control-panel" | "wizard" | "widget-grid" | "reader";
  root: A2UINode;
  meta?: { repo?: string; hint?: string; generatedAt?: string };
};

export const A2UI_FORM_FACTORS: A2UISurface["formFactor"][] = [
  "dashboard",
  "playground",
  "control-panel",
  "wizard",
  "widget-grid",
  "reader",
];
