import { notFound } from "next/navigation";
import { surfaceStore } from "@/app/api/deploy/route";
import { A2UIRenderer } from "@/app/components/A2UIRenderer";

export const runtime = "nodejs";

export default async function DeployedSurface({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const surface = surfaceStore.get(slug);
  if (!surface) notFound();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-white/10 px-6 py-3">
        <div className="flex items-center justify-between text-xs text-zinc-500 font-mono">
          <span>
            <span className="text-emerald-400">●</span> reporadar / {surface.formFactor}
          </span>
          <span>{slug}</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl p-6">
        <A2UIRenderer node={surface.root} />
      </main>
    </div>
  );
}
