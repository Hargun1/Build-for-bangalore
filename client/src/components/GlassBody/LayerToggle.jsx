const layers = [
  { key: "skeleton", label: "Skeleton", icon: "🦴" },
  { key: "muscles", label: "Muscles", icon: "💪" },
  { key: "organs", label: "Organs", icon: "🫀" },
];

/** Show/hide the skeleton, muscle and organ layers of the 3D body. */
export default function LayerToggle({ activeLayers, onToggle }) {
  return (
    <div className="gb-layers gb-glass" role="group" aria-label="Body layers">
      <div className="gb-eyebrow">Layers</div>
      {layers.map((layer) => {
        const on = activeLayers[layer.key];
        return (
          <button key={layer.key} type="button" className={`gb-layer ${on ? "on" : ""}`} aria-pressed={on} onClick={() => onToggle(layer.key)}>
            <span aria-hidden="true">{layer.icon}</span>
            <span>{layer.label}</span>
            <span className="gb-switch" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
