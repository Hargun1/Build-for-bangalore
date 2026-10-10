const mongoose = require("mongoose");

// A saved grocery analysis: either items read from a photo (receipt, list, bag)
// or a single packaged product looked up by barcode on Open Food Facts.
const groceryScanSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    source: { type: String, enum: ["photo", "barcode"], required: true },
    items: [
      {
        name: String,
        category: String,
        processing: String, // whole, minimally processed, processed, ultra-processed
        verdict: String, // good, moderate, limit
        reason: String,
        barcode: String,
        nutriScore: String,
        novaGroup: Number,
      },
    ],
    score: Number,
    summary: String,
    aiSource: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("GroceryScan", groceryScanSchema);
