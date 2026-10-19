import { useEffect, useState } from "react";

export type ToastKind = "info" | "success" | "error" | "warning";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

type Listener = (items: ToastItem[]) => void;

let items: ToastItem[] = [];
const listeners = new Set<Listener>();
let seq = 0;

function emit() {
  for (const l of listeners) l([...items]);
}

export function showToast(message: string, kind: ToastKind = "info") {
  const id = ++seq;
  items = [...items, { id, kind, message }];
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, 3600);
}

const KIND_STYLE: Record<ToastKind, string> = {
  info: "border-sky-300 bg-sky-50 text-sky-900",
  success: "border-emerald-300 bg-emerald-50 text-emerald-900",
  error: "border-red-300 bg-red-50 text-red-900",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
};

/** 轻量 Toast 容器（替代 AntD message；挂在应用根部） */
export function ToastHost() {
  const [list, setList] = useState<ToastItem[]>(items);
  useEffect(() => {
    const l: Listener = (next) => setList(next);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 top-4 z-[999] flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4"
    >
      {list.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto rounded-md border px-4 py-2.5 text-sm shadow-md ${KIND_STYLE[t.kind]}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}