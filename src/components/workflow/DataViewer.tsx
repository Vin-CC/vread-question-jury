import { AlertTriangle, Braces, FileText, List } from "lucide-react";
import { toUserFacingAiValue } from "@/lib/ai/display";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function DataViewer({
  value,
  emptyMessage,
  error,
}: {
  value: unknown;
  emptyMessage: string;
  error?: string;
}) {
  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
        <div className="mb-2 flex items-center gap-2 font-bold">
          <AlertTriangle className="h-4 w-4" />
          Step error
        </div>
        {error}
      </div>
    );
  }

  if (value === undefined || value === null) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  if (typeof value === "string") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 flex items-center justify-between text-xs font-black uppercase text-slate-400">
          <span className="inline-flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" />
            Text
          </span>
          <span>{value.length.toLocaleString()} chars</span>
        </div>
        <div className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-sm leading-relaxed text-slate-700">
          {value}
        </div>
      </div>
    );
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        <div className="mb-2 text-xs font-black uppercase text-slate-400">Primitive</div>
        <code>{String(value)}</code>
      </div>
    );
  }

  if (Array.isArray(value)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 flex items-center justify-between text-xs font-black uppercase text-slate-400">
          <span className="inline-flex items-center gap-2">
            <List className="h-3.5 w-3.5" />
            Array
          </span>
          <span>{value.length.toLocaleString()} item{value.length === 1 ? "" : "s"}</span>
        </div>
        <pre className="max-h-[360px] overflow-auto rounded-xl bg-white p-3 text-xs leading-relaxed text-slate-700">
          {JSON.stringify(toUserFacingAiValue(value), null, 2)}
        </pre>
      </div>
    );
  }

  if (isPlainObject(value)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 flex items-center justify-between text-xs font-black uppercase text-slate-400">
          <span className="inline-flex items-center gap-2">
            <Braces className="h-3.5 w-3.5" />
            Object
          </span>
          <span>{Object.keys(value).length.toLocaleString()} keys</span>
        </div>
        <pre className="max-h-[360px] overflow-auto rounded-xl bg-white p-3 text-xs leading-relaxed text-slate-700">
          {JSON.stringify(toUserFacingAiValue(value), null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <pre className="max-h-[360px] overflow-auto rounded-2xl border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-700">
      {JSON.stringify(toUserFacingAiValue(value), null, 2)}
    </pre>
  );
}
