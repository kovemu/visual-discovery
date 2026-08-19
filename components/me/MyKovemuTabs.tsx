"use client";

import { useState } from "react";

import MyKovemuPicks from "@/components/me/MyKovemuPicks";
import MyKovemuVotes from "@/components/me/MyKovemuVotes";

const tabs = ["Picks", "Votes"] as const;

type Tab = (typeof tabs)[number];

export default function MyKovemuTabs() {
  const [activeTab, setActiveTab] =
    useState<Tab>("Picks");

  return (
    <div className="mt-8">
      <div className="flex items-center gap-6 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() =>
              setActiveTab(tab)
            }
            className={`-mb-px border-b-2 pb-3 text-sm font-bold transition ${
              activeTab === tab
                ? "border-fuchsia-600 text-fuchsia-600"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mt-10">
        {activeTab === "Picks" ? (
          <MyKovemuPicks />
        ) : (
          <MyKovemuVotes />
        )}
      </div>
    </div>
  );
}
