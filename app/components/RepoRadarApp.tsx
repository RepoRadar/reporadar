"use client";

import { useState } from "react";
import { CopilotPopup } from "@copilotkit/react-ui";

export function RepoRadarApp() {
  const [speedToBuild, setSpeedToBuild] = useState(0.5);
  const [communityEngagement, setCommunityEngagement] = useState(0.5);
  const [jobPotential, setJobPotential] = useState(0.5);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="inline-block h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_12px_2px] shadow-emerald-400/60" />
          <h1 className="font-mono text-lg tracking-tight">RepoRadar</h1>
          <span className="text-xs text-zinc-500">trending repos · agent-rendered · deploy on demand</span>
        </div>
        <span className="text-xs text-zinc-500 font-mono">v0.1 · gen-ui hackathon</span>
      </header>

      <main className="grid flex-1 grid-cols-12 gap-6 p-6">
        <aside className="col-span-3 flex flex-col gap-6 rounded-xl border border-white/10 bg-zinc-900/50 p-5">
          <h2 className="text-sm font-semibold text-zinc-300">Tune your radar</h2>
          <SliderControl
            label="Speed to build"
            value={speedToBuild}
            onChange={setSpeedToBuild}
          />
          <SliderControl
            label="Community engagement"
            value={communityEngagement}
            onChange={setCommunityEngagement}
          />
          <SliderControl
            label="Job potential"
            value={jobPotential}
            onChange={setJobPotential}
          />
          <div className="mt-auto rounded-md border border-white/10 bg-black/40 p-3 text-xs text-zinc-500">
            Ask the agent in chat to surface repos that match your sliders. Each card
            is rendered live by the agent — drag the sliders to re-rank.
          </div>
        </aside>

        <section className="col-span-9 flex flex-col gap-4">
          <div className="flex h-64 items-center justify-center rounded-xl border border-white/10 bg-zinc-900/50">
            <span className="text-xs text-zinc-500">[ radar plot — coming online in slice 2 ]</span>
          </div>
          <div className="flex min-h-[24rem] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-zinc-900/30">
            <span className="text-sm text-zinc-400">Open the chat dock and ask: <span className="font-mono text-emerald-400">&quot;show me LangChain repos for a weekend project&quot;</span></span>
            <span className="mt-2 text-xs text-zinc-500">Repo cards will materialize here.</span>
          </div>
        </section>
      </main>

      <CopilotPopup
        instructions={
          "You are RepoRadar, an agent that surfaces trending GitHub repos as interactive UI cards and deploys bespoke generative-UI variants of them on demand. Use rankRepos when the user asks for repos. Use deployRepo when the user wants to materialize one as a live app."
        }
        labels={{
          title: "RepoRadar",
          initial: "Ask me to find you a repo. I'll plot them and you can deploy any one as a custom interactive surface.",
        }}
        defaultOpen={true}
        clickOutsideToClose={false}
      />
    </div>
  );
}

function SliderControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-300">{label}</span>
        <span className="font-mono text-zinc-500">{(value * 100).toFixed(0)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-emerald-400"
      />
    </label>
  );
}
