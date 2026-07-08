"use client";

import { useState } from "react";
import { CircleHelp, FileText, Gavel, Menu, Settings, Upload, Workflow, X } from "lucide-react";
import { clsx } from "clsx";

const navItems = [
  { label: "Workflow", icon: Workflow, active: true },
  { label: "Document", icon: FileText },
  { label: "Jury", icon: Gavel },
  { label: "Export", icon: Upload },
  { label: "Settings", icon: Settings },
  { label: "Help", icon: CircleHelp },
];

export function WorkflowLeftNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed left-4 top-4 z-[80]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-700 to-indigo-700 text-white shadow-[0_16px_40px_rgba(79,70,229,0.28)] transition hover:scale-105"
        aria-label={open ? "Close VREAD menu" : "Open VREAD menu"}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <div className="mt-3 w-56 rounded-[24px] border border-white/80 bg-white/95 p-2 shadow-[0_24px_70px_rgba(15,23,42,0.18)] backdrop-blur">
          <div className="mb-2 flex items-center gap-3 rounded-2xl bg-violet-50 p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-700 text-lg font-black text-white">
              V
            </div>
            <div>
              <div className="text-sm font-black text-slate-950">VREAD</div>
              <div className="text-xs font-semibold text-slate-500">Scenario menu</div>
            </div>
          </div>
          <nav className="grid gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  className={clsx(
                    "flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-bold transition",
                    item.active
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 hover:text-violet-700"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}
