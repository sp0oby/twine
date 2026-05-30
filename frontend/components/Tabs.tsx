"use client";

import {useState} from "react";

export type TabDef = {id: string; label: string};

export function Tabs({tabs, panels}: {tabs: TabDef[]; panels: Record<string, React.ReactNode>}) {
  const [active, setActive] = useState(tabs[0]?.id);

  return (
    <div>
      <div role="tablist" className="flex items-baseline gap-7 border-b border-line">
        {tabs.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.id)}
              className={`pb-3 -mb-px font-mono text-[11px] uppercase tracking-[0.22em] transition-colors border-b ${
                isActive ? "text-white border-white" : "text-muted hover:text-ink border-transparent"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="mt-10">{active ? panels[active] : null}</div>
    </div>
  );
}
