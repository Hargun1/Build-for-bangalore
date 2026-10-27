# Fitbit activity demo data

`fitbitDemo.json` is a compact, read-only extract of historical Fitbit daily activity records. It powers `/demo/fitbit`; it is not imported into user accounts or used for risk scoring.

- Original study: Furberg, Brinton, Keating and Ortiz, [Crowd-sourced Fitbit datasets 03.12.2016-05.12.2016](https://zenodo.org/records/53894), DOI `10.5281/zenodo.53894`. The study reports 30 consenting Fitbit users.
- CSV used: [health-hacks mirror, dailyActivity_merged.csv](https://github.com/health-hacks/datasets/blob/master/fitbit-mturk/various-participants/fitabase-data-3-12-16-to-4-11-16/dailyActivity_merged.csv), SHA-256 `2C254D2473623831D8E8837E8D1A647088207C3050221DE8BEA8BBFB192E4354`.
- The [Kaggle listing](https://www.kaggle.com/arashnic/fitbit/metadata) identifies the distributed dataset as CC0. The original Zenodo record does not display a license, so retain attribution and verify rights again before wider redistribution.
- Transformation: 35 distinct CSV `participant-id` values become `Profile 01` through `Profile 35` in sorted-ID order. The original identifiers are not included. The 457 dated rows retain reported steps, distance in km (rounded to 0.01), and the sum of lightly/fairly/very active minutes. Missing days remain missing. Timestamp dates are interpreted in UTC.
- These IDs are activity profiles, not a claim that the study had 35 distinct people. Data is from 2016, is not live, and contains no medical diagnoses.
