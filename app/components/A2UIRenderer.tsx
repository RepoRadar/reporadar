"use client";

import { useState } from "react";
import type { A2UINode } from "@/app/lib/a2ui-types";

export function A2UIRenderer({ node }: { node: A2UINode }) {
  return <Render node={node} />;
}

function Render({ node }: { node: A2UINode }): React.ReactElement {
  switch (node.type) {
    case "Layout":
      return (
        <div
          className={`flex ${node.direction === "row" ? "flex-row" : "flex-col"}`}
          style={{ gap: node.gap ?? 12 }}
        >
          {node.children.map((c, i) => (
            <Render key={i} node={c} />
          ))}
        </div>
      );
    case "Container": {
      const tone =
        node.tone === "subtle"
          ? "bg-zinc-900/40 border-white/5"
          : node.tone === "highlight"
          ? "bg-emerald-500/10 border-emerald-500/40"
          : "bg-zinc-900/60 border-white/10";
      return (
        <div
          className={`rounded-xl border ${tone}`}
          style={{ padding: node.padding ?? 16 }}
        >
          <div className="flex flex-col gap-3">
            {node.children.map((c, i) => (
              <Render key={i} node={c} />
            ))}
          </div>
        </div>
      );
    }
    case "Heading": {
      const sz = node.level === 1 ? "text-2xl" : node.level === 2 ? "text-xl" : "text-base";
      return <h2 className={`${sz} font-semibold tracking-tight`}>{node.text}</h2>;
    }
    case "Text": {
      const c =
        node.tone === "muted"
          ? "text-zinc-400"
          : node.tone === "danger"
          ? "text-red-400"
          : node.tone === "success"
          ? "text-emerald-400"
          : "text-zinc-200";
      return <p className={`text-sm leading-6 ${c}`}>{node.text}</p>;
    }
    case "Button": {
      const v =
        node.variant === "secondary"
          ? "border border-white/10 bg-zinc-900 hover:bg-zinc-800"
          : node.variant === "ghost"
          ? "hover:bg-white/5"
          : "bg-emerald-500 text-black hover:bg-emerald-400";
      return (
        <button
          className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition ${v}`}
          onClick={() => console.log("[a2ui] button action:", node.action)}
        >
          {node.label}
        </button>
      );
    }
    case "TextField":
      return <ControlledTextField node={node} />;
    case "CheckBox":
      return <ControlledCheckBox node={node} />;
    case "Slider":
      return <ControlledSlider node={node} />;
    case "List":
      return (
        <ul className="divide-y divide-white/5 rounded-md border border-white/10">
          {node.items.map((it, i) => (
            <li key={i} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-sm font-medium">{it.title}</div>
                {it.subtitle && (
                  <div className="text-xs text-zinc-500">{it.subtitle}</div>
                )}
              </div>
              {it.meta && (
                <span className="font-mono text-xs text-zinc-500">{it.meta}</span>
              )}
            </li>
          ))}
        </ul>
      );
    case "Tabs":
      return <TabsRender node={node} />;
    case "ProgressBar": {
      const pct = Math.max(0, Math.min(100, (node.value / node.max) * 100));
      return (
        <div className="flex flex-col gap-1">
          {node.label && <div className="text-xs text-zinc-400">{node.label}</div>}
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-emerald-400" style={{ width: `${pct}%` }} />
          </div>
        </div>
      );
    }
    case "Image":
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={node.src}
          alt={node.alt}
          width={node.width}
          height={node.height}
          className="rounded-lg border border-white/10"
        />
      );
    case "Code":
      return (
        <pre className="overflow-auto rounded-md border border-white/10 bg-black/60 p-3 text-xs font-mono text-zinc-200">
          <code>{node.code}</code>
        </pre>
      );
    default: {
      const _exhaustive: never = node;
      void _exhaustive;
      return <span className="text-xs text-red-400">[unknown node]</span>;
    }
  }
}

function ControlledTextField({
  node,
}: {
  node: Extract<A2UINode, { type: "TextField" }>;
}) {
  const [v, setV] = useState(node.defaultValue ?? "");
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-zinc-400">{node.label}</span>
      <input
        type="text"
        value={v}
        placeholder={node.placeholder}
        onChange={(e) => setV(e.target.value)}
        className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-500/60"
      />
    </label>
  );
}

function ControlledCheckBox({
  node,
}: {
  node: Extract<A2UINode, { type: "CheckBox" }>;
}) {
  const [v, setV] = useState(!!node.defaultChecked);
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={v}
        onChange={(e) => setV(e.target.checked)}
        className="h-4 w-4 accent-emerald-400"
      />
      <span>{node.label}</span>
    </label>
  );
}

function ControlledSlider({
  node,
}: {
  node: Extract<A2UINode, { type: "Slider" }>;
}) {
  const [v, setV] = useState(node.defaultValue);
  return (
    <label className="flex flex-col gap-1 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-zinc-400">{node.label}</span>
        <span className="font-mono text-zinc-500">{v}</span>
      </div>
      <input
        type="range"
        min={node.min}
        max={node.max}
        step={node.step ?? 1}
        value={v}
        onChange={(e) => setV(parseFloat(e.target.value))}
        className="h-1 w-full appearance-none rounded-full bg-white/10 accent-emerald-400"
      />
    </label>
  );
}

function TabsRender({
  node,
}: {
  node: Extract<A2UINode, { type: "Tabs" }>;
}) {
  const [active, setActive] = useState(0);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 border-b border-white/10">
        {node.tabs.map((t, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`px-3 py-2 text-sm transition ${
              i === active
                ? "border-b-2 border-emerald-400 text-emerald-400"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Render node={node.tabs[active].content} />
    </div>
  );
}
