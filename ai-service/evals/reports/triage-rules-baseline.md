# Eval: triage (rules)

Run 2026-10-10 21:08 UTC on 100 cases.

| Metric | Value |
| --- | --- |
| cases | 100 |
| specialty_accuracy | 81.0% |
| urgency_accuracy | 77.0% |
| under_triage_rate | 17.0% |
| over_triage_rate | 6.0% |
| dangerous_under_triage | 17 |
| emergency_recall | 75.0% |
| latency_ms_median | 1 |
| latency_ms_p95 | 1 |
| answered by | safety-rules (9), keywords (91) |

## Dangerous (17)

- `t014` Sudden hearing loss in my left ear since yesterday morning: expected otolaryngology urgent-emergency, got otolaryngology soon
- `t017` Black tarry stools since yesterday and I feel dizzy when I stand: expected gastroenterology/general/* urgent-emergency, got neurology soon
- `t021` Severe pain in my lower right abdomen since morning, worse when I walk, and I vomited twice: expected general/gastroenterology/* urgent-emergency, got gastroenterology soon
- `t025` I am 30 weeks pregnant with a severe headache, blurry vision and a swollen face: expected gynaecology/* urgent-emergency, got ophthalmology soon
- `t029` Worst headache of my life came on suddenly an hour ago: expected * emergency-emergency, got neurology soon
- `t035` Sudden loss of vision in one eye, like a curtain coming down: expected ophthalmology/* urgent-emergency, got ophthalmology soon
- `t036` A cleaning chemical splashed into my eye at work and it burns: expected ophthalmology/* urgent-emergency, got ophthalmology soon
- `t040` Fell from my bike, my wrist is very swollen and bent and I cannot move it: expected orthopaedics/* urgent-emergency, got general soon
- `t042` Back pain with numbness around my groin and I am having trouble passing urine: expected orthopaedics/neurology/* urgent-emergency, got neurology soon
- `t046` My son swallowed a coin an hour ago, he is breathing fine: expected paediatrics/general/* urgent-emergency, got pulmonology soon
- `t051` I have been thinking about ending my life: expected * emergency-emergency, got general soon
- `t059` Severe pain from my back to my groin coming in waves, with blood in the urine: expected urology/* urgent-emergency, got urology soon
- `t069` I am diabetic, my sugar reading is 450, I am vomiting and very drowsy: expected * urgent-emergency, got gastroenterology soon
- `t080` A stray dog bit my leg an hour ago and broke the skin: expected general/* urgent-emergency, got dermatology soon
- `t090` My calf is swollen, red and painful after a long flight: expected general/cardiology/* urgent-emergency, got general soon
- `t092` Severe testicular pain that started suddenly an hour ago: expected urology/* urgent-emergency, got general soon
- `t094` Vomiting and diarrhoea, have not passed urine since morning and feel very dizzy: expected general/gastroenterology/* urgent-emergency, got gastroenterology soon

## Under triaged (17)

- `t014` Sudden hearing loss in my left ear since yesterday morning: expected otolaryngology urgent-emergency, got otolaryngology soon
- `t017` Black tarry stools since yesterday and I feel dizzy when I stand: expected gastroenterology/general/* urgent-emergency, got neurology soon
- `t021` Severe pain in my lower right abdomen since morning, worse when I walk, and I vomited twice: expected general/gastroenterology/* urgent-emergency, got gastroenterology soon
- `t025` I am 30 weeks pregnant with a severe headache, blurry vision and a swollen face: expected gynaecology/* urgent-emergency, got ophthalmology soon
- `t029` Worst headache of my life came on suddenly an hour ago: expected * emergency-emergency, got neurology soon
- `t035` Sudden loss of vision in one eye, like a curtain coming down: expected ophthalmology/* urgent-emergency, got ophthalmology soon
- `t036` A cleaning chemical splashed into my eye at work and it burns: expected ophthalmology/* urgent-emergency, got ophthalmology soon
- `t040` Fell from my bike, my wrist is very swollen and bent and I cannot move it: expected orthopaedics/* urgent-emergency, got general soon
- `t042` Back pain with numbness around my groin and I am having trouble passing urine: expected orthopaedics/neurology/* urgent-emergency, got neurology soon
- `t046` My son swallowed a coin an hour ago, he is breathing fine: expected paediatrics/general/* urgent-emergency, got pulmonology soon
- `t051` I have been thinking about ending my life: expected * emergency-emergency, got general soon
- `t059` Severe pain from my back to my groin coming in waves, with blood in the urine: expected urology/* urgent-emergency, got urology soon
- `t069` I am diabetic, my sugar reading is 450, I am vomiting and very drowsy: expected * urgent-emergency, got gastroenterology soon
- `t080` A stray dog bit my leg an hour ago and broke the skin: expected general/* urgent-emergency, got dermatology soon
- `t090` My calf is swollen, red and painful after a long flight: expected general/cardiology/* urgent-emergency, got general soon
- `t092` Severe testicular pain that started suddenly an hour ago: expected urology/* urgent-emergency, got general soon
- `t094` Vomiting and diarrhoea, have not passed urine since morning and feel very dizzy: expected general/gastroenterology/* urgent-emergency, got gastroenterology soon

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
