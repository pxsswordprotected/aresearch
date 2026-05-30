"use client";

import { useCallback, useState } from "react";
import { BlocksTableCard } from "@/features/dashboard/blocks-table/BlocksTableCard";
import { BrandCard } from "@/features/dashboard/brand/BrandCard";
import { ChannelsCard } from "@/features/dashboard/channels/ChannelsCard";
import type { ChannelSummary } from "@/features/dashboard/channels/types";
import { DeveloperPanelCard } from "@/features/dashboard/developer-panel/DeveloperPanelCard";
import { SIDEBAR_W } from "@/features/dashboard/layout";
import { ProfileCard } from "@/features/dashboard/profile/ProfileCard";
import { RankingTableCard } from "@/features/dashboard/ranking-table/RankingTableCard";
import { RecQueryInputCard } from "@/features/dashboard/rec-query-input/RecQueryInputCard";
import type { RecommendationState } from "@/features/dashboard/recommendations/types";
import { SearchCard } from "@/features/dashboard/search/SearchCard";
import { SyncCard } from "@/features/dashboard/sync/SyncCard";

export function Dashboard() {
  const [selectedChannels, setSelectedChannels] = useState<ChannelSummary[]>(
    [],
  );

  const [recommendation, setRecommendation] = useState<RecommendationState>({
    status: "idle",
  });
  const onChannelSelectionChange = useCallback((channels: ChannelSummary[]) => {
    setSelectedChannels(channels);
  }, []);

  return (
    <main className="flex min-h-screen flex-col gap-12 p-page">
      {/* TOP BAR */}
      <div className="flex flex-row gap-12">
        <BrandCard className={`${SIDEBAR_W} min-h-[72px]`} />
        <div className="flex flex-1 flex-row gap-9">
          <ProfileCard className="min-h-[72px] flex-[1]" />
          <SyncCard className="min-h-[72px] flex-[1]" />
          <SearchCard className="min-h-[72px] flex-[2.3]" />
        </div>
      </div>

      {/* BODY — flex-1 so the bottom row reaches the 32px page margin. */}
      <div className="flex flex-1 flex-row gap-12">
        {/* LEFT SIDEBAR */}
        <div className={`flex flex-col gap-12 ${SIDEBAR_W}`}>
          <ChannelsCard
            className="h-[520px] shrink-0"
            onSelectionChange={onChannelSelectionChange}
          />
          <DeveloperPanelCard className="flex-1" />
        </div>

        {/* MAIN CONTENT */}
        <div className="flex flex-1 flex-col gap-12">
          <BlocksTableCard
            className="h-[520px] w-full shrink-0"
            selectedChannels={selectedChannels}
          />
          <div className="flex w-full flex-1 flex-row">
            <RecQueryInputCard
              className="h-full flex-[1] rounded-r-none border-r-0"
              onStateChange={setRecommendation}
            />
            <RankingTableCard
              className="h-full flex-[2] rounded-l-none"
              recommendation={recommendation}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
