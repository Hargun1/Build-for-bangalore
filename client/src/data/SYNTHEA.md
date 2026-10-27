# Synthetic patient demo data

`syntheaDemo.json` powers `/demo/patients`. These are fictional, linked Synthea medical records, not real people or personal accounts. The page is read-only: it does not seed MongoDB, call the risk engine, send notifications, or trigger SOS.

- Source: MITRE Synthea's [100 sample synthetic patient records, CSV](https://synthetichealth.github.io/downloads.html). Downloaded archive SHA-256: `990D52064037BBF83D10F13163DA428964B56AE673B7F39BF549D78C1E7EDA16`.
- Rebuild on Windows: `powershell -File client/scripts/buildSyntheaDemo.ps1 -Archive <path-to-downloaded-zip> -Output client/src/data/syntheaDemo.json` from the repository root. The script rejects a changed archive hash until its contents are reviewed.
- Transformation: select the first 50 living adult patient records (sorted by source ID) with at least one paired blood-pressure reading and two numeric lab observations. All observations, diagnoses, prescriptions, allergies, and visits are joined only through the same source patient ID. Exported profiles use fresh `Sample 01` labels and exclude names, addresses, source IDs, and synthetic identifiers.
- Measurements are the source's numeric values, units, and dates. Blood-pressure pairs are matched by encounter and timestamp. Labs show the latest recorded value for seven selected tests. No lab status, diagnosis, or medical recommendation is inferred. Conditions are source entries labelled as disorders; medications and allergies are open records in the source at that patient's last visit.
- Missing data stays missing. Synthea does not provide real daily step/distance history, food photos, emergency contacts, or live local air quality. Do not combine these profiles with the unrelated Fitbit participants or present them as real users.
