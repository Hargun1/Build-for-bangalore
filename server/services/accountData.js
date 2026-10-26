const User = require("../models/User");
const HealthMetrics = require("../models/HealthMetrics");
const Prediction = require("../models/Prediction");
const FoodLog = require("../models/FoodLog");
const Appointment = require("../models/Appointment");
const EmergencyEvent = require("../models/EmergencyEvent");
const GroceryScan = require("../models/GroceryScan");
const LabReport = require("../models/LabReport");
const Reminder = require("../models/Reminder");
const PushSubscription = require("../models/PushSubscription");
const ExposomeData = require("../models/ExposomeData");
const { Goal, GoalCheckin } = require("../models/Goal");

const ACCOUNT_MODELS = [HealthMetrics, Prediction, FoodLog, Appointment, EmergencyEvent,
  GroceryScan, LabReport, Reminder, PushSubscription, ExposomeData, Goal, GoalCheckin];

async function deleteAccountData(userIds) {
  if (!userIds.length) return;
  await Promise.all(ACCOUNT_MODELS.map((Model) => Model.deleteMany({ userId: { $in: userIds } })));
}

// Recover records left by the old MongoDB user-only TTL or an interrupted deletion.
async function deleteOrphanedAccountData() {
  let removed = 0;
  for (const Model of ACCOUNT_MODELS) {
    const ids = await Model.distinct("userId");
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      const existing = await User.find({ _id: { $in: batch } }).select("_id").lean();
      const active = new Set(existing.map((user) => String(user._id)));
      const orphaned = batch.filter((id) => !active.has(String(id)));
      if (orphaned.length) removed += (await Model.deleteMany({ userId: { $in: orphaned } })).deletedCount;
    }
  }
  return removed;
}

module.exports = { deleteAccountData, deleteOrphanedAccountData };
