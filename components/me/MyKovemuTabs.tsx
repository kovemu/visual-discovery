"use client";

import { useState } from "react";

import MyKovemuPalette from "@/components/me/MyKovemuPalette";
import MyKovemuPicks from "@/components/me/MyKovemuPicks";
import MyKovemuVotes from "@/components/me/MyKovemuVotes";

type Tab = "picks" | "votes" | "palette";

const tabs: {
  id: Tab;
  label: string;
  soon?: boolean;
}[] = [
  {
    id: "picks",
    label: "Picks",
  },
  {
    id: "votes",
    label: "Votes",
  },
  {
    id: "palette",
    label: "My Palette",
    soon: true,
  },
];

export default function MyKovemuTabs() {
  const [activeTab, setActiveTab] =
    useState<Tab>("picks");

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-gray-200">
        {tabs.map((tab) => {
          const isActive =
            activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() =>
                setActiveTab(tab.id)
              }
              className={`-mb-px flex items-center gap-1.5 border-b-2 pb-3 text-sm transition ${
                isActive
                  ? "border-fuchsia-600 font-bold text-fuchsia-600"
                  : "border-transparent font-bold text-gray-500 hover:text-gray-900"
              }`}
            >
              {tab.label}
              {tab.soon && (
                <span className="rounded-full bg-fuchsia-50 px-1.5 py-0.5 text-[10px] font-semibold text-fuchsia-500">
                  Soon
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-10">
        {activeTab === "picks" && (
          <MyKovemuPicks />
        )}
        {activeTab === "votes" && (
          <MyKovemuVotes />
        )}
        {activeTab === "palette" && (
          <MyKovemuPalette />
        )}
      </div>
    </div>
  );
}
