const mongoose = require("mongoose");

// Raw OpenStreetMap results per ~1 km grid cell + radius + kinds. Hospitals and clinics
// rarely move, so a result stays fresh for 7 days and is kept 30 days as a fallback for
// when the public Overpass servers are overloaded.
const placeCacheSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  elements: { type: mongoose.Schema.Types.Mixed, default: [] },
  fetchedAt: { type: Date, default: Date.now },
});
placeCacheSchema.index({ fetchedAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

module.exports = mongoose.model("PlaceCache", placeCacheSchema);
