"use client";

import { useEffect, useMemo, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { Panel } from "@/components/dashboard/panel";
import { cn } from "@/lib/utils";

type IndexedChannel = {
  id: number;
  title: string | null;
  slug: string | null;
  url: string | null;
  block_count: number;
};

const CHANNELS_PER_PAGE = 3;

export function ChannelsCard({ className }: { className?: string }) {
  const [channels, setChannels] = useState<IndexedChannel[] | null>(null);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [selectedChannelIds, setSelectedChannelIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [page, setPage] = useState(0);

  async function loadChannels() {
    setChannelsLoading(true);
    setChannelsError(null);
    try {
      const res = await fetch("/api/channels");
      const body = (await res.json()) as
        | { channels: IndexedChannel[] }
        | { error: string };
      if (!res.ok || "error" in body) {
        const msg = "error" in body ? body.error : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      setChannels(body.channels);
      setPage(0);
      setSelectedChannelIds((prev) => {
        if (prev.size === 0) return prev;
        const available = new Set(body.channels.map((c) => c.id));
        const next = new Set<number>();
        for (const id of prev) {
          if (available.has(id)) next.add(id);
        }
        return next;
      });
    } catch (err) {
      setChannelsError(err instanceof Error ? err.message : String(err));
    } finally {
      setChannelsLoading(false);
    }
  }

  useEffect(() => {
    void loadChannels();
  }, []);

  const totalChannels = channels?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalChannels / CHANNELS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const visibleChannels = useMemo(() => {
    if (!channels) return [];
    const start = safePage * CHANNELS_PER_PAGE;
    return channels.slice(start, start + CHANNELS_PER_PAGE);
  }, [channels, safePage]);
  const totalBlocks = useMemo(
    () => channels?.reduce((sum, c) => sum + c.block_count, 0) ?? 0,
    [channels],
  );
  const showingStart =
    totalChannels === 0 ? 0 : safePage * CHANNELS_PER_PAGE + 1;
  const showingEnd = Math.min(
    totalChannels,
    (safePage + 1) * CHANNELS_PER_PAGE,
  );

  function onToggleChannel(id: number) {
    setSelectedChannelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onClearChannels() {
    setSelectedChannelIds(new Set());
  }

  return (
    <Panel className={cn("flex flex-col px-6 py-4", className)}>
      <h2 className="text-xl leading-5 font-bold text-neutral-800">Channels</h2>

      <div className="mt-4 h-px shrink-0 bg-stroke" />

      <div className="mt-4 flex min-h-0 flex-1 flex-col justify-between">
        {channelsError ? (
          <div className="text-sm text-error">
            Couldn&apos;t load channels: {channelsError}.{" "}
            <button type="button" onClick={loadChannels} className="underline">
              retry
            </button>
          </div>
        ) : channelsLoading && channels === null ? (
          <p className="text-sm text-black/50">Loading channels…</p>
        ) : channels !== null && channels.length === 0 ? (
          <p className="text-sm text-black/50">
            No channels indexed yet. Run Save above first.
          </p>
        ) : (
          <>
            <ChannelRow
              label="All channels"
              count={totalBlocks}
              selected={selectedChannelIds.size === 0}
              onClick={onClearChannels}
            />
            {visibleChannels.map((channel) => {
              const disabled = channel.block_count === 0;
              return (
                <ChannelRow
                  key={channel.id}
                  label={channel.title ?? "(untitled)"}
                  count={channel.block_count}
                  selected={selectedChannelIds.has(channel.id)}
                  disabled={disabled}
                  onClick={() => {
                    if (!disabled) onToggleChannel(channel.id);
                  }}
                />
              );
            })}
          </>
        )}
      </div>

      <div className="mt-4 h-px shrink-0 bg-stroke" />

      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-black/50">
        <p>
          Showing {showingStart}-{showingEnd} of {totalChannels} channels
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous channel page"
            disabled={safePage === 0 || totalChannels === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-base p-1 hover:bg-black/5 disabled:pointer-events-none disabled:opacity-30"
          >
            <CaretLeft size={16} />
          </button>
          <button
            type="button"
            aria-label="Next channel page"
            disabled={safePage >= totalPages - 1 || totalChannels === 0}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="rounded-base p-1 hover:bg-black/5 disabled:pointer-events-none disabled:opacity-30"
          >
            <CaretRight size={16} />
          </button>
        </div>
      </div>
    </Panel>
  );
}

function ChannelRow({
  label,
  count,
  selected,
  disabled = false,
  onClick,
}: {
  label: string;
  count: number;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-base py-1 text-left text-sm leading-5 transition-colors",
        selected
          ? "bg-neutral-800 text-white"
          : "text-neutral-800 hover:bg-black/5",
        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
      )}
    >
      <span className="min-w-0 max-w-[24ch] shrink overflow-hidden whitespace-nowrap">
        {truncateChannelLabel(label)}
      </span>
      <span className="shrink-0 tabular-nums">{count}</span>
    </button>
  );
}

function truncateChannelLabel(label: string): string {
  const chars = Array.from(label);
  if (chars.length <= 24) return label;
  return `${chars.slice(0, 21).join("")}...`;
}
