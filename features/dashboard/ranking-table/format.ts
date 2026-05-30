import type { RecChannel } from "../recommendations/types";

export function formatEvidence(channel: RecChannel): string {
  const first = channel.top_blocks[0];
  const firstTitle = first?.title?.trim() || "Untitled";
  const hiddenCount = Math.max(0, channel.top_blocks.length - 1);
  const blockNoun = channel.block_count === 1 ? "block" : "blocks";
  return `${channel.block_count} ${blockNoun} | ${firstTitle}${hiddenCount > 0 ? ` +${hiddenCount}` : ""}`;
}

export function formatChannelTitle(title: string | null): string {
  return title?.trim() || "Untitled";
}
