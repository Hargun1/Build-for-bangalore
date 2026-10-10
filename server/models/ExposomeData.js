const mongoose = require("mongoose");

// Hourly snapshot of the user's environment (at most one per hour), for the 7-day history chart.
const exposomeDataSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    hour: { type: String, required: true }, // "YYYY-MM-DDTHH" local time
    aqi: Number,
    aqiCategory: String,
    dominantPollutant: String,
    pm25: Number,
    temp: Number,
    feelsLike: Number,
    uvIndex: Number,
    area: String,
    city: String,
  },
  { timestamps: true }
);

exposomeDataSchema.index({ userId: 1, hour: -1 }, { unique: true });

module.exports = mongoose.model("ExposomeData", exposomeDataSchema);
