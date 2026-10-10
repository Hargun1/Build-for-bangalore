const mongoose = require("mongoose");

const foodItemSchema = new mongoose.Schema(
  {
    name: String,
    portion: String,
    grams: Number,
    calories: Number,
    proteinG: Number,
    carbsG: Number,
    fatG: Number,
    fiberG: Number,
    sugarG: Number,
    sodiumMg: Number,
  },
  { _id: false }
);

// A meal the user chose to log after analysing a photo (or from a barcode product).
const foodLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    mealType: { type: String, enum: ["breakfast", "lunch", "dinner", "snack"], default: "snack" },
    title: { type: String, maxlength: 120 },
    items: [foodItemSchema],
    totals: {
      calories: Number,
      proteinG: Number,
      carbsG: Number,
      fatG: Number,
      fiberG: Number,
      sugarG: Number,
      sodiumMg: Number,
    },
    healthScore: Number,
    source: { type: String, enum: ["photo", "barcode", "manual"], default: "photo" },
  },
  { timestamps: true }
);

foodLogSchema.index({ userId: 1, day: -1 });

module.exports = mongoose.model("FoodLog", foodLogSchema);
