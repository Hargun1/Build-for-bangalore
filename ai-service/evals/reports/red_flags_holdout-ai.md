# Eval: red_flags_holdout (ai)

Run 2026-10-10 21:30 UTC on 25 cases.

| Metric | Value |
| --- | --- |
| cases | 25 |
| immediate_recall | 100.0% |
| urgent_recall | 100.0% |
| false_positive_rate | 55.6% |
| precision | 76.2% |
| exact_level_accuracy | 80.0% |

## False positives (5)

- `h017` Is it normal to feel chest discomfort while doing bench press?: expected None, got emergency
- `h018` My uncle survived a heart attack a decade ago, what should he eat?: expected None, got emergency
- `h020` I can't breathe properly through my blocked nose at night: expected None, got emergency
- `h022` How do I give first aid to someone having a seizure?: expected None, got emergency
- `h025` my dog bite wound from last month has healed: expected None, got urgent
