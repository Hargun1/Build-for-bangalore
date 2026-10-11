const mongoose = require("mongoose");

// A saved lab report. Rows are stored as checked by the AI service's lab code
// (status, range used, standard unit), so trends never re-ask the AI.
const testSchema = new mongoose.Schema(
  {
    name: String,
    key: String, // catalogue key, e.g. "hba1c"; null for tests outside the catalogue
    display: String,
    group: String,
    valueText: String,
    value: Number,
    unit: String,
    refRange: String,
    status: { type: String, enum: ["normal", "high", "low", "check", "unknown"] },
    rangeSource: String, // "report" or "standard"
    low: Number,
    high: Number,
    standardValue: Number,
    standardUnit: String,
    critical: Boolean,
    band: String,
    note: String,
    organs: [String],
    url: String,
    meaning: String,
    source: { title: String, url: String, text: String },
  },
  { _id: false }
);

const labReportSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reportDate: { type: String, required: true }, // YYYY-MM-DD, as printed on the report
    labName: String,
    tests: [testSchema],
    counts: { normal: Number, high: Number, low: Number, check: Number, unknown: Number },
    summary: String,
    aiSource: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("LabReport", labReportSchema);
