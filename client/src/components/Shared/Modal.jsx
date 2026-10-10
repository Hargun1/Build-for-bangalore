import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function Modal({ open, title, onClose, children, width }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    const prev = document.activeElement;
    ref.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="ui-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="ui-modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} style={width ? { width: `min(${width}px, 100%)` } : undefined}>
        <div className="ui-row" style={{ marginBottom: "0.75rem" }}>
          <h2>{title}</h2>
          <div className="ui-spacer" />
          <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
