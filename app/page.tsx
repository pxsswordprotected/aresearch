// Dashboard panel scaffold.
// Real content gets wired in panel-by-panel; this file owns the grid.
//
// Tweak in one place when real panels arrive:
const SIDEBAR_W = "w-[280px]"; // BrandCard + LeftSidebar share this width

import { Panel } from "@/components/dashboard/Panel";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col gap-12 p-page">
      {/* TOP BAR */}
      <div className="flex flex-row gap-12">
        <Panel name="BrandCard" className={`${SIDEBAR_W} min-h-[72px]`} />
        <div className="flex flex-1 flex-row gap-9">
          <Panel name="ProfileCard" className="min-h-[72px] flex-[1]" />
          <Panel name="SyncCard" className="min-h-[72px] flex-[1]" />
          <Panel name="SearchCard" className="min-h-[72px] flex-[2.3]" />
        </div>
      </div>

      {/* BODY */}
      {/* BODY — flex-1 so the bottom row reaches the 32px page margin. */}
      <div className="flex flex-1 flex-row gap-12">
        {/* LEFT SIDEBAR */}
        <div className={`flex flex-col gap-12 ${SIDEBAR_W}`}>
          <Panel name="ChannelsCard" className="h-[520px] shrink-0" />
          <Panel name="DeveloperPanelCard" className="flex-1" />
        </div>

        {/* MAIN CONTENT */}
        <div className="flex flex-1 flex-col gap-12">
          <Panel name="BlocksTableCard" className="h-[520px] w-full shrink-0" />
          <div className="flex w-full flex-1 flex-row">
            <Panel name="RecQueryInputCard" className="h-full flex-[1]" />
            <Panel
              name="RankingTableCard"
              className="h-full flex-[2] border-l border-stroke"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
