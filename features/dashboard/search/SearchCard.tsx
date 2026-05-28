"use client";

import { Suspense, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Image as ImageIcon,
  MagnifyingGlass,
} from "@phosphor-icons/react/dist/ssr";
import Button from "@/components/Button";
import { Panel } from "@/components/dashboard/panel";
import { QUERY_IMAGE_MAX_BYTES } from "@/lib/query-image-limits";
import { cn } from "@/lib/utils";

// Outer shell. Splits the param-reading subtree behind a Suspense
// boundary so useSearchParams doesn't de-opt the route to client-render
// at prerender time.
export function SearchCard({ className }: { className?: string }) {
  return (
    <Panel className={cn("flex items-center justify-center px-4", className)}>
      <Suspense fallback={<SearchForm initialQuery="" />}>
        <SearchFormFromParams />
      </Suspense>
    </Panel>
  );
}

function SearchFormFromParams() {
  const params = useSearchParams();
  return <SearchForm initialQuery={params.get("q") ?? ""} />;
}

function SearchForm({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [searching, setSearching] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const hasText = query.trim().length > 0;

  // Wrap the navigation in a transition so the underlying RSC fetch is
  // managed by React's transition lifecycle: errors propagate through
  // the Suspense / error-boundary chain instead of surfacing as raw
  // promise rejections at this call site (the cause of the dev-mode
  // "Failed to fetch" stack pointing here).
  const [, startTransition] = useTransition();

  function submitText(e: React.FormEvent) {
    e.preventDefault();
    if (!hasText) return;
    const next = `?q=${encodeURIComponent(query.trim())}`;
    startTransition(() => {
      router.replace(next, { scroll: false });
    });
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
        body: JSON.stringify({ image_data_url: dataUrl }),
      });
      const body = await res.json();
      if (!res.ok || "error" in body) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      // TODO: hand `body.hits` + `body.caption_meta` to a results card.
      // Image bytes don't fit in a URL, so this path stays on POST until
      // we ship upload-to-token. See plan §"Image search: defer".
      console.log("[SearchCard] image hits", body);
    } catch (err) {
      console.error("[SearchCard]", err);
    } finally {
      setSearching(false);
    }
  }

  return (
    <form onSubmit={submitText} className="flex w-full items-center gap-3">
      <button
        type="submit"
        aria-label="Search"
        disabled={!hasText}
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
