"""Lab report checking: plain code, no AI.

The model only copies what is printed on the report (test name, value, unit, the lab's
reference range). Everything that decides what a result *means* happens here:

1. Match the test to a catalogue of ~30 common Indian blood tests.
2. Convert the value to one standard unit (mmol/L glucose -> mg/dL, lakhs/cumm platelets
   -> 10^3/uL, ...), so results from different labs can be charted together.
3. Reject physically implausible numbers (a misread decimal point, a reference value copied
   as the result) instead of explaining them.
4. Decide low / normal / high against the lab's own printed range when it can be parsed,
   otherwise against a standard adult range, and say which one was used.
5. Mark values that need a doctor the same day (e.g. potassium above 6.0).

Ranges are typical adult reference intervals from MedlinePlus and common Indian lab
reports. They are a fallback: the lab's printed range always wins.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Callable, Optional

ML = "https://medlineplus.gov/lab-tests/"


@dataclass
class Test:
    key: str
    name: str
    unit: str  # standard unit everything is converted to
    aliases: list[str]
    low: Optional[float] = None  # standard adult range in `unit`
    high: Optional[float] = None
    sex_range: dict = field(default_factory=dict)  # {"male": (lo, hi), "female": (lo, hi)}
    plausible: tuple[float, float] = (0, 1e9)
    critical_low: Optional[float] = None
    critical_high: Optional[float] = None
    convert: dict = field(default_factory=dict)  # normalised unit -> factor or function to `unit`
    higher_is_better: bool = False
    organs: list[str] = field(default_factory=list)  # 3D body organ keys
    group: str = "Other"
    url: str = ""
    topic: str = ""  # MedlinePlus knowledge-base query for a cited explanation
    high_means: str = ""
    low_means: str = ""
    bands: Optional[Callable[[float], Optional[str]]] = None  # extra label, e.g. "prediabetes range"


def _hba1c_band(v: float) -> Optional[str]:
    if v >= 6.5:
        return "diabetes range (6.5% or above)"
    if v >= 5.7:
        return "prediabetes range (5.7–6.4%)"
    return None


def _fasting_band(v: float) -> Optional[str]:
    if v >= 126:
        return "diabetes range (126 mg/dL or above, fasting)"
    if v >= 100:
        return "prediabetes range (100–125 mg/dL, fasting)"
    return None


def _egfr_band(v: float) -> Optional[str]:
    if v < 60:
        return "reduced kidney function (below 60)"
    if v < 90:
        return "mildly reduced (60–89); usually fine if urine tests are normal"
    return None


GLUCOSE = {"mmol/l": 18.016}
CHOL = {"mmol/l": 38.67}
KIDNEY = ["kidneyL", "kidneyR"]
SUGAR_ORGANS = ["kidneyL", "kidneyR", "eyes"]  # the organs high sugar damages

CATALOG: list[Test] = [
    # --- sugar
    Test("hba1c", "HbA1c", "%", ["hba1c", "glycatedhaemoglobin", "glycatedhemoglobin", "glycosylatedhemoglobin", "glycosylatedhaemoglobin", "a1c", "hemoglobina1c"],
         4.0, 5.6, plausible=(3, 20), convert={"mmol/mol": lambda x: x / 10.929 + 2.15}, organs=SUGAR_ORGANS, group="Sugar",
         url=ML + "hemoglobin-a1c-hba1c-test/", topic="diabetes HbA1c blood sugar", bands=_hba1c_band,
         high_means="Your average blood sugar over the last 2–3 months has been above normal.",
         low_means="Unusually low; can happen with anaemia or recent blood loss, which make the test less reliable."),
    Test("glucose_fasting", "Fasting glucose", "mg/dL", ["fastingbloodsugar", "fbs", "glucosef", "bloodsugarf", "fastingsugar", "bloodsugarfasting", "bloodglucosefasting", "glucosefastingplasma", "fastingglucose", "fastingplasmaglucose", "fpg", "glucosefasting", "bloodsugarfasting", "plasmaglucosefasting"],
         70, 99, plausible=(15, 1500), critical_low=54, critical_high=400, convert=GLUCOSE, organs=SUGAR_ORGANS, group="Sugar",
         url=ML + "blood-glucose-test/", topic="high blood sugar diabetes", bands=_fasting_band,
         high_means="Blood sugar after fasting is above normal, a sign of prediabetes or diabetes.",
         low_means="Low blood sugar (hypoglycaemia) can cause shakiness, sweating and confusion."),
    Test("glucose_pp", "Post-meal glucose", "mg/dL", ["postprandialbloodsugar", "ppbs", "glucosepp2hrs", "bloodsugarpp2hrs", "ppbs2hrs", "postprandialsugar", "postprandialglucose", "glucosepp", "glucosepostprandial", "bloodsugarpp", "plasmaglucosepp", "2hrpostprandial"],
         70, 139, plausible=(15, 1500), critical_low=54, critical_high=400, convert=GLUCOSE, organs=SUGAR_ORGANS, group="Sugar",
         url=ML + "blood-glucose-test/", topic="high blood sugar diabetes",
         high_means="Blood sugar 2 hours after a meal is above normal; 200 or more suggests diabetes.",
         low_means="Low blood sugar after a meal can happen with some diabetes medicines."),
    Test("glucose_random", "Random glucose", "mg/dL", ["randombloodsugar", "rbs", "randomglucose", "glucoserandom", "bloodglucose", "glucose", "plasmaglucose"],
         70, 139, plausible=(15, 1500), critical_low=54, critical_high=400, convert=GLUCOSE, organs=SUGAR_ORGANS, group="Sugar",
         url=ML + "blood-glucose-test/", topic="high blood sugar diabetes",
         high_means="Blood sugar is above normal for a random sample; 200 or more with symptoms suggests diabetes.",
         low_means="Low blood sugar (hypoglycaemia) can cause shakiness, sweating and confusion."),
    # --- lipids
    Test("cholesterol_total", "Total cholesterol", "mg/dL", ["totalcholesterol", "cholesterol", "cholesteroltotal", "serumcholesterol"],
         None, 199, plausible=(40, 1000), convert=CHOL, organs=["heart"], group="Cholesterol",
         url=ML + "cholesterol-levels/", topic="high cholesterol heart disease",
         high_means="High total cholesterol raises the long-term risk of heart attack and stroke.",
         low_means="Very low cholesterol is uncommon and usually not a concern on its own."),
    Test("ldl", "LDL cholesterol", "mg/dL", ["ldl", "ldlcholesterol", "ldlc", "cholesterolldl", "ldlcholesteroldirect", "directldl", "lowdensitylipoprotein"],
         None, 99, plausible=(5, 800), convert=CHOL, organs=["heart"], group="Cholesterol",
         url="https://medlineplus.gov/ldlthebadcholesterol.html", topic="LDL bad cholesterol",
         high_means="LDL (“bad” cholesterol) builds up in artery walls; lower is better for the heart.",
         low_means="Low LDL is generally good for the heart."),
    Test("hdl", "HDL cholesterol", "mg/dL", ["hdl", "hdlcholesterol", "hdlc", "cholesterolhdl", "highdensitylipoprotein"],
         40, None, sex_range={"male": (40, None), "female": (50, None)}, plausible=(5, 250), convert=CHOL, higher_is_better=True,
         organs=["heart"], group="Cholesterol", url="https://medlineplus.gov/hdlthegoodcholesterol.html", topic="HDL good cholesterol",
         high_means="High HDL (“good” cholesterol) is usually protective.",
         low_means="Low HDL (“good” cholesterol) raises heart risk; exercise and not smoking help raise it."),
    Test("triglycerides", "Triglycerides", "mg/dL", ["triglycerides", "triglyceride", "tg", "serumtriglycerides"],
         None, 149, plausible=(10, 10000), critical_high=1000, convert={"mmol/l": 88.57}, organs=["heart", "liver"], group="Cholesterol",
         url=ML + "triglycerides-test/", topic="triglycerides high",
         high_means="High triglycerides are linked to sugary and refined-carb diets, alcohol, belly fat and heart risk.",
         low_means="Low triglycerides are not usually a concern."),
    # --- kidneys
    Test("creatinine", "Creatinine", "mg/dL", ["creatinine", "serumcreatinine", "screatinine", "creatinineserum"],
         0.7, 1.3, sex_range={"male": (0.7, 1.3), "female": (0.6, 1.1)}, plausible=(0.1, 25), critical_high=4.0,
         convert={"umol/l": 1 / 88.4}, organs=KIDNEY, group="Kidneys", url=ML + "creatinine-test/", topic="kidney disease creatinine",
         high_means="Creatinine builds up when the kidneys filter less well; dehydration and heavy exercise can also raise it.",
         low_means="Low creatinine usually reflects low muscle mass and is rarely a concern."),
    Test("egfr", "eGFR", "mL/min/1.73m²", ["egfr", "estimatedgfr", "gfr", "egfrckdepi", "glomerularfiltrationrate"],
         90, None, plausible=(1, 200), critical_low=15, higher_is_better=True, organs=KIDNEY, group="Kidneys",
         url=ML + "glomerular-filtration-rate-gfr-test/", topic="chronic kidney disease", bands=_egfr_band,
         high_means="", low_means="eGFR estimates how well the kidneys filter; below 60 for 3 months means chronic kidney disease."),
    Test("urea", "Urea", "mg/dL", ["urea", "bloodurea", "serumurea", "ureaserum"],
         15, 45, plausible=(2, 600), convert={"mmol/l": 6.006}, organs=KIDNEY, group="Kidneys",
         url=ML + "bun-blood-urea-nitrogen/", topic="kidney disease",
         high_means="High urea can mean the kidneys are filtering less, or dehydration or a high-protein diet.",
         low_means="Low urea can come with a low-protein diet or liver problems."),
    Test("bun", "Blood urea nitrogen (BUN)", "mg/dL", ["bun", "bloodureanitrogen", "ureanitrogen"],
         7, 20, plausible=(1, 300), convert={"mmol/l": 2.801}, organs=KIDNEY, group="Kidneys",
         url=ML + "bun-blood-urea-nitrogen/", topic="kidney disease",
         high_means="High BUN can mean the kidneys are filtering less, or dehydration.",
         low_means="Low BUN is rarely a concern."),
    Test("uric_acid", "Uric acid", "mg/dL", ["uricacid", "serumuricacid", "urate"],
         3.4, 7.0, sex_range={"male": (3.4, 7.0), "female": (2.4, 6.0)}, plausible=(0.5, 25), convert={"umol/l": 1 / 59.48},
         organs=KIDNEY, group="Kidneys", url=ML + "uric-acid-test/", topic="gout uric acid",
         high_means="High uric acid can cause gout and kidney stones; red meat, alcohol and sugary drinks raise it.",
         low_means="Low uric acid is uncommon and usually not a concern."),
    Test("sodium", "Sodium", "mmol/L", ["sodium", "na", "serumsodium", "sodiumserum"],
         135, 145, plausible=(90, 200), critical_low=125, critical_high=155, convert={"meq/l": 1}, organs=KIDNEY, group="Kidneys",
         url=ML + "sodium-blood-test/", topic="hyponatremia sodium",
         high_means="High sodium usually means the body is short of water.",
         low_means="Low sodium can cause tiredness, confusion and cramps; some BP medicines and heavy sweating cause it."),
    Test("potassium", "Potassium", "mmol/L", ["potassium", "k", "serumpotassium", "potassiumserum"],
         3.5, 5.1, plausible=(1, 12), critical_low=3.0, critical_high=6.0, convert={"meq/l": 1}, organs=KIDNEY + ["heart"], group="Kidneys",
         url=ML + "potassium-blood-test/", topic="potassium blood",
         high_means="High potassium can affect the heart rhythm; kidney problems and some BP medicines raise it.",
         low_means="Low potassium can cause weakness, cramps and heart-rhythm problems; vomiting, diarrhoea and water pills cause it."),
    Test("calcium", "Calcium", "mg/dL", ["calcium", "serumcalcium", "ca", "calciumtotal", "totalcalcium"],
         8.5, 10.5, plausible=(3, 20), critical_low=6.5, critical_high=13, convert={"mmol/l": 4.008}, group="Minerals & vitamins",
         url=ML + "calcium-blood-test/", topic="calcium blood",
         high_means="High calcium can come from overactive parathyroid glands or too many supplements.",
         low_means="Low calcium is often linked to low vitamin D or low albumin."),
    # --- liver
    Test("alt", "ALT (SGPT)", "U/L", ["alt", "sgpt", "altsgpt", "sgptalt", "alanineaminotransferase", "alaninetransaminase"],
         None, 45, plausible=(1, 10000), convert={"iu/l": 1}, organs=["liver"], group="Liver",
         url=ML + "alt-blood-test/", topic="fatty liver disease",
         high_means="Raised ALT means liver cells are irritated; fatty liver is the most common cause in India, alcohol and some medicines are others.",
         low_means="Low ALT is not a concern."),
    Test("ast", "AST (SGOT)", "U/L", ["ast", "sgot", "astsgot", "sgotast", "aspartateaminotransferase", "aspartatetransaminase"],
         None, 40, plausible=(1, 10000), convert={"iu/l": 1}, organs=["liver"], group="Liver",
         url=ML + "ast-test/", topic="liver disease",
         high_means="Raised AST can come from the liver, but also from muscles after hard exercise.",
         low_means="Low AST is not a concern."),
    Test("alp", "Alkaline phosphatase (ALP)", "U/L", ["alp", "alkalinephosphatase", "alkphosphatase", "alkphos", "serumalkalinephosphatase"],
         44, 147, plausible=(5, 5000), convert={"iu/l": 1}, organs=["liver"], group="Liver",
         url=ML + "alkaline-phosphatase/", topic="liver disease",
         high_means="High ALP can come from the liver or bile ducts, or from bones (normal in growing teenagers).",
         low_means="Low ALP is uncommon; it can be linked to low zinc or magnesium."),
    Test("bilirubin_total", "Total bilirubin", "mg/dL", ["bilirubintotal", "totalbilirubin", "bilirubin", "serumbilirubin", "sbilirubintotal"],
         0.2, 1.2, plausible=(0.05, 50), convert={"umol/l": 1 / 17.1}, organs=["liver"], group="Liver",
         url=ML + "bilirubin-blood-test/", topic="jaundice bilirubin",
         high_means="High bilirubin causes jaundice (yellow eyes or skin); it can come from the liver, bile ducts or Gilbert's syndrome (harmless).",
         low_means="Low bilirubin is not a concern."),
    Test("albumin", "Albumin", "g/dL", ["albumin", "serumalbumin", "albuminserum"],
         3.5, 5.0, plausible=(0.5, 8), convert={"g/l": 0.1}, organs=["liver"], group="Liver",
         url=ML + "albumin-blood-test/", topic="albumin liver kidney",
         high_means="High albumin usually means dehydration.",
         low_means="Low albumin can come from liver or kidney disease, or not eating enough protein."),
    # --- blood count
    Test("hemoglobin", "Haemoglobin", "g/dL", ["hemoglobin", "haemoglobin", "hb", "hgb"],
         13.0, 17.0, sex_range={"male": (13.0, 17.0), "female": (12.0, 15.5)}, plausible=(2, 25), critical_low=7.0, critical_high=20,
         convert={"g/l": 0.1}, organs=["heart"], group="Blood count", url=ML + "hemoglobin-test/", topic="anemia iron deficiency",
         high_means="High haemoglobin can come from smoking, dehydration or living at altitude.",
         low_means="Low haemoglobin is anaemia; iron deficiency is the most common cause in India, especially in women."),
    Test("wbc", "White blood cells (WBC)", "10³/µL", ["wbc", "totalleukocytecount", "tlc", "totalwbccount", "whitebloodcells", "leukocytes", "totalcount", "wbccount", "leucocytecount"],
         4.0, 11.0, plausible=(0.1, 200), critical_low=2.0, critical_high=30, organs=[], group="Blood count",
         url=ML + "white-blood-count-wbc/", topic="white blood cell count",
         high_means="High WBC usually means the body is fighting an infection or inflammation.",
         low_means="Low WBC can follow viral infections (including dengue) or some medicines."),
    Test("platelets", "Platelets", "10³/µL", ["platelets", "plateletcount", "plt", "plateletcountplt"],
         150, 410, plausible=(1, 2000), critical_low=50, critical_high=1000, organs=[], group="Blood count",
         url=ML + "platelet-tests/", topic="platelet disorders thrombocytopenia",
         high_means="High platelets can follow infection, inflammation or iron deficiency.",
         low_means="Low platelets are common in dengue and some viral fevers; very low counts raise bleeding risk."),
    Test("ferritin", "Ferritin", "ng/mL", ["ferritin", "serumferritin"],
         24, 336, sex_range={"male": (24, 336), "female": (11, 307)}, plausible=(1, 20000), convert={"ug/l": 1}, organs=[], group="Minerals & vitamins",
         url=ML + "ferritin-blood-test/", topic="iron deficiency anemia",
         high_means="High ferritin can come from inflammation, fatty liver or iron overload.",
         low_means="Low ferritin means the body's iron stores are low, often before anaemia shows up."),
    # --- thyroid, vitamins, inflammation
    Test("tsh", "TSH (thyroid)", "µIU/mL", ["tsh", "thyroidstimulatinghormone", "tshultrasensitive", "ultrasensitivetsh", "serumtsh", "tsh3rdgeneration"],
         0.4, 4.5, plausible=(0.001, 500), convert={"miu/l": 1, "uiu/ml": 1}, organs=["brain"], group="Thyroid",
         url=ML + "tsh-thyroid-stimulating-hormone-test/", topic="hypothyroidism thyroid",
         high_means="High TSH usually means an underactive thyroid (hypothyroidism): tiredness, weight gain, feeling cold.",
         low_means="Low TSH usually means an overactive thyroid (hyperthyroidism): weight loss, fast heartbeat, anxiety."),
    Test("t4_free", "Free T4", "ng/dL", ["freet4", "ft4", "freethyroxine"],
         0.8, 1.8, plausible=(0.05, 10), convert={"pmol/l": 1 / 12.87}, organs=["brain"], group="Thyroid",
         url=ML + "thyroxine-t4-test/", topic="thyroid diseases",
         high_means="High free T4 points to an overactive thyroid.",
         low_means="Low free T4 points to an underactive thyroid."),
    Test("vitamin_d", "Vitamin D (25-OH)", "ng/mL", ["vitamind", "25ohvitamind", "25hydroxyvitamind", "vitamind25hydroxy", "vitd", "vitamind3", "25ohd", "vitamind25oh", "totalvitamind"],
         30, 100, plausible=(1, 300), convert={"nmol/l": 1 / 2.496}, organs=[], group="Minerals & vitamins",
         url=ML + "vitamin-d-test/", topic="vitamin D deficiency",
         high_means="Very high vitamin D almost always comes from taking too many supplements.",
         low_means="Low vitamin D is very common in Indian cities; it weakens bones and muscles. Below 20 is a deficiency."),
    Test("vitamin_b12", "Vitamin B12", "pg/mL", ["vitaminb12", "b12", "cyanocobalamin", "cobalamin", "serumvitaminb12", "vitb12"],
         200, 900, plausible=(20, 5000), convert={"pmol/l": 1.355}, organs=["brain"], group="Minerals & vitamins",
         url=ML + "vitamin-b-test/", topic="vitamin B12 deficiency",
         high_means="High B12 is usually from supplements and rarely a concern.",
         low_means="Low B12 is common in vegetarians and people on metformin; it can cause tiredness, tingling and memory problems."),
    Test("crp", "CRP", "mg/L", ["crp", "creactiveprotein", "hscrp", "highsensitivitycrp", "crpquantitative"],
         None, 5, plausible=(0, 500), convert={"mg/dl": 10}, organs=[], group="Inflammation",
         url=ML + "c-reactive-protein-crp-test/", topic="inflammation C-reactive protein",
         high_means="High CRP means there is inflammation or infection somewhere in the body.",
         low_means="Low CRP is normal."),
]

BY_KEY = {t.key: t for t in CATALOG}
_ALIAS = {a: t for t in CATALOG for a in t.aliases}


def _norm_name(s: str) -> str:
    s = s.lower().replace("haemo", "hemo")
    s = re.sub(r"\(.*?\)", lambda m: m.group(0) if len(m.group(0)) <= 8 else "", s)  # keep "(sgpt)", drop long notes
    return re.sub(r"[^a-z0-9]", "", s)


# Names that contain a catalogue name but are a different test (MCH contains "hemoglobin",
# VLDL contains "ldl", direct bilirubin contains "bilirubin", urine glucose contains "glucose").
_LOOKALIKE = ("urine", "urinary", "corpuscular", "mch", "ratio", "index", "vldl", "nonhdl", "indirect", "direct",
              "conjugated", "ionised", "ionized", "micro", "width", "volume", "percent", "fraction", "clearance", "creatinekinase")


def match(name: str, key_hint: str = "") -> Optional[Test]:
    """Finds the catalogue test for a printed name. The model's key is a hint, checked against the name."""
    n = _norm_name(name)
    hit = _ALIAS.get(n)
    if hit:
        return hit
    if any(w in n for w in _LOOKALIKE):
        return None  # only an exact name match is trusted for these
    hint = BY_KEY.get((key_hint or "").strip().lower())
    # Accept the model's key only if the printed name shares an alias with it (no silent re-labelling).
    if hint and any(a in n for a in hint.aliases if len(a) >= 3):
        return hint
    for alias in sorted(_ALIAS, key=len, reverse=True):
        if len(alias) >= 4 and alias in n:
            return _ALIAS[alias]
    return None


def norm_unit(u: str) -> str:
    u = (u or "").strip().lower().replace("μ", "u").replace("µ", "u").replace("mc", "u").replace(" ", "")
    u = u.replace("litre", "l").replace("liter", "l").replace("cumm", "ul").replace("mm3", "ul").replace("cmm", "ul")
    return u


def to_standard(t: Test, value: float, unit: str) -> tuple[Optional[float], str]:
    """Converts to the test's standard unit. Returns (value or None if the unit is unknown, how)."""
    u = norm_unit(unit)
    std = norm_unit(t.unit)
    if t.key in ("wbc", "platelets"):
        return _count(t, value, u)
    if not u or u == std:
        return value, "as printed" if u else "unit assumed"
    conv = t.convert.get(u)
    if conv is None:
        return None, f"unit '{unit}' not recognised"
    out = conv(value) if callable(conv) else value * conv
    return out, f"converted from {unit}"


def _count(t: Test, value: float, u: str) -> tuple[Optional[float], str]:
    """Cell counts are printed many ways: 7.2 x10^3/uL, 7200 /cumm, 2.5 lakhs/cumm, 250 x10^9/L."""
    if "lakh" in u:
        return value * 100, "converted from lakhs"
    if "10^9" in u or "10*9" in u or "x109" in u or "10e9" in u:
        return value, "10^9/L = 10³/µL"
    if any(k in u for k in ("10^3", "10*3", "x103", "10³", "thou", "k/ul", "10e3")):
        return value, "as printed"
    # Plain per-µL counts: 7200 cells/cumm -> 7.2
    big = 1000 if t.key == "wbc" else 10000
    if value >= big:
        return value / 1000, "converted from cells/µL"
    return value, "unit assumed"


_NUM = r"-?\d+(?:\.\d+)?"


def parse_number(text: str) -> tuple[Optional[float], str]:
    """'1,50,000' -> 150000 (Indian grouping); '<0.5' -> (0.5, '<'). Returns (value, qualifier)."""
    s = (text or "").strip().replace(",", "")
    m = re.search(rf"([<>]=?|≤|≥)?\s*({_NUM})", s)
    if not m:
        return None, ""
    return float(m.group(2)), (m.group(1) or "")


def parse_range(text: str) -> tuple[Optional[float], Optional[float]]:
    """Reads the lab's printed range: '70-100', '70 – 100', '< 200', 'Upto 40', '> 40'.
    When several bands are printed ('Desirable <200; Borderline 200-239'), the first one is used."""
    s = (text or "").replace(",", "").replace("–", "-").replace("—", "-").lower()
    s = re.sub(r"\bto\b", "-", s)
    pats = [
        (rf"({_NUM})\s*-\s*({_NUM})", lambda m: (float(m.group(1)), float(m.group(2)))),
        (rf"(?:<=?|≤|up\s*to|upto|less\s*than|below)\s*({_NUM})", lambda m: (None, float(m.group(1)))),
        (rf"(?:>=?|≥|more\s*than|above|greater\s*than)\s*({_NUM})", lambda m: (float(m.group(1)), None)),
    ]
    found = []
    for pat, fn in pats:
        m = re.search(pat, s)
        if m:
            found.append((m.start(), fn(m)))
    if not found:
        return None, None
    lo, hi = min(found, key=lambda x: x[0])[1]
    if lo is not None and hi is not None and lo > hi:
        return None, None
    return lo, hi


def standard_range(t: Test, sex: Optional[str]) -> tuple[Optional[float], Optional[float]]:
    if sex in t.sex_range:
        return t.sex_range[sex]
    return t.low, t.high


def evaluate_row(name: str, value_text: str, unit: str = "", ref_range: str = "", key_hint: str = "", sex: Optional[str] = None) -> dict:
    """Checks one printed result. Never invents a value: anything it can't verify is marked so."""
    t = match(name, key_hint)
    value, qualifier = parse_number(value_text)
    row = {
        "name": name.strip()[:80],
        "key": t.key if t else None,
        "display": t.name if t else name.strip()[:80],
        "group": t.group if t else "Other",
        "valueText": (value_text or "").strip()[:40],
        "value": value,
        "unit": (unit or "").strip()[:30],
        "refRange": (ref_range or "").strip()[:80],
        "status": "unknown",
        "rangeSource": None,
        "low": None,
        "high": None,
        "standardValue": None,
        "standardUnit": t.unit if t else None,
        "critical": False,
        "band": None,
        "note": "",
        "organs": t.organs if t else [],
        "url": t.url if t else None,
        "meaning": "",
    }
    if value is None:
        row["note"] = "No number found for this result."
        return row

    std = None
    if t:
        std, how = to_standard(t, value, unit)
        row["standardValue"] = round(std, 2) if std is not None else None
        if std is not None and not (t.plausible[0] <= std <= t.plausible[1]):
            # A misread decimal point or a range copied as the result: don't explain a number we don't trust.
            row["status"] = "check"
            row["note"] = f"{value_text} {unit} is outside what is physically possible for {t.name}. Please check the report and correct it."
            return row
        if std is None:
            row["note"] = how

    # 1) The lab's own printed range, in the printed unit.
    lo, hi = parse_range(ref_range)
    if t and t.higher_is_better and lo is None:
        lo, hi = None, None  # e.g. HDL '<40 low risk' bands can't be read as an upper limit
    if lo is not None or hi is not None:
        row.update(low=lo, high=hi, rangeSource="report")
        cmp_value = value
    elif t and std is not None:
        lo, hi = standard_range(t, sex)
        row.update(low=lo, high=hi, rangeSource="standard")
        cmp_value = std
    else:
        row["note"] = row["note"] or "No reference range printed and this test isn't in our list, so it isn't judged."
        return row

    if qualifier.startswith("<") and hi is not None and value <= hi:
        row["status"] = "normal"
    elif qualifier.startswith(">") and lo is not None and value >= lo:
        row["status"] = "normal"
    elif lo is not None and cmp_value < lo:
        row["status"] = "low"
    elif hi is not None and cmp_value > hi:
        row["status"] = "high"
    else:
        row["status"] = "normal"

    if t:
        if t.bands and std is not None:
            row["band"] = t.bands(std)
        if std is not None and ((t.critical_low is not None and std < t.critical_low) or (t.critical_high is not None and std > t.critical_high)):
            row["critical"] = True
        if row["status"] == "high":
            row["meaning"] = t.high_means
        elif row["status"] == "low":
            row["meaning"] = t.low_means
    return row


def evaluate(rows: list[dict], sex: Optional[str] = None) -> dict:
    out = [evaluate_row(r.get("name", ""), str(r.get("value", "")), r.get("unit", ""), r.get("refRange", ""), r.get("key", ""), sex) for r in rows]
    # The same test printed twice (e.g. a summary page): keep the first.
    seen, unique = set(), []
    for r in out:
        sig = (r["key"] or r["name"].lower(), r["valueText"])
        if sig not in seen:
            seen.add(sig)
            unique.append(r)
    counts = {s: sum(1 for r in unique if r["status"] == s) for s in ("normal", "high", "low", "check", "unknown")}
    critical = [r for r in unique if r["critical"]]
    alert = None
    if critical:
        names = ", ".join(r["display"] for r in critical[:4])
        alert = {
            "level": "urgent",
            "title": f"Some results need a doctor today: {names}",
            "text": "These values are far enough outside the normal range that a doctor should see them the same day. If you feel very unwell, faint, confused or have chest pain or palpitations, call 112.",
        }
    return {"tests": unique, "counts": counts, "alert": alert}
