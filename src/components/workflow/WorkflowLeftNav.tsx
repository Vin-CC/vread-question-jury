import { CircleHelp, FileText, Gavel, LayoutGrid, Settings, Upload, Workflow } from "lucide-react";
import { clsx } from "clsx";

const navItems = [
  { label: "Workflow", icon: Workflow, active: true },
  { label: "Documents", icon: FileText },
  { label: "Jury", icon: Gavel },
  { label: "Exports", icon: Upload },
  { label: "Settings", icon: Settings },
  { label: "Help", icon: CircleHelp },
];

export function WorkflowLeftNav() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-[72px] flex-col items-center bg-gradient-to-b from-violet-700 via-purple-700 to-indigo-800 py-4 text-white shadow-2xl">
      <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-xl font-black text-violet-700 shadow-lg">
        V
      </div>
      <nav className="flex flex-1 flex-col items-center gap-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              title={item.label}
              className={clsx(
                "group flex h-[58px] w-[58px] flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-semibold transition",
                item.active
                  ? "bg-white text-violet-700 shadow-lg"
                  : "text-white/80 hover:bg-white/15 hover:text-white"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="max-w-[50px] truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>
      <button
        type="button"
        title="Apps"
        className="mt-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white/85 transition hover:bg-white/20 hover:text-white"
      >
        <LayoutGrid className="h-5 w-5" />
      </button>
    </aside>
  );
}
