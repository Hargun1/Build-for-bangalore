"""Lab report reader: the code that checks what the model copied from the report."""
import json

import httpx
from fastapi.testclient import TestClient

from app import llm as llm_module
from app.config import ProviderConfig
from app.labs import evaluate, evaluate_row, match, parse_number, parse_range


def test_names_match_the_right_test_and_lookalikes_do_not():
    assert match("Haemoglobin (Hb)").key == "hemoglobin"
    assert match("SGPT (ALT)").key == "alt"
    assert match("Glucose (F)").key == "glucose_fasting"
    assert match("LDL Cholesterol - Direct").key == "ldl"
    assert match("25-OH Vitamin D").key == "vitamin_d"
    # Different tests that contain a catalogue name:
    assert match("Mean Corpuscular Hemoglobin (MCH)") is None
    assert match("VLDL Cholesterol") is None
    assert match("Non-HDL Cholesterol") is None
    assert match("Bilirubin Direct") is None
    assert match("Urine Glucose") is None


def test_model_key_is_only_a_hint():
    # The model says "ldl" but the printed name is plainly something else: don't relabel.
    assert match("Serum Iron", key_hint="ldl") is None


def test_number_and_range_parsing():
    assert parse_number("1,50,000") == (150000.0, "")
    assert parse_number("< 0.5") == (0.5, "<")
    assert parse_range("70 - 100") == (70.0, 100.0)
    assert parse_range("70 to 100 mg/dL") == (70.0, 100.0)
    assert parse_range("Upto 40") == (None, 40.0)
    assert parse_range("Desirable: <200 Borderline: 200-239 High: >240") == (None, 200.0)
    assert parse_range("Non-diabetic: < 5.7") == (None, 5.7)
    assert parse_range("see note") == (None, None)


def test_the_labs_printed_range_wins():
    r = evaluate_row("Fasting Blood Sugar", "105", "mg/dL", "70-110")
    assert r["status"] == "normal" and r["rangeSource"] == "report"
    r = evaluate_row("Fasting Blood Sugar", "105", "mg/dL", "")
    assert r["status"] == "high" and r["rangeSource"] == "standard"
    assert "prediabetes" in r["band"]


def test_units_are_converted_for_charts_and_fallback_ranges():
    r = evaluate_row("Glucose Fasting", "7.2", "mmol/L")
    assert r["standardValue"] == 129.72 and r["status"] == "high" and "diabetes range" in r["band"]
    r = evaluate_row("Platelet Count", "1.2", "lakhs/cumm")
    assert r["standardValue"] == 120 and r["status"] == "low"
    r = evaluate_row("Total WBC count", "7,200", "cells/cumm")
    assert r["standardValue"] == 7.2 and r["status"] == "normal"
    r = evaluate_row("HbA1c", "53", "mmol/mol")
    assert 6.9 < r["standardValue"] < 7.1


def test_impossible_values_are_not_explained():
    r = evaluate_row("Haemoglobin", "135", "g/dL", "13-17")  # decimal point lost
    assert r["status"] == "check" and "correct it" in r["note"]


def test_sex_specific_ranges_and_higher_is_better():
    assert evaluate_row("Haemoglobin", "12.5", "g/dL", sex="female")["status"] == "normal"
    assert evaluate_row("Haemoglobin", "12.5", "g/dL", sex="male")["status"] == "low"
    # HDL printed as risk bands: '<40' must not be read as an upper limit.
    r = evaluate_row("HDL Cholesterol", "55", "mg/dL", "Low: <40 High: >60")
    assert r["status"] == "normal" and r["rangeSource"] == "standard"
    assert evaluate_row("HDL Cholesterol", "35", "mg/dL", "> 40")["status"] == "low"


def test_critical_values_raise_an_alert():
    out = evaluate([{"name": "Potassium", "value": "6.8", "unit": "mmol/L", "refRange": "3.5-5.1"}, {"name": "Sodium", "value": "139", "unit": "mmol/L"}])
    assert out["tests"][0]["critical"] and out["alert"]["level"] == "urgent"
    assert out["counts"]["high"] == 1 and out["counts"]["normal"] == 1


def test_unknown_test_with_printed_range_is_still_judged():
    r = evaluate_row("Serum Iron", "40", "ug/dL", "60-170")
    assert r["key"] is None and r["status"] == "low"
    assert evaluate_row("Serum Iron", "40", "ug/dL")["status"] == "unknown"


# ------------------------------------------------------------------ endpoints

def client_with(reply: dict):
    def handler(req):
        return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(reply)}}]})

    p = ProviderConfig(name="gemini", base_url="https://g.test/v1", api_key="k", text_models=["m"], vision_models=["m"])
    llm_module.set_llm(llm_module.LLMClient(providers=[p], http=httpx.AsyncClient(transport=httpx.MockTransport(handler)), timeout=5))
    import main

    return TestClient(main.app)


IMG = "data:image/jpeg;base64," + "A" * 200


def test_read_endpoint_checks_what_the_model_copied():
    c = client_with({"isLabReport": True, "labName": "City Lab", "reportDate": "2026-09-30", "tests": [
        {"name": "HbA1c", "key": "hba1c", "value": "6.8", "unit": "%", "refRange": "4.0-5.6"},
        {"name": "Total Cholesterol", "key": "cholesterol_total", "value": "182", "unit": "mg/dL", "refRange": "<200"},
    ]})
    res = c.post("/labs/read", json={"images": [IMG], "sex": "male"}).json()
    assert res["isLabReport"] and res["reportDate"] == "2026-09-30"
    a1c = res["tests"][0]
    assert a1c["status"] == "high" and "diabetes range" in a1c["band"] and a1c["organs"]
    assert a1c["source"]["url"].startswith("https://medlineplus.gov")
    assert res["counts"]["high"] == 1 and "1 of 2" in res["summary"]


def test_read_endpoint_rejects_non_reports():
    c = client_with({"isLabReport": False, "tests": []})
    assert c.post("/labs/read", json={"images": [IMG]}).json()["isLabReport"] is False


def test_evaluate_endpoint_needs_no_ai():
    c = client_with({})
    res = c.post("/labs/evaluate", json={"tests": [{"name": "Vitamin D", "value": "14", "unit": "ng/mL"}]}).json()
    assert res["tests"][0]["status"] == "low" and res["tests"][0]["meaning"]
