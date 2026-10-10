# Eval: triage (ai)

Run 2026-10-10 21:48 UTC on 100 cases.

| Metric | Value |
| --- | --- |
| cases | 100 |
| specialty_accuracy | 100.0% |
| urgency_accuracy | 83.0% |
| under_triage_rate | 0.0% |
| over_triage_rate | 17.0% |
| dangerous_under_triage | 0 |
| emergency_recall | 100.0% |
| latency_ms_median | 1616 |
| latency_ms_p95 | 5038 |
| answered by | safety-rules (14), gemini:gemini-3.7-flash (9), gemini:gemini-3.6-flash (5), gemini:gemini-3.5-flash (1), gemini:gemini-3.5-flash-lite (59), safety-ai (12) |

## Over triaged (17)

- `t001` I get chest tightness when I climb stairs that goes away when I rest, for the last month: expected cardiology/general soon-urgent, got general emergency
- `t002` My heart races and skips beats a few times a day, no chest pain: expected cardiology/general soon-urgent, got general emergency
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
- `t076` Which vaccines do I need before travelling abroad next month: expected general routine-routine, got general soon
- `t088` I fainted while standing in a queue, woke up within seconds and feel fine now: expected general/cardiology/neurology soon-urgent, got general emergency
- `t097` Painful finger joints with morning stiffness for three months: expected orthopaedics/general routine-soon, got orthopaedics urgent
- `t099` Bad breath even though I brush twice a day: expected dentistry/general/gastroenterology routine-routine, got general soon
