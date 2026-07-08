import type { ReactNode } from "react";
import { WorkflowLeftNav } from "@/components/workflow/WorkflowLeftNav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#eef1f7] text-slate-900">
      <WorkflowLeftNav />
      <div className="min-h-screen pl-[72px]">
        {children}
      </div>
    </main>
  );
}
