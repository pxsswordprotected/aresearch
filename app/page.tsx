"use client";

import { useState } from "react";

type Hit = { id: number; text: string; distance: number };

export default function Page() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, k: 10 }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { hits: Hit[] };
      setHits(data.hits);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-6 text-2xl font-semibold">aresearch</h1>
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="flex-1 rounded border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {busy ? "…" : "Search"}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <ul className="mt-8 space-y-4">
        {hits.map((h) => (
          <li key={h.id} className="rounded border border-neutral-200 p-3">
            <div className="text-xs text-neutral-500">
              #{h.id} · distance {h.distance.toFixed(4)}
            </div>
            <div className="mt-1 whitespace-pre-wrap text-sm">{h.text}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}
