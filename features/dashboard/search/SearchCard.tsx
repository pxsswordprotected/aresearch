"use client";

import { useRef, useState } from "react";
import {
  Image as ImageIcon,
  MagnifyingGlass,
} from "@phosphor-icons/react/dist/ssr";
import Button from "@/components/Button";
import { Panel } from "@/components/dashboard/panel";
import { QUERY_IMAGE_MAX_BYTES } from "@/lib/query-image-limits";
import { cn } from "@/lib/utils";

export function SearchCard({ className }: { className?: string }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const hasText = query.trim().length > 0;

  // Future ChannelsCard integration point. When channel selection lifts into
  // the dashboard (prop from `app/page.tsx` or a context), have these read it
  // and return `&channels=<ids>` / `{ channels: [ids] }`. Today they're no-ops.
  function channelParam(): string {
    return "";
  }
  function channelBody(): { channels?: number[] } {
    return {};
  }

  async function submitText(e: React.FormEvent) {
    e.preventDefault();
    if (!hasText || searching) return;
    setSearching(true);
    try {
      const url = `/api/search?q=${encodeURIComponent(query.trim())}${channelParam()}`;
      const res = await fetch(url);
      const body = await res.json();
      if (!res.ok || "error" in body) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      // TODO: hand `body.hits` to a results card.
      console.log("[SearchCard] text hits", body);
    } catch (err) {
      console.error("[SearchCard]", err);
    } finally {
      setSearching(false);
    }
  }

  async function submitImage(file: File) {
    if (!file.type.startsWith("image/")) return;
    if (file.size > QUERY_IMAGE_MAX_BYTES) {
      console.error("[SearchCard] image too large");
      return;
    }
    setSearching(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await fetch(`/api/search`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image_data_url: dataUrl, ...channelBody() }),
      });
      const body = await res.json();
      if (!res.ok || "error" in body) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      // TODO: hand `body.hits` + `body.caption_meta` to a results card.
      console.log("[SearchCard] image hits", body);
    } catch (err) {
      console.error("[SearchCard]", err);
    } finally {
      setSearching(false);
    }
  }

  return (
    <Panel className={cn("flex items-center justify-center px-4", className)}>
      <form onSubmit={submitText} className="flex w-full items-center gap-3">
        <button
          type="submit"
          aria-label="Search"
          disabled={!hasText || searching}
          className={cn(
            "shrink-0",
            hasText ? "text-neutral-800" : "text-black/50",
          )}
        >
          <MagnifyingGlass size={26} />
        </button>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          className="flex-1 bg-transparent text-neutral-800 outline-none placeholder:text-black/50"
        />
        <Button
          type="button"
          aria-label="Search by image"
          disabled={searching}
          onClick={() => fileRef.current?.click()}
          className="flex items-center justify-center px-0 py-0 w-9 h-9"
        >
          <ImageIcon size={26} />
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void submitImage(file);
          }}
        />
      </form>
    </Panel>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      if (typeof r === "string") resolve(r);
      else reject(new Error("FileReader produced non-string result"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}
