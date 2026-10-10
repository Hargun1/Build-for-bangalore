# Evaluations

How well do PranexusAI's safety checks and triage actually work? These suites measure it with fixed test sets, so changes can be compared with numbers instead of impressions.

```bash
cd ai-service
python -m evals.run --suite red_flags                       # emergency rules, tuned set
python -m evals.run --suite red_flags_holdout               # emergency rules, unseen phrasings
python -m evals.run --suite triage --mode rules             # triage with the AI switched off
python -m evals.run --suite red_flags_holdout --mode ai     # rules + AI safety classifier (needs a key)
python -m evals.run --suite triage --mode ai --delay 4      # full AI triage (needs a key)
```

Each run writes `reports/<suite>-<mode>.md` (readable summary with every failure) and `.json` (raw rows).

## Test sets

| File | Cases | What it checks |
| --- | --- | --- |
| `datasets/triage.jsonl` | 100 | Symptom descriptions across 16 specialties, emergencies and 4 Hinglish messages. Each has the acceptable specialties and an acceptable urgency range (e.g. `soon`–`urgent`). |
| `datasets/red_flags.jsonl` | 67 | 29 emergencies, 9 suicide/self-harm messages, 5 urgent cases and 24 tricky non-emergencies ("chest day at the gym", "what are the risk factors for stroke?", "this traffic is killing me"). |
| `datasets/red_flags_holdout.jsonl` | 25 | New phrasings written after the rules were tuned, never used for tuning. |

**Limitations, stated plainly:** the cases are written and labelled by the developer using standard triage guidance, not reviewed by a clinician, and they are short single messages. Treat the numbers as engineering regression checks, not clinical validation.

## Metrics

- **Immediate recall:** share of emergencies and crises that got the "call now" response. The most important number; it must be 100% on the tuned set (CI gate).
- **False-positive rate:** share of safe messages that raised an alarm.
- **Urgency accuracy:** predicted urgency inside the acceptable range.
- **Dangerous under-triage:** cases that needed care within 24 hours but were told "this week" or later. Must be 0 with the AI off (CI gate).

## Results

### Emergency rules (`red_flags`, 67 cases)

| | Before | After rule rewrite |
| --- | --- | --- |
| Emergencies and crises caught | 71.1% | **100%** |
| Urgent cases caught | 100% | 100% |
| False alarms on safe messages | 33.3% | **0%** |

The first version missed five ways of expressing suicidal intent ("I don't want to live anymore") and treated questions about heart attacks as emergencies.

### Triage with the AI off (`triage --mode rules`, 100 cases)

| | Before | After |
| --- | --- | --- |
| Urgency within the acceptable range | 77% | **94%** |
| Dangerous under-triage | 17 cases | **0** |
| Emergencies sent to "call now" | 75% | **100%** |
| Specialty correct | 81% | 81% |

### Unseen phrasings (`red_flags_holdout`, 25 cases, rules only)

| | Rules only |
| --- | --- |
| Emergencies and crises caught | **16.7%** (2 of 12) |
| Urgent cases caught | 0% |
| False alarms | 44.4% |

This is the honest finding of the exercise. The rules score perfectly on the cases they were written against and poorly on new wording ("there's an elephant sitting on my chest", "I've written goodbye letters"). Keyword rules memorise phrasings.

The response was structural, not more patterns: an **AI safety classifier** (`app/safety.py`) now runs alongside the rules in chat and triage, and the more severe verdict wins. The rules stay as the fast, offline floor; the classifier adds understanding of meaning. Tests cover that the classifier can escalate but never downgrade a rule-based emergency, and that everything falls back to the rules when no AI provider is reachable.

### Unseen phrasings with the AI safety layer (`red_flags_holdout --mode ai`)

| | Rules only | Rules + AI classifier |
| --- | --- | --- |
| Emergencies and crises caught | 2 of 12 | **12 of 12** |
| Urgent cases caught | 0 of 4 | **4 of 4** |
| False alarms on safe messages | 4 of 9 | 5 of 9 |

Model: Gemini (free tier), run 2026-10-11. Every emergency, crisis and urgent case received a real AI verdict. Three safe messages fell back to the rules after the free quota ran out; since the classifier can only escalate, the false-alarm figure is a lower bound. Four of the five false alarms come from the rules (e.g. "how do I give first aid to someone having a seizure?"), which the classifier is not allowed to override, by design: a missed emergency costs far more than an unnecessary "call 112" banner.

### Retrieval for cited answers (`retrieval`, 40 questions)

Questions are phrased the way people in India ask ("loose motions", "high bp", "sugar is 180"); each lists the MedlinePlus topics that would be correct.

| Retriever | Hit in top 1 | Top 3 | Top 5 | MRR |
| --- | --- | --- | --- | --- |
| BM25 keyword search | 55% | 80% | 87.5% | 0.688 |
| BM25 + Indian-term expansion and British spelling | **60%** | **85%** | **90%** | **0.732** |

The remaining misses are vocabulary gaps keyword search cannot bridge ("TSH high" for hypothyroidism, "stop diabetes from happening" for prevention). Embedding search addresses them; the hybrid row will be added once the topic embeddings finish building (the free embedding quota is 1,000 a day).
