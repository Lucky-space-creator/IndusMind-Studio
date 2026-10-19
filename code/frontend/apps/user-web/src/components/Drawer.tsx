import { useEffect, type ReactNode } from "react";

export interface DrawerProps {
  open: boolean;
  title?: ReactNode;
  onClose: () => void;
  width?: number;
  children: ReactNode;
}

/** 侧滑抽屉（引用溯源原文；不打断上下文） */
export function Drawer({ open, title, onClose, width = 460, children }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[900]" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="关闭"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-slate-900/40"
      />
      <aside
        className="absolute right-0 top-0 flex h-full flex-col bg-white shadow-2xl"
        style={{ width: `min(${width}px, 92vw)`, borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h3 className="min-w-0 truncate text-[15px] font-semibold text-slate-800">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭抽屉"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>
  );
}