// Offline counterpart to ai-service/app/risk.py. Keep the two implementations
// aligned with cross-service parity fixtures whenever a scoring rule changes.
const score = (key, label, method, unit = "") => ({
  key, label, method, value: null, unit, percent: null, level: "unknown", factors: [], missing: [], note: "",
});
const factor = (name, detail, points = null) => ({ name, points, detail });
const round = (value, digits = 0) => {
  const multiplier = 10 ** digits;
  const scaled = value * multiplier;
  const lower = Math.floor(scaled);
  return (scaled - lower === 0.5 ? (lower % 2 === 0 ? lower : lower + 1) : Math.round(scaled)) / multiplier;
};
const bounded = (value, min, max) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null;
const optionalBool = (value) => typeof value === "boolean" ? value : null;

function inputsOf(raw) {
  const i = raw || {};
  return {
    age: bounded(i.age, 1, 120),
    sex: ["male", "female", "other"].includes(i.sex) ? i.sex : null,
    heightCm: bounded(i.heightCm, 50, 250),
    weightKg: bounded(i.weightKg, 10, 400),
    waistCm: bounded(i.waistCm, 30, 250),
    activityLevel: ["sedentary", "mild", "moderate", "vigorous"].includes(i.activityLevel) ? i.activityLevel : null,
    familyHistoryDiabetes: ["none", "one_parent", "both_parents"].includes(i.familyHistoryDiabetes) ? i.familyHistoryDiabetes : null,
    smoker: optionalBool(i.smoker),
    hasDiabetes: optionalBool(i.hasDiabetes),
    onBpMedication: optionalBool(i.onBpMedication),
    systolic: bounded(i.systolic, 50, 260),
    diastolic: bounded(i.diastolic, 30, 180),
    avgSleepHours: bounded(i.avgSleepHours, 0, 24),
    avgSteps: bounded(i.avgSteps, 0, 100000),
    avgStress: bounded(i.avgStress, 0, 10),
    daysLogged: bounded(i.daysLogged, 0, 365) ?? 0,
  };
}

function idrs(i) {
  const s = score("diabetes", "Type 2 diabetes risk", "Indian Diabetes Risk Score (Mohan et al., 2005)", "points / 100");
  if (i.hasDiabetes) {
    s.note = "You have told us you already have diabetes. IDRS screens for undiagnosed diabetes, so it does not apply.";
    return s;
  }
  let total = 0;
  if (i.age == null) s.missing.push("date of birth");
  else {
    const points = i.age < 35 ? 0 : i.age < 50 ? 20 : 30;
    s.factors.push(factor("Age", `${i.age} years`, points));
    total += points;
  }
  if (i.waistCm == null || !["male", "female"].includes(i.sex)) {
    s.missing.push(i.waistCm == null ? "waist circumference" : "sex (male/female) for waist cut-offs");
  } else {
    const [lo, hi] = i.sex === "male" ? [90, 100] : [80, 90];
    const points = i.waistCm < lo ? 0 : i.waistCm < hi ? 10 : 20;
    s.factors.push(factor("Waist", `${i.waistCm} cm (cut-offs ${lo}/${hi} cm)`, points));
    total += points;
  }
  if (i.activityLevel == null) s.missing.push("physical activity level");
  else {
    const points = { vigorous: 0, moderate: 10, mild: 20, sedentary: 30 }[i.activityLevel];
    s.factors.push(factor("Physical activity", i.activityLevel, points));
    total += points;
  }
  if (i.familyHistoryDiabetes == null) s.missing.push("family history of diabetes");
  else {
    const points = { none: 0, one_parent: 10, both_parents: 20 }[i.familyHistoryDiabetes];
    s.factors.push(factor("Family history", i.familyHistoryDiabetes.replaceAll("_", " "), points));
    total += points;
  }
  s.value = total;
  if (s.missing.length) s.note = "Partial score: add the missing details for a valid result.";
  else {
    s.percent = total;
    s.level = total < 30 ? "low" : total < 60 ? "moderate" : "high";
  }
  return s;
}

const framingham = {
  male: [3.11296, 0.79277, 1.85508, 1.92672, 0.70953, 0.53160, 0.88431, 23.9388],
  female: [2.72107, 0.51125, 2.81291, 2.88267, 0.61868, 0.77763, 0.94833, 26.0145],
};

function cardio(i) {
  const s = score("heart", "10-year heart & stroke risk", "Framingham general CVD risk, BMI model (D'Agostino et al., 2008)", "%");
  if (i.age == null) s.missing.push("date of birth");
  if (!framingham[i.sex]) s.missing.push("sex (male/female); the model has separate equations");
  const bmi = i.heightCm && i.weightKg ? i.weightKg / (i.heightCm / 100) ** 2 : null;
  if (bmi == null) s.missing.push("height and weight");
  if (i.systolic == null) s.missing.push("a blood pressure reading");
  if (i.smoker == null) s.missing.push("smoking status");
  if (s.missing.length) {
    s.note = "Add the missing details to calculate this score.";
    return s;
  }
  if (i.age < 30 || i.age > 74) {
    s.note = "The Framingham model is validated for ages 30 to 74 only.";
    return s;
  }
  const [ageC, bmiC, untreatedC, treatedC, smokerC, diabeticC, survival, mean] = framingham[i.sex];
  const treated = Boolean(i.onBpMedication);
  const diabetic = Boolean(i.hasDiabetes);
  const terms = ageC * Math.log(i.age) + bmiC * Math.log(bmi) + (treated ? treatedC : untreatedC) * Math.log(i.systolic)
    + smokerC * Number(i.smoker) + diabeticC * Number(diabetic);
  const risk = (1 - survival ** Math.exp(terms - mean)) * 100;
  const heartAge = Math.exp((terms - bmiC * Math.log(22.5) - untreatedC * Math.log(125)) / ageC);
  s.value = round(risk, 1);
  s.percent = round(Math.min(risk, 100), 1);
  s.level = risk < 10 ? "low" : risk < 20 ? "moderate" : "high";
  s.factors = [
    factor("Age", `${i.age} years`),
    factor("Blood pressure", `${round(i.systolic)} mmHg systolic${treated ? " (on treatment)" : ""}`),
    factor("BMI", bmi.toFixed(1)),
    factor("Smoking", i.smoker ? "yes" : "no"),
    factor("Diabetes", diabetic ? "yes" : "no"),
    factor("Heart age", `${round(heartAge)} years vs your age ${i.age}`, round(Math.max(30, Math.min(heartAge, 100)))),
  ];
  if (i.onBpMedication == null) s.note = "Assumed you are not on blood-pressure medicine; update your profile if you are.";
  return s;
}

function weight(i) {
  const s = score("weight", "Body weight", "BMI with WHO Asia-Pacific cut-offs; waist-to-height ratio", "kg/m\u00b2");
  if (!i.heightCm || !i.weightKg) {
    s.missing = ["height and weight"];
    return s;
  }
  const bmi = i.weightKg / (i.heightCm / 100) ** 2;
  s.value = round(bmi, 1);
  let category;
  if (bmi < 18.5) [category, s.level] = ["underweight", "moderate"];
  else if (bmi < 23) [category, s.level] = ["normal", "low"];
  else if (bmi < 25) [category, s.level] = ["overweight (at risk)", "moderate"];
  else [category, s.level] = ["obese (Asian cut-off)", "high"];
  s.percent = round(Math.max(0, Math.min(100, (bmi - 15) / 20 * 100)));
  s.factors = [factor("BMI category", `${bmi.toFixed(1)} = ${category}`)];
  if (i.waistCm && i.heightCm) {
    const ratio = i.waistCm / i.heightCm;
    s.factors.push(factor("Waist-to-height", ratio >= 0.5 ? "central obesity" : "healthy (< 0.5)", round(ratio, 2)));
    if (ratio >= 0.5 && s.level === "low") {
      s.level = "moderate";
      s.note = "Normal BMI but fat stored around the waist, which still raises metabolic risk.";
    }
  }
  return s;
}

function bloodPressure(i) {
  const s = score("bloodPressure", "Blood pressure", "2017 ACC/AHA blood pressure categories", "mmHg");
  if (i.systolic == null || i.diastolic == null) {
    s.missing = ["a blood pressure reading"];
    return s;
  }
  const sys = i.systolic;
  const dia = i.diastolic;
  s.value = round(sys);
  let category;
  if (sys > 180 || dia > 120) {
    [category, s.level] = ["hypertensive crisis: seek care now", "high"];
    s.note = "Repeat the reading after at least 1 minute. If it is still this high, contact a health professional as soon as possible. With chest pain, breathlessness, weakness, vision changes or trouble speaking, call 112 now.";
  }
  else if (sys >= 140 || dia >= 90) [category, s.level] = ["stage 2 hypertension", "high"];
  else if (sys >= 130 || dia >= 80) [category, s.level] = ["stage 1 hypertension", "moderate"];
  else if (sys >= 120) [category, s.level] = ["elevated", "moderate"];
  else [category, s.level] = ["normal", "low"];
  s.percent = round(Math.max(0, Math.min(100, (sys - 90) / 90 * 100)));
  s.factors = [factor("Category", `${round(sys)}/${round(dia)} = ${category}`)];
  return s;
}

function sleep(i) {
  const s = score("sleep", "Sleep", "Adults need 7-9 h (AASM/SRS consensus, 2015)", "h/night");
  if (i.avgSleepHours == null) {
    s.missing = ["sleep logs"];
    return s;
  }
  const h = i.avgSleepHours;
  s.value = round(h, 1);
  s.level = h >= 7 && h <= 9 ? "low" : h >= 6 && h < 7 || h > 9 && h <= 10 ? "moderate" : "high";
  s.percent = round(Math.max(0, Math.min(100, h / 10 * 100)));
  s.factors = [factor("Average", `${h.toFixed(1)} h over ${i.daysLogged} logged day(s)`)];
  return s;
}

function activity(i) {
  const s = score("activity", "Physical activity", "Daily step bands (Tudor-Locke & Bassett, 2004)", "steps/day");
  if (i.avgSteps == null) {
    s.missing = ["step logs"];
    return s;
  }
  const steps = i.avgSteps;
  s.value = round(steps);
  let band;
  if (steps < 5000) [band, s.level] = ["sedentary", "high"];
  else if (steps < 7500) [band, s.level] = ["low active", "moderate"];
  else if (steps < 10000) [band, s.level] = ["somewhat active", "low"];
  else [band, s.level] = ["active", "low"];
  s.percent = round(Math.min(100, steps / 10000 * 100));
  s.factors = [factor("Average", `${steps.toLocaleString("en-US", { maximumFractionDigits: 0 })} steps/day = ${band}`)];
  return s;
}

function stress(i) {
  const s = score("stress", "Stress", "Your own 0-10 rating (not a clinical scale)", "/10");
  if (i.avgStress == null) {
    s.missing = ["stress ratings"];
    return s;
  }
  s.value = round(i.avgStress, 1);
  s.level = i.avgStress <= 3 ? "low" : i.avgStress <= 6 ? "moderate" : "high";
  s.percent = round(i.avgStress * 10);
  return s;
}

function assessRiskRules(raw) {
  const i = inputsOf(raw);
  const scores = [idrs(i), cardio(i), weight(i), bloodPressure(i), sleep(i), activity(i), stress(i)];
  const points = { low: 100, moderate: 60, high: 25 };
  const known = scores.filter((s) => points[s.level] != null);
  const wellnessScore = known.length ? round(known.reduce((sum, s) => sum + points[s.level], 0) / known.length) : null;
  const flagged = scores.filter((s) => s.level === "high" || s.level === "moderate");
  flagged.sort((a, b) => (a.level === "high" ? 0 : 1) - (b.level === "high" ? 0 : 1));
  const summary = flagged.length
    ? `Your scores point to ${flagged.slice(0, 3).map((s) => s.label.toLowerCase()).join(", ")} as the areas to work on first. These are screening estimates, not a diagnosis.`
    : known.length ? known.length < scores.length
      ? "The scores we could calculate are low risk, but some could not be calculated. Add the missing details for a fuller screening estimate."
      : "Everything we could score looks healthy. Keep logging your daily numbers so we can spot changes early."
      : "There is not enough information to calculate a risk score yet. Add your health details and readings first.";
  return { scores, wellnessScore, summary, recommendations: [], aiSource: "rules" };
}

module.exports = { assessRiskRules };
