import { useEffect, useState } from "react";
import { getExposomeHistory, getPredictions, getToday } from "../../services/healthService";

// 3D colour intensity per risk level; null means "no data" (shown neutral blue).
const LEVEL_RISK = { low: 0.2, moderate: 0.55, high: 0.85 };
const worst = (...levels) => {
  const known = levels.filter((l) => LEVEL_RISK[l] != null);
  return known.length ? Math.max(...known.map((l) => LEVEL_RISK[l])) : null;
};
const aqiRisk = (aqi) => (aqi == null ? null : aqi <= 100 ? 0.2 : aqi <= 200 ? 0.55 : 0.85);

const row = (label, value, level, hint) => ({ label, value, level, hint });

/**
 * Loads the user's latest risk assessment, 7-day averages and air-quality snapshot,
 * and maps them onto organs. Nothing here is invented: an organ without data says so.
 */
export function useOrganInsights() {
  const [state, setState] = useState({ loading: true, riskScores: {}, organs: {} });

  useEffect(() => {
    let alive = true;
    (async () => {
      const [pred, today, env] = await Promise.all([
        getPredictions(1).then((r) => r.data[0]).catch(() => null),
        getToday().then((r) => r.data).catch(() => null),
        getExposomeHistory().then((r) => r.data.at(-1)).catch(() => null),
      ]);
      if (!alive) return;
      const s = Object.fromEntries((pred?.scores || []).map((x) => [x.key, x]));
      const avg = today?.averages || {};
      const lvl = (k) => (s[k] && s[k].level !== "unknown" ? s[k].level : null);
      const heartAge = s.heart?.factors?.find((f) => f.name === "Heart age");

      const bpRow = avg.systolic != null ? row("Blood pressure (7-day avg)", `${avg.systolic}/${avg.diastolic ?? "?"} mmHg`, lvl("bloodPressure")) : row("Blood pressure", "not logged", null, "Log a reading on the dashboard");
      const diabetesRow = s.diabetes?.level && s.diabetes.level !== "unknown" ? row("Diabetes risk (IDRS)", `${s.diabetes.value}/100`, s.diabetes.level) : row("Diabetes risk", "not calculated", null, "Complete your profile and run the analysis");

      const organs = {
        heart: [
          s.heart?.level && s.heart.level !== "unknown" ? row("10-year heart & stroke risk", `${s.heart.value}%`, s.heart.level) : row("10-year heart risk", "not calculated", null, "Needs age, sex, height, weight, BP and smoking status"),
          heartAge ? row("Heart age", `${heartAge.points} years`, null) : null,
          bpRow,
          avg.restingHeartRate != null ? row("Resting heart rate", `${avg.restingHeartRate} bpm`, null) : null,
        ],
        lungs: [
          env?.aqi != null ? row("Air you breathed (latest)", `AQI ${env.aqi} · ${env.aqiCategory}`, env.aqi > 200 ? "high" : env.aqi > 100 ? "moderate" : "low") : row("Air quality", "not checked", null, "Open the Environment page"),
          avg.spo2 != null ? row("Blood oxygen (avg)", `${avg.spo2}%`, avg.spo2 < 94 ? "moderate" : "low") : null,
        ],
        liver: [s.weight?.value ? row("BMI", `${s.weight.value}`, s.weight.level) : row("BMI", "not calculated", null, "Add height and weight"), diabetesRow],
        stomach: [today?.caloriesEaten ? row("Calories logged today", `${today.caloriesEaten} kcal`, null) : row("Meals", "none logged today", null, "Log a meal photo in Nutrition")],
        digestive: [s.weight?.value ? row("BMI", `${s.weight.value}`, s.weight.level) : null, today?.caloriesEaten ? row("Calories logged today", `${today.caloriesEaten} kcal`, null) : null],
        kidneyL: [bpRow, diabetesRow],
        kidneyR: [bpRow, diabetesRow],
        brain: [
          avg.sleepHours != null ? row("Sleep (7-day avg)", `${avg.sleepHours} h`, lvl("sleep")) : row("Sleep", "not logged", null, "Log sleep on the dashboard"),
          avg.stressLevel != null ? row("Stress (7-day avg)", `${avg.stressLevel}/10`, lvl("stress")) : null,
        ],
        eyes: [diabetesRow, bpRow],
      };
      for (const k of Object.keys(organs)) organs[k] = organs[k].filter(Boolean);

      const riskScores = {
        heart: worst(lvl("heart"), lvl("bloodPressure")),
        lungs: aqiRisk(env?.aqi),
        liver: worst(lvl("weight"), lvl("diabetes")),
        stomach: null,
        digestive: worst(lvl("weight")),
        kidneyL: worst(lvl("bloodPressure"), lvl("diabetes")),
        kidneyR: worst(lvl("bloodPressure"), lvl("diabetes")),
        brain: worst(lvl("sleep"), lvl("stress")),
        eyes: worst(lvl("diabetes"), lvl("bloodPressure")),
        uterus: null,
        ovaryL: null,
        ovaryR: null,
      };
      setState({ loading: false, riskScores, organs, analysedAt: pred?.createdAt || null });
    })();
    return () => {
      alive = false;
    };
  }, []);

  return state;
}

// General, well-established information shown alongside the user's own numbers.
export const ORGAN_INFO = {
  heart: { name: "Heart", icon: "❤️", about: "Pumps about 7,000 litres of blood a day. High blood pressure, smoking, diabetes and inactivity are the main risks you can change.", tips: ["Aim for 150 minutes of brisk walking a week", "Keep salt under 5 g a day (about one teaspoon)", "Check blood pressure at least once a year after 30"] },
  lungs: { name: "Lungs", icon: "🫁", about: "Move about 10,000 litres of air a day. Outdoor PM2.5 and smoking are the biggest preventable harms in Indian cities.", tips: ["Exercise outdoors when the AQI is under 100", "Wear an N95 on poor-air days", "Avoid smoking and second-hand smoke"] },
  liver: { name: "Liver", icon: "🫀", about: "Filters blood and stores energy. Fatty liver disease is common in India and is closely tied to belly fat and sugary diets.", tips: ["Cut sugary drinks and refined snacks", "Lose 5-10% of body weight if overweight", "Limit alcohol"] },
  kidneyL: { name: "Kidneys", icon: "🫘", about: "Filter about 180 litres of blood a day. Diabetes and high blood pressure cause most kidney failure.", tips: ["Keep blood pressure and sugar in range", "Avoid regular painkillers without advice", "Drink enough water for pale-yellow urine"] },
  kidneyR: { name: "Kidneys", icon: "🫘", about: "Filter about 180 litres of blood a day. Diabetes and high blood pressure cause most kidney failure.", tips: ["Keep blood pressure and sugar in range", "Avoid regular painkillers without advice", "Drink enough water for pale-yellow urine"] },
  stomach: { name: "Stomach", icon: "🫃", about: "Starts digestion with acid and enzymes. Large late meals, spicy oily food and smoking worsen acidity.", tips: ["Eat dinner 2-3 hours before bed", "Prefer smaller, regular meals", "See a doctor for heartburn more than twice a week"] },
  digestive: { name: "Digestive system", icon: "🌀", about: "Absorbs nutrients and hosts the gut microbiome, which thrives on fibre.", tips: ["Aim for 25-30 g fibre a day: dal, vegetables, whole grains", "Include curd or other fermented foods", "Drink water through the day"] },
  brain: { name: "Brain", icon: "🧠", about: "Uses about 20% of the body's energy. Sleep clears waste from it each night; chronic stress and poor sleep affect memory and mood.", tips: ["Keep a regular 7-9 hour sleep window", "Take short breaks from screens", "Talk to someone if low mood lasts more than two weeks (Tele-MANAS: 14416)"] },
  eyes: { name: "Eyes", icon: "👁️", about: "Diabetes and high blood pressure damage the retina silently; an annual eye check catches it early.", tips: ["Follow the 20-20-20 rule for screens", "Annual eye exam if you have diabetes", "Wear sunglasses in strong sun"] },
  uterus: { name: "Uterus", icon: "🌸", about: "Irregular or very heavy periods can signal anaemia, PCOS or thyroid problems, all common and treatable.", tips: ["Track your cycle", "Get haemoglobin checked if periods are heavy", "Pap smear every 3 years from age 21 (or as advised)"] },
  ovaryL: { name: "Ovaries", icon: "🌸", about: "PCOS affects roughly 1 in 10 Indian women and is linked to weight, insulin resistance and irregular cycles.", tips: ["Regular exercise improves insulin sensitivity", "See a gynaecologist for irregular cycles or acne with excess hair growth"] },
  ovaryR: { name: "Ovaries", icon: "🌸", about: "PCOS affects roughly 1 in 10 Indian women and is linked to weight, insulin resistance and irregular cycles.", tips: ["Regular exercise improves insulin sensitivity", "See a gynaecologist for irregular cycles or acne with excess hair growth"] },
};
