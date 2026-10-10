# Eval: red_flags (rules)

Run 2026-10-10 21:07 UTC on 67 cases.

| Metric | Value |
| --- | --- |
| cases | 67 |
| immediate_recall | 71.1% |
| urgent_recall | 100.0% |
| false_positive_rate | 33.3% |
| precision | 80.0% |
| exact_level_accuracy | 71.6% |

## Missed (11)

- `r002` Heavy pressure in my chest and I'm sweating: expected emergency, got None
- `r007` my chest hurts badly and the pain goes to my jaw: expected emergency, got None
- `r010` his speech is slurred and he can't lift his right arm: expected emergency, got None
- `r011` left side of my body suddenly went numb: expected emergency, got None
- `r013` worst headache of my life came on suddenly: expected emergency, got None
- `r017` his lips are turning blue: expected emergency, got None
- `r031` I've been thinking about ending my life: expected crisis, got None
- `r032` I don't want to live anymore: expected crisis, got None
- `r034` thinking of hurting myself tonight: expected crisis, got None
- `r037` planning to take all my sleeping pills at once: expected crisis, got None
- `r038` I have been cutting myself again: expected crisis, got None

## False positives (8)

- `n003` How can I lower my risk of a heart attack?: expected None, got emergency
- `n004` My grandfather had a stroke five years ago and recovered well: expected None, got emergency
- `n005` What are the risk factors for stroke?: expected None, got emergency
- `n006` I can't breathe through my nose because of a cold: expected None, got emergency
- `n012` How do I prevent a head injury while cycling?: expected None, got emergency
- `n013` What is a seizure and what causes it?: expected None, got emergency
- `n019` My father had a heart attack in 2019, what diet should he follow now?: expected None, got emergency
- `n025` My child had a seizure last year, which doctor should follow up?: expected None, got emergency
