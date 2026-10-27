"""Deterministic health-risk scoring from published, validated methods.

No language model is involved here: the same inputs always give the same
numbers, and every number can be traced to a reference.

  * Diabetes  - Indian Diabetes Risk Score (IDRS). Mohan V et al., J Assoc
                Physicians India 2005;53:759-63. Built and validated on Indian adults.
  * Heart     - Framingham 10-year general cardiovascular risk, office-based
                (BMI) model. D'Agostino RB et al., Circulation 2008;117:743-53.
                Also gives "heart age" (same paper).
  * Weight    - BMI with WHO Asia-Pacific cut-offs (WHO/IASO/IOTF 2000), plus
                waist-to-height ratio (>= 0.5 flags central obesity).
  * Blood pressure - category from the 2017 ACC/AHA guideline.
  * Sleep     - 7-9 h for adults (AASM/SRS consensus, 2015).
  * Activity  - daily steps bands (Tudor-Locke & Bassett, 2004).
  * Stress    - the user's own 0-10 rating; not a clinical scale.

These are screening estimates, not diagnoses. The UI says so next to every score.
"""
from __future__ import annotations

import math
from typing import Literal, Optional

from pydantic import BaseModel, Field

Level = Literal["low", "moderate", "high", "unknown"]


class RiskInputs(BaseModel):
    age: Optional[int] = Field(default=None, ge=1, le=120)
    sex: Optional[Literal["male", "female", "other"]] = None
    heightCm: Optional[float] = Field(default=None, ge=50, le=250)
    weightKg: Optional[float] = Field(default=None, ge=10, le=400)
    waistCm: Optional[float] = Field(default=None, ge=30, le=250)
    activityLevel: Optional[Literal["sedentary", "mild", "moderate", "vigorous"]] = None
    familyHistoryDiabetes: Optional[Literal["none", "one_parent", "both_parents"]] = None
    smoker: Optional[bool] = None
    hasDiabetes: Optional[bool] = None
    onBpMedication: Optional[bool] = None
    systolic: Optional[float] = Field(default=None, ge=50, le=260)
    diastolic: Optional[float] = Field(default=None, ge=30, le=180)
    avgSleepHours: Optional[float] = Field(default=None, ge=0, le=24)
    avgSteps: Optional[float] = Field(default=None, ge=0, le=100000)
    avgStress: Optional[float] = Field(default=None, ge=0, le=10)
    restingHeartRate: Optional[float] = Field(default=None, ge=20, le=250)
    daysLogged: int = 0


class Factor(BaseModel):
    name: str
    points: Optional[float] = None
    detail: str = ""


class Score(BaseModel):
    key: str
    label: str
    method: str
    value: Optional[float] = None
    unit: str = ""
    percent: Optional[float] = None  # 0-100 for progress bars
    level: Level = "unknown"
    factors: list[Factor] = []
    missing: list[str] = []
    note: str = ""


# ---------------------------------------------------------------- diabetes (IDRS)

def idrs(i: RiskInputs) -> Score:
    s = Score(key="diabetes", label="Type 2 diabetes risk", method="Indian Diabetes Risk Score (Mohan et al., 2005)", unit="points / 100")
    if i.hasDiabetes:
        s.note = "You have told us you already have diabetes. IDRS screens for undiagnosed diabetes, so it does not apply."
        return s

    missing = []
    factors: list[Factor] = []
    total = 0

    if i.age is None:
        missing.append("date of birth")
    else:
        pts = 0 if i.age < 35 else 20 if i.age < 50 else 30
        factors.append(Factor(name="Age", points=pts, detail=f"{i.age} years"))
        total += pts

    if i.waistCm is None or i.sex not in ("male", "female"):
        missing.append("waist circumference" if i.waistCm is None else "sex (male/female) for waist cut-offs")
    else:
        lo, hi = (90, 100) if i.sex == "male" else (80, 90)
        pts = 0 if i.waistCm < lo else 10 if i.waistCm < hi else 20
        factors.append(Factor(name="Waist", points=pts, detail=f"{i.waistCm:g} cm (cut-offs {lo}/{hi} cm)"))
        total += pts

    if i.activityLevel is None:
        missing.append("physical activity level")
    else:
        pts = {"vigorous": 0, "moderate": 10, "mild": 20, "sedentary": 30}[i.activityLevel]
        factors.append(Factor(name="Physical activity", points=pts, detail=i.activityLevel))
        total += pts

    if i.familyHistoryDiabetes is None:
        missing.append("family history of diabetes")
    else:
        pts = {"none": 0, "one_parent": 10, "both_parents": 20}[i.familyHistoryDiabetes]
        factors.append(Factor(name="Family history", points=pts, detail=i.familyHistoryDiabetes.replace("_", " ")))
        total += pts

    s.factors, s.missing, s.value = factors, missing, float(total)
    if missing:
        s.note = "Partial score: add the missing details for a valid result."
        return s
    s.percent = float(total)
    s.level = "low" if total < 30 else "moderate" if total < 60 else "high"
    return s


# ------------------------------------------------- heart (Framingham 2008, BMI model)

_FRAMINGHAM = {
    # sex: (ln_age, ln_bmi, ln_sbp_untreated, ln_sbp_treated, smoker, diabetes, baseline_survival, mean)
    "male": (3.11296, 0.79277, 1.85508, 1.92672, 0.70953, 0.53160, 0.88431, 23.9388),
    "female": (2.72107, 0.51125, 2.81291, 2.88267, 0.61868, 0.77763, 0.94833, 26.0145),
}


def bmi_of(i: RiskInputs) -> Optional[float]:
    if i.heightCm and i.weightKg:
        return i.weightKg / (i.heightCm / 100) ** 2
    return None


def framingham_terms(sex: str, age: float, bmi: float, sbp: float, treated: bool, smoker: bool, diabetic: bool) -> float:
    a, b, su, st, sm, dm, _, _ = _FRAMINGHAM[sex]
    return a * math.log(age) + b * math.log(bmi) + (st if treated else su) * math.log(sbp) + sm * smoker + dm * diabetic


def framingham_risk(sex: str, age: float, bmi: float, sbp: float, treated: bool, smoker: bool, diabetic: bool) -> float:
    s0, mean = _FRAMINGHAM[sex][6], _FRAMINGHAM[sex][7]
    total = framingham_terms(sex, age, bmi, sbp, treated, smoker, diabetic)
    return 1 - s0 ** math.exp(total - mean)


def heart_age(sex: str, age: float, bmi: float, sbp: float, treated: bool, smoker: bool, diabetic: bool) -> float:
    # The age at which a person with "optimal" factors (SBP 125 untreated, BMI 22.5,
    # non-smoker, no diabetes) has the same predicted risk.
    a, b, su, *_ = _FRAMINGHAM[sex]
    total = framingham_terms(sex, age, bmi, sbp, treated, smoker, diabetic)
    return math.exp((total - b * math.log(22.5) - su * math.log(125)) / a)


def cardio(i: RiskInputs) -> Score:
    s = Score(key="heart", label="10-year heart & stroke risk", method="Framingham general CVD risk, BMI model (D'Agostino et al., 2008)", unit="%")
    missing = []
    if i.age is None:
        missing.append("date of birth")
    if i.sex not in ("male", "female"):
        missing.append("sex (male/female); the model has separate equations")
    bmi = bmi_of(i)
    if bmi is None:
        missing.append("height and weight")
    if i.systolic is None:
        missing.append("a blood pressure reading")
    if i.smoker is None:
        missing.append("smoking status")
    s.missing = missing
    if missing:
        s.note = "Add the missing details to calculate this score."
        return s
    if not 30 <= i.age <= 74:
        s.note = "The Framingham model is validated for ages 30 to 74 only."
        return s

    treated, diabetic = bool(i.onBpMedication), bool(i.hasDiabetes)
    risk = framingham_risk(i.sex, i.age, bmi, i.systolic, treated, i.smoker, diabetic) * 100
    hage = heart_age(i.sex, i.age, bmi, i.systolic, treated, i.smoker, diabetic)
    s.value = round(risk, 1)
    s.percent = round(min(risk, 100), 1)
    s.level = "low" if risk < 10 else "moderate" if risk < 20 else "high"
    s.factors = [
        Factor(name="Age", detail=f"{i.age} years"),
        Factor(name="Blood pressure", detail=f"{i.systolic:.0f} mmHg systolic{' (on treatment)' if treated else ''}"),
        Factor(name="BMI", detail=f"{bmi:.1f}"),
        Factor(name="Smoking", detail="yes" if i.smoker else "no"),
        Factor(name="Diabetes", detail="yes" if diabetic else "no"),
        Factor(name="Heart age", points=round(max(30, min(hage, 100))), detail=f"{round(hage)} years vs your age {i.age}"),
    ]
    if i.onBpMedication is None:
        s.note = "Assumed you are not on blood-pressure medicine; update your profile if you are."
    return s


# --------------------------------------------------------------- weight / BMI

def weight(i: RiskInputs) -> Score:
    s = Score(key="weight", label="Body weight", method="BMI with WHO Asia-Pacific cut-offs; waist-to-height ratio", unit="kg/m²")
    bmi = bmi_of(i)
    if bmi is None:
        s.missing = ["height and weight"]
        return s
    s.value = round(bmi, 1)
    if bmi < 18.5:
        cat, s.level = "underweight", "moderate"
    elif bmi < 23:
        cat, s.level = "normal", "low"
    elif bmi < 25:
        cat, s.level = "overweight (at risk)", "moderate"
    else:
        cat, s.level = "obese (Asian cut-off)", "high"
    # Map BMI 15..35 onto 0..100 for a progress bar.
    s.percent = round(max(0, min(100, (bmi - 15) / 20 * 100)))
    s.factors = [Factor(name="BMI category", detail=f"{bmi:.1f} = {cat}")]
    if i.waistCm and i.heightCm:
        whtr = i.waistCm / i.heightCm
        s.factors.append(Factor(name="Waist-to-height", points=round(whtr, 2), detail="central obesity" if whtr >= 0.5 else "healthy (< 0.5)"))
        if whtr >= 0.5 and s.level == "low":
            s.level = "moderate"
            s.note = "Normal BMI but fat stored around the waist, which still raises metabolic risk."
    return s


# --------------------------------------------------------------- blood pressure

def blood_pressure(i: RiskInputs) -> Score:
    s = Score(key="bloodPressure", label="Blood pressure", method="2017 ACC/AHA blood pressure categories", unit="mmHg")
    if i.systolic is None or i.diastolic is None:
        s.missing = ["a blood pressure reading"]
        return s
    sys_, dia = i.systolic, i.diastolic
    s.value = round(sys_)
    if sys_ > 180 or dia > 120:
        cat, s.level = "hypertensive crisis: seek care now", "high"
        s.note = ("Repeat the reading after at least 1 minute. If it is still this high, contact a health professional "
                  "as soon as possible. With chest pain, breathlessness, weakness, vision changes or trouble speaking, call 112 now.")
    elif sys_ >= 140 or dia >= 90:
        cat, s.level = "stage 2 hypertension", "high"
    elif sys_ >= 130 or dia >= 80:
        cat, s.level = "stage 1 hypertension", "moderate"
    elif sys_ >= 120:
        cat, s.level = "elevated", "moderate"
    else:
        cat, s.level = "normal", "low"
    s.percent = round(max(0, min(100, (sys_ - 90) / 90 * 100)))
    s.factors = [Factor(name="Category", detail=f"{sys_:.0f}/{dia:.0f} = {cat}")]
    return s


# --------------------------------------------------------------- lifestyle

def sleep(i: RiskInputs) -> Score:
    s = Score(key="sleep", label="Sleep", method="Adults need 7-9 h (AASM/SRS consensus, 2015)", unit="h/night")
    if i.avgSleepHours is None:
        s.missing = ["sleep logs"]
        return s
    h = i.avgSleepHours
    s.value = round(h, 1)
    s.level = "low" if 7 <= h <= 9 else "moderate" if 6 <= h < 7 or 9 < h <= 10 else "high"
    s.percent = round(max(0, min(100, h / 10 * 100)))
    s.factors = [Factor(name="Average", detail=f"{h:.1f} h over {i.daysLogged} logged day(s)")]
    return s


def activity(i: RiskInputs) -> Score:
    s = Score(key="activity", label="Physical activity", method="Daily step bands (Tudor-Locke & Bassett, 2004)", unit="steps/day")
    if i.avgSteps is None:
        s.missing = ["step logs"]
        return s
    st = i.avgSteps
    s.value = round(st)
    if st < 5000:
        band, s.level = "sedentary", "high"
    elif st < 7500:
        band, s.level = "low active", "moderate"
    elif st < 10000:
        band, s.level = "somewhat active", "low"
    else:
        band, s.level = "active", "low"
    s.percent = round(min(100, st / 10000 * 100))
    s.factors = [Factor(name="Average", detail=f"{st:,.0f} steps/day = {band}")]
    return s


def stress(i: RiskInputs) -> Score:
    s = Score(key="stress", label="Stress", method="Your own 0-10 rating (not a clinical scale)", unit="/10")
    if i.avgStress is None:
        s.missing = ["stress ratings"]
        return s
    v = i.avgStress
    s.value = round(v, 1)
    s.level = "low" if v <= 3 else "moderate" if v <= 6 else "high"
    s.percent = round(v * 10)
    return s


LEVEL_POINTS = {"low": 100, "moderate": 60, "high": 25}


def assess(i: RiskInputs) -> dict:
    scores = [idrs(i), cardio(i), weight(i), blood_pressure(i), sleep(i), activity(i), stress(i)]
    known = [LEVEL_POINTS[s.level] for s in scores if s.level in LEVEL_POINTS]
    # App-specific summary for the dashboard ring, not a clinical measure.
    wellness = round(sum(known) / len(known)) if known else None
    return {"scores": scores, "wellnessScore": wellness}


# Evidence-based next steps per score, used when the language model is unavailable
# and given to the model as the facts it must stay within.
RULE_RECOMMENDATIONS = {
    "diabetes": ("Get a fasting blood sugar or HbA1c test", "Your diabetes risk score is raised. A simple blood test at any lab confirms whether your sugar is normal; many diagnostic centres in Bengaluru do it for under ₹500."),
    "heart": ("Review heart risk with a doctor", "Your 10-year heart and stroke risk is raised. Ask a doctor about a lipid profile and how to lower blood pressure."),
    "weight": ("Aim for a slow, steady weight loss", "Losing 5-7% of body weight lowers diabetes and blood-pressure risk. Aim for about 0.5 kg per week."),
    "bloodPressure": ("Recheck your blood pressure", "Measure it on 3 different days, seated and rested for 5 minutes. Cut down on salt (under 5 g a day) and see a doctor if it stays at 130/80 or above."),
    "sleep": ("Protect a 7-9 hour sleep window", "Keep the same bedtime and wake time daily, and stop screens 30 minutes before bed."),
    "activity": ("Add a daily walk", "Build up toward 7,500+ steps a day; 10 extra minutes of brisk walking is about 1,000 steps."),
    "stress": ("Take short recovery breaks", "Try 5 minutes of slow breathing (inhale 4 s, exhale 6 s) twice a day, and talk to someone you trust if stress stays high."),
}
