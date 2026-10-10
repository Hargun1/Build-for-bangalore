import { useRef, useState } from "react";
import { resizeImage } from "../../utils/image";

/** Drop zone + file/camera picker that hands back a resized JPEG data URI. */
export default function PhotoPicker({ onPicked, title, hint, disabled }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  const handle = async (file) => {
    setError("");
    try {
      onPicked(await resizeImage(file));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div
        className={`ui-dropzone ${dragging ? "dragging" : ""}`}
        role="button"
        tabIndex={0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files[0]) handle(e.dataTransfer.files[0]);
        }}
      >
        <div style={{ fontSize: "2rem" }} aria-hidden="true">📷</div>
        <p style={{ fontWeight: 600, marginTop: "0.4rem" }}>{title}</p>
        <p className="ui-faint">{hint}</p>
        <span className="ui-btn ui-btn-sm" style={{ marginTop: "0.8rem" }}>Take or choose a photo</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          if (e.target.files[0]) handle(e.target.files[0]);
          e.target.value = "";
        }}
      />
      {error && <div className="ui-alert ui-alert-error" style={{ marginTop: "0.6rem" }}>{error}</div>}
    </div>
  );
}
