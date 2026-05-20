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

type SearchHit = {
  block_id: number;
  arena_block_id: number;
  title: string | null;
  block_type: string | null;
  source_url: string | null;
  arena_url: string | null;
  snippet: string | null;
  channel_title: string | null;
  channel_url: string | null;
  distance: number;
  match_type?: "block" | "chunk";
  chunk_index?: number;
  source_start_char?: number;
  source_end_char?: number;
};

export default function Page() {
  const [input, setInput] = useState("");
  const [data, setData] = useState<ArenaResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [embedding, setEmbedding] = useState(false);
  const [embedStatus, setEmbedStatus] = useState<string | null>(null);
  const [ocring, setOcring] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkStatus, setLinkStatus] = useState<string | null>(null);
  const [chunking, setChunking] = useState(false);
  const [chunkStatus, setChunkStatus] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setBusy(true);
    setError(null);
    setData(null);
    setSaveStatus(null);
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

  async function onSave() {
    if (!input.trim()) return;
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch(
        `/api/arena/ingest?user=${encodeURIComponent(input.trim())}`,
        { method: "POST" },
      );
      const body = (await res.json()) as
        | {
            user_id: number;
            channel_count: number;
            block_count: number;
            link_count: number;
            failed_channels: string[];
          }
        | { error: string; status?: number };
      if (!res.ok || "error" in body) {
        const msg = "error" in body ? body.error : `HTTP ${res.status}`;
        setSaveStatus(`error: ${msg}`);
        return;
      }
      const failed = body.failed_channels.length
        ? ` (${body.failed_channels.length} channels failed)`
        : "";
      setSaveStatus(
        `saved: ${body.channel_count} channels, ${body.block_count} blocks, ${body.link_count} links${failed}`,
      );
    } catch (err) {
      setSaveStatus(
        `error: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setSaving(false);
    }
  }

  async function onEmbed(rebuild = false) {
    setEmbedding(true);
    setEmbedStatus(null);
    try {
      const url = rebuild ? `/api/embed?rebuild=1` : `/api/embed`;
      const res = await fetch(url, { method: "POST" });
      const body = (await res.json()) as
        | {
            embedded: number;
            skipped: number;
            batches: number;
            cleared: number;
          }
        | { error: string };
      if (!res.ok || "error" in body) {
        const msg = "error" in body ? body.error : `HTTP ${res.status}`;
        setEmbedStatus(`error: ${msg}`);
        return;
      }
      const clearedPart = body.cleared > 0 ? `cleared ${body.cleared}, ` : "";
      setEmbedStatus(
        body.embedded === 0
          ? `${clearedPart}nothing pending`
          : `${clearedPart}embedded ${body.embedded} block${body.embedded === 1 ? "" : "s"} in ${body.batches} batch${body.batches === 1 ? "" : "es"}`,
      );
    } catch (err) {
      setEmbedStatus(
        `error: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setEmbedding(false);
    }
  }

  async function onOcr(rebuild = false) {
    setOcring(true);
    setOcrStatus(null);
    try {
      const url = rebuild ? `/api/ocr?rebuild=1` : `/api/ocr`;
      const res = await fetch(url, { method: "POST" });
      const body = (await res.json()) as
        | {
            processed: number;
            errors: number;
            skipped: number;
            cleared: number;
          }
        | { error: string };
      if (!res.ok || "error" in body) {
        const msg = "error" in body ? body.error : `HTTP ${res.status}`;
        setOcrStatus(`error: ${msg}`);
        return;
      }
      const clearedPart = body.cleared > 0 ? `cleared ${body.cleared}, ` : "";
      const suffix =
        body.processed > 0
          ? " → click Rebuild to refresh embeddings"
          : "";
      setOcrStatus(
        body.processed === 0 && body.errors === 0
          ? `${clearedPart}nothing pending`
          : `${clearedPart}OCR'd ${body.processed}, ${body.errors} error${body.errors === 1 ? "" : "s"}${suffix}`,
      );
    } catch (err) {
      setOcrStatus(
        `error: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setOcring(false);
    }
  }

  async function onLinkContent(rebuild = false) {
    setLinking(true);
    setLinkStatus(null);
    try {
      const url = rebuild ? `/api/link-content?rebuild=1` : `/api/link-content`;
      const res = await fetch(url, { method: "POST" });
      const body = (await res.json()) as
        | {
            processed: number;
            errors: number;
            skipped: number;
            cleared: number;
          }
        | { error: string };
      if (!res.ok || "error" in body) {
        const msg = "error" in body ? body.error : `HTTP ${res.status}`;
        setLinkStatus(`error: ${msg}`);
        return;
      }
      const clearedPart = body.cleared > 0 ? `cleared ${body.cleared}, ` : "";
      const skippedPart = body.skipped > 0 ? `, ${body.skipped} skipped` : "";
      const suffix =
        body.processed > 0 ? " → click Rebuild to refresh embeddings" : "";
      setLinkStatus(
        body.processed === 0 && body.errors === 0 && body.skipped === 0
          ? `${clearedPart}nothing pending`
          : `${clearedPart}read ${body.processed}, ${body.errors} error${body.errors === 1 ? "" : "s"}${skippedPart}${suffix}`,
      );
    } catch (err) {
      setLinkStatus(
        `error: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setLinking(false);
    }
  }

  async function onProcessChunks() {
    setChunking(true);
    setChunkStatus(null);
    try {
      const res = await fetch(`/api/chunks`, { method: "POST" });
      const body = (await res.json()) as
        | {
            chunked: number;
            embedded: number;
            skipped: number;
            batches: number;
            cleared: number;
          }
        | { error: string };
      if (!res.ok || "error" in body) {
        const msg = "error" in body ? body.error : `HTTP ${res.status}`;
        setChunkStatus(`error: ${msg}`);
        return;
      }
      const skippedPart = body.skipped > 0 ? `, ${body.skipped} skipped` : "";
      setChunkStatus(
        body.chunked === 0 && body.embedded === 0
          ? "nothing pending"
          : `chunked ${body.chunked}, embedded ${body.embedded} chunk${body.embedded === 1 ? "" : "s"} in ${body.batches} batch${body.batches === 1 ? "" : "es"}${skippedPart}`,
      );
    } catch (err) {
      setChunkStatus(
        `error: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setChunking(false);
    }
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    setHits(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      const body = (await res.json()) as
        | { query: string; hits: SearchHit[] }
        | { error: string };
      if (!res.ok || "error" in body) {
        const msg = "error" in body ? body.error : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      setHits(body.hits);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
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
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !input.trim()}
          className="rounded border border-neutral-900 px-4 py-2 text-neutral-900 disabled:opacity-50"
        >
          {saving ? "…" : "Save to DB"}
        </button>
        <button
          type="button"
          onClick={() => onEmbed(false)}
          disabled={embedding}
          className="rounded border border-neutral-900 px-4 py-2 text-neutral-900 disabled:opacity-50"
        >
          {embedding ? "…" : "Embed"}
        </button>
        <button
          type="button"
          onClick={() => onEmbed(true)}
          disabled={embedding}
          title="clear vec_blocks and re-embed everything (costs ~$0.001 for 350 blocks)"
          className="rounded border border-red-700 px-3 py-2 text-red-700 disabled:opacity-50"
        >
          {embedding ? "…" : "Rebuild"}
        </button>
        <button
          type="button"
          onClick={() => onOcr(false)}
          disabled={ocring}
          title="OCR the next batch of image blocks (default 25)"
          className="rounded border border-neutral-900 px-4 py-2 text-neutral-900 disabled:opacity-50"
        >
          {ocring ? "…" : "OCR"}
        </button>
        <button
          type="button"
          onClick={() => onLinkContent(false)}
          disabled={linking}
          title="fetch link articles via Jina Reader (default 100)"
          className="rounded border border-neutral-900 px-4 py-2 text-neutral-900 disabled:opacity-50"
        >
          {linking ? "…" : "Read links"}
        </button>
        <button
          type="button"
          onClick={() => onLinkContent(true)}
          disabled={linking}
          title="clear block_link_content for Link blocks and re-fetch"
          className="rounded border border-red-700 px-3 py-2 text-red-700 disabled:opacity-50"
        >
          {linking ? "…" : "Re-read"}
        </button>
        <button
          type="button"
          onClick={onProcessChunks}
          disabled={chunking}
          title="build and embed chunks for long link content"
          className="rounded border border-neutral-900 px-4 py-2 text-neutral-900 disabled:opacity-50"
        >
          {chunking ? "…" : "Process chunks"}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {saveStatus && (
        <p
          className={`mt-2 text-sm ${
            saveStatus.startsWith("error") ? "text-red-600" : "text-neutral-700"
          }`}
        >
          {saveStatus}
        </p>
      )}
      {embedStatus && (
        <p
          className={`mt-2 text-sm ${
            embedStatus.startsWith("error") ? "text-red-600" : "text-neutral-700"
          }`}
        >
          {embedStatus}
        </p>
      )}
      {ocrStatus && (
        <p
          className={`mt-2 text-sm ${
            ocrStatus.startsWith("error") ? "text-red-600" : "text-neutral-700"
          }`}
        >
          {ocrStatus}
        </p>
      )}
      {linkStatus && (
        <p
          className={`mt-2 text-sm ${
            linkStatus.startsWith("error") ? "text-red-600" : "text-neutral-700"
          }`}
        >
          {linkStatus}
        </p>
      )}
      {chunkStatus && (
        <p
          className={`mt-2 text-sm ${
            chunkStatus.startsWith("error") ? "text-red-600" : "text-neutral-700"
          }`}
        >
          {chunkStatus}
        </p>
      )}

      <form onSubmit={onSearch} className="mt-8 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="semantic search…"
          className="flex-1 rounded border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
        />
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {searching ? "…" : "Search"}
        </button>
      </form>
      {searchError && (
        <p className="mt-2 text-sm text-red-600">{searchError}</p>
      )}
      {hits && hits.length === 0 && (
        <p className="mt-2 text-sm text-neutral-500">no results</p>
      )}
      {hits && hits.length > 0 && (
        <section className="mt-4 space-y-3">
          {hits.map((h) => (
            <div key={h.block_id} className="border-l-2 border-neutral-200 pl-3">
              <div>
                <span className="text-neutral-500">
                  {h.distance.toFixed(3)}
                </span>{" "}
                [{h.block_type ?? "?"}] {h.title ?? "Untitled"}{" "}
                <a
                  href={h.arena_url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-neutral-500 underline"
                >
                  (id {h.arena_block_id})
                </a>
              </div>
              {h.match_type === "chunk" && (
                <div className="text-neutral-500">
                  chunk {h.chunk_index ?? "?"}
                  {h.source_start_char !== undefined &&
                  h.source_end_char !== undefined
                    ? `, chars ${h.source_start_char}–${h.source_end_char}`
                    : ""}
                </div>
              )}
              {h.channel_title && (
                <div className="text-neutral-500">
                  in{" "}
                  {h.channel_url ? (
                    <a
                      href={h.channel_url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      {h.channel_title}
                    </a>
                  ) : (
                    h.channel_title
                  )}
                </div>
              )}
              {h.snippet && (
                <div className="mt-1 whitespace-pre-wrap text-neutral-700">
                  {h.snippet}
                </div>
              )}
              {h.source_url && (
                <a
                  href={h.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-blue-600 underline break-all"
                >
                  {h.source_url}
                </a>
              )}
            </div>
          ))}
        </section>
      )}

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
