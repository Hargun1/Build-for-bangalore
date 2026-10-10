import math

import pytest

from app.risk import RiskInputs, assess, blood_pressure, cardio, framingham_risk, heart_age, idrs, weight


def full(**over):
    base = dict(age=55, sex="male", heightCm=175, weightKg=79.6, waistCm=95, activityLevel="moderate",
                familyHistoryDiabetes="one_parent", smoker=False, hasDiabetes=False, onBpMedication=False,
                systolic=140, diastolic=88)
    base.update(over)
    return RiskInputs(**base)


# ---------------------------------------------------------------- IDRS

def test_idrs_points_follow_mohan_2005_table():
    s = idrs(full())
    # age >= 50: 30, male waist 90-99: 10, moderate activity: 10, one parent: 10
    assert s.value == 60
    assert s.level == "high"
    assert [f.points for f in s.factors] == [30, 10, 10, 10]


@pytest.mark.parametrize("age,waist,activity,family,expected,level", [
    (30, 85, "vigorous", "none", 0, "low"),
    (40, 85, "mild", "none", 40, "moderate"),
    (60, 105, "sedentary", "both_parents", 100, "high"),
])
def test_idrs_bands(age, waist, activity, family, expected, level):
    s = idrs(full(age=age, waistCm=waist, activityLevel=activity, familyHistoryDiabetes=family))
    assert s.value == expected and s.level == level


def test_idrs_uses_female_waist_cutoffs():
    assert idrs(full(sex="female", waistCm=85)).factors[1].points == 10
    assert idrs(full(sex="female", waistCm=92)).factors[1].points == 20


def test_idrs_reports_missing_inputs_instead_of_guessing():
    s = idrs(RiskInputs(age=40, activityLevel="mild"))
    assert s.level == "unknown"
    assert "waist circumference" in s.missing and "family history of diabetes" in s.missing


def test_idrs_not_applied_to_known_diabetes():
    s = idrs(full(hasDiabetes=True))
    assert s.level == "unknown" and "already" in s.note


# ---------------------------------------------------------------- Framingham

def test_framingham_matches_hand_calculation():
    # 55-year-old man, BMI 26, SBP 140 untreated, non-smoker, no diabetes.
    total = 3.11296 * math.log(55) + 0.79277 * math.log(26) + 1.85508 * math.log(140)
    expected = 1 - 0.88431 ** math.exp(total - 23.9388)
    assert framingham_risk("male", 55, 26, 140, False, False, False) == pytest.approx(expected)
    assert expected == pytest.approx(0.151, abs=0.002)


def test_framingham_risk_rises_with_smoking_and_treatment():
    base = framingham_risk("female", 50, 24, 130, False, False, False)
    assert framingham_risk("female", 50, 24, 130, False, True, False) > base
    assert framingham_risk("female", 50, 24, 130, True, False, False) > base


def test_heart_age_equals_age_for_optimal_profile():
    assert heart_age("male", 50, 22.5, 125, False, False, False) == pytest.approx(50, abs=0.01)
    assert heart_age("male", 55, 26, 140, False, False, False) > 55


def test_cardio_score_levels_and_age_range():
    s = cardio(full())
    assert s.level == "moderate" and 10 <= s.value < 20
    assert cardio(full(age=25)).level == "unknown"
    assert "smoking status" in cardio(RiskInputs(age=50, sex="male", heightCm=170, weightKg=70, systolic=120)).missing


# ---------------------------------------------------------------- weight and BP

@pytest.mark.parametrize("kg,level", [(50, "moderate"), (62, "low"), (70, "moderate"), (80, "high")])
def test_bmi_uses_asian_cutoffs(kg, level):
    # 170 cm: 50 kg = 17.3, 62 kg = 21.5, 70 kg = 24.2, 80 kg = 27.7
    assert weight(RiskInputs(heightCm=170, weightKg=kg)).level == level


def test_central_obesity_raises_normal_bmi():
    s = weight(RiskInputs(heightCm=170, weightKg=62, waistCm=90))
    assert s.level == "moderate" and "waist" in s.note


@pytest.mark.parametrize("sys_,dia,level", [(115, 75, "low"), (125, 78, "moderate"), (135, 85, "moderate"), (150, 95, "high"), (185, 100, "high")])
def test_bp_categories(sys_, dia, level):
    assert blood_pressure(RiskInputs(systolic=sys_, diastolic=dia)).level == level


def test_assess_wellness_ignores_unknown_scores():
    out = assess(RiskInputs(heightCm=170, weightKg=62, avgSleepHours=8, avgSteps=9000))
    assert out["wellnessScore"] == 100
    assert {s.key for s in out["scores"]} >= {"diabetes", "heart", "weight", "sleep", "activity"}
