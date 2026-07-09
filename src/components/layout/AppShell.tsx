import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#eef1f7] text-slate-900">
      {children}
    </main>
  );
}
