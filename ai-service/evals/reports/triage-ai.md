# Eval: triage (ai)

Run 2026-10-10 22:01 UTC on 100 cases.

| Metric | Value |
| --- | --- |
| cases | 100 |
| specialty_accuracy | 100.0% |
| urgency_accuracy | 82.0% |
| under_triage_rate | 0.0% |
| over_triage_rate | 18.0% |
| dangerous_under_triage | 0 |
| emergency_recall | 100.0% |
| latency_ms_median | 1574 |
| latency_ms_p95 | 4531 |
| answered by | safety-rules (13), gemini:gemini-3.5-flash-lite (63), safety-ai (11), gemini:gemini-3.1-flash-lite (13) |

## Over triaged (18)

- `t001` I get chest tightness when I climb stairs that goes away when I rest, for the last month: expected cardiology/general soon-urgent, got general emergency
- `t003` My BP readings at home are 150/95 for two weeks, I feel fine otherwise: expected cardiology/general routine-soon, got general urgent
- `t004` Swelling in both ankles and I get breathless when lying flat at night: expected cardiology/general/pulmonology/nephrology soon-urgent, got general emergency
- `t010` My hair is falling out in round bald patches: expected dermatology routine-soon, got dermatology urgent
- `t019` Loose motions 6 times today but I can still drink water and eat a little: expected general/gastroenterology routine-soon, got gastroenterology urgent
- `t022` Irregular periods for 6 months along with acne and weight gain: expected gynaecology/endocrinology routine-soon, got gynaecology urgent
- `t023` Very heavy periods with clots and I feel tired all the time: expected gynaecology/general routine-soon, got gynaecology urgent
- `t026` White vaginal discharge with itching for a week: expected gynaecology routine-soon, got gynaecology urgent
- `t027` Throbbing headaches twice a month with sensitivity to light and nausea: expected neurology/general routine-soon, got general urgent
- `t028` Tingling and numbness in both feet for months, I have diabetes: expected neurology/endocrinology/general routine-soon, got endocrinology urgent
- `t033` Red itchy watery eyes with sticky discharge in the morning: expected ophthalmology/general routine-soon, got ophthalmology urgent
- `t045` My child has had a cough for 3 weeks that is worse at night: expected paediatrics/pulmonology routine-soon, got paediatrics urgent
- `t049` Panic attacks every week with a racing heart and fear of dying: expected psychiatry/general routine-soon, got psychiatry urgent
- `t056` I snore loudly, wake up tired and my wife says I stop breathing at night: expected pulmonology/otolaryngology/general routine-soon, got pulmonology urgent
- `t058` Burning while passing urine and going very often for two days: expected urology/general/gynaecology routine-soon, got urology urgent
- `t070` A swelling at the front of my neck that moves when I swallow: expected endocrinology/otolaryngology/general routine-soon, got endocrinology urgent
- `t088` I fainted while standing in a queue, woke up within seconds and feel fine now: expected general/cardiology/neurology soon-urgent, got general emergency
- `t097` Painful finger joints with morning stiffness for three months: expected orthopaedics/general routine-soon, got orthopaedics urgent
