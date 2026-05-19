"use client";

import { useState } from "react";

type Block = {
  id: number;
  title: string;
  type: string;
  position?: number;
  source_url?: string;
  content?: string;
  content_html?: string;
};

type Channel = {
  id: number;
  slug: string;
  title: string;
  total: number;
  blocks: Block[];
};

type ArenaResponse = {
  user: { slug: string; name: string; channel_count?: number };
  channels: Channel[];
  meta: { channels_shown: number; channels_total: number };
};

export default function Page() {
  const [input, setInput] = useState("");
  const [data, setData] = useState<ArenaResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setBusy(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(
        `/api/arena?user=${encodeURIComponent(input.trim())}`,
      );
      const body = (await res.json()) as
        | ArenaResponse
        | { error: string; status?: number };
      if (!res.ok || "error" in body) {
        const msg = "error" in body ? body.error : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 font-mono text-sm">
      <h1 className="mb-6 text-2xl font-semibold">aresearch</h1>
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="are.na profile URL or slug"
          className="flex-1 rounded border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {busy ? "…" : "Fetch"}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {data && (
        <section className="mt-8 whitespace-pre-wrap leading-relaxed">
          <div className="mb-4">
            {data.user.name} (@{data.user.slug})
            {data.user.channel_count !== undefined && (
              <>
                {" — "}
                {data.user.channel_count} channels
              </>
            )}
          </div>

          {data.meta.channels_total > data.meta.channels_shown && (
            <div className="mb-4 text-neutral-500">
              showing {data.meta.channels_shown} of {data.meta.channels_total}
            </div>
          )}

          {data.channels.map((c) => (
            <div key={c.id} className="mb-4">
              <div>
                - {c.title} ({c.blocks.length < c.total ? `${c.blocks.length} of ${c.total}` : c.total} items)
              </div>
              {c.blocks.length === 0 ? (
                <div className="pl-4 text-neutral-500">(no blocks)</div>
              ) : (
                c.blocks.map((b) => (
                  <div key={b.id} className="pl-4">
                    <div>
                      {b.position !== undefined ? `#${b.position} ` : ""}
                      [{b.type}] {b.title}{" "}
                      <span className="text-neutral-500">(id {b.id})</span>
                    </div>
                    {b.source_url && (
                      <div className="pl-4">
                        <a
                          href={b.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 underline break-all"
                        >
                          {b.source_url}
                        </a>
                      </div>
                    )}
                    {b.content && (
                      <div className="pl-4 mt-1 whitespace-pre-wrap text-neutral-700">
                        {b.content}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
