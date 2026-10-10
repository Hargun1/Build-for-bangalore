# Eval: triage (rules)

Run 2026-10-10 21:12 UTC on 100 cases.

| Metric | Value |
| --- | --- |
| cases | 100 |
| specialty_accuracy | 81.0% |
| urgency_accuracy | 94.0% |
| under_triage_rate | 0.0% |
| over_triage_rate | 6.0% |
| dangerous_under_triage | 0 |
| emergency_recall | 100.0% |
| latency_ms_median | 1 |
| latency_ms_p95 | 1 |
| answered by | safety-rules (14), keywords (86) |

## Over triaged (6)

- `t001` I get chest tightness when I climb stairs that goes away when I rest, for the last month: expected cardiology/general soon-urgent, got general emergency
- `t002` My heart races and skips beats a few times a day, no chest pain: expected cardiology/general soon-urgent, got general emergency
- `t075` I want a full body health checkup, I have no symptoms: expected general routine-routine, got general soon
- `t076` Which vaccines do I need before travelling abroad next month: expected general routine-routine, got general soon
- `t081` Small cut on my finger while cooking, the bleeding has stopped: expected general routine-routine, got general soon
- `t099` Bad breath even though I brush twice a day: expected dentistry/general/gastroenterology routine-routine, got pulmonology soon

## Wrong specialty (19)

- `t007` Pimples on my face and back for a year that leave dark marks: expected dermatology routine-soon, got otolaryngology soon
- `t008` A mole on my back has changed shape and colour recently and sometimes bleeds: expected dermatology soon-urgent, got general soon
- `t010` My hair is falling out in round bald patches: expected dermatology routine-soon, got general soon
- `t018` My eyes have turned yellow and my urine is dark for a week: expected gastroenterology/general soon-urgent, got ophthalmology soon
- `t022` Irregular periods for 6 months along with acne and weight gain: expected gynaecology/endocrinology routine-soon, got dermatology soon
- `t026` White vaginal discharge with itching for a week: expected gynaecology routine-soon, got dermatology soon
- `t030` My hand shakes when I hold a cup and it is slowly getting worse over a year: expected neurology routine-soon, got otolaryngology soon
- `t033` Red itchy watery eyes with sticky discharge in the morning: expected ophthalmology/general routine-soon, got dermatology soon
- `t043` My 2 year old has a fever of 101 F and a runny nose but is playing normally: expected paediatrics routine-soon, got otolaryngology soon
- `t047` My 8 year old's teacher says he cannot focus and is very restless in class: expected paediatrics/psychiatry routine-soon, got otolaryngology soon
- `t049` Panic attacks every week with a racing heart and fear of dying: expected psychiatry/general routine-soon, got otolaryngology soon
- `t052` My brother has been hearing voices nobody else hears for two weeks: expected psychiatry soon-urgent, got otolaryngology soon
- `t055` Smoker for 20 years, I cough up phlegm every morning: expected pulmonology/general routine-soon, got otolaryngology soon
- `t060` 62 year old man with a weak urine stream, getting up three times at night to pee: expected urology routine-soon, got otolaryngology soon
- `t071` Puffy face every morning and foamy urine for a few weeks: expected nephrology/general soon-urgent, got urology soon
- `t072` My creatinine is 2.1 on the report, I have diabetes and high blood pressure: expected nephrology/general/endocrinology soon-urgent, got cardiology soon
- `t077` High fever of 103 for 3 days with severe body pain and pain behind my eyes: expected general soon-urgent, got ophthalmology soon
- `t098` Heel pain with the first steps every morning: expected orthopaedics routine-soon, got general soon
- `t099` Bad breath even though I brush twice a day: expected dentistry/general/gastroenterology routine-routine, got pulmonology soon
