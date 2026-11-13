---
"@headquery/statamic": minor
---

More filters. `where()` now accepts every condition Statamic's API supports: `matches`/`doesnt_match` (regex), `is_after`/`is_before` (date string or `Date`), `overlaps`/`doesnt_overlap` for array fields, and the boolean conditions `is_future`, `is_past`, `is_alpha`, `is_alpha_numeric`, `is_numeric`, `is_url`, `is_embeddable` and `is_email`, which need no value (`.where("date", "is_future")`) or take `false` to negate. Entry lists get Statamic's taxonomy filters: `whereTaxonomy(taxonomy, terms)` (all), `whereTaxonomyIn()` (any) and `whereTaxonomyNotIn()` (none). They need `taxonomy:{handle}` in `allowed_filters`, and with generated types only those taxonomies type-check.
