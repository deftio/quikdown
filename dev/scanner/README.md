# Scanner Approach — Archived

This directory preserves the character-walking inline scanner that was implemented
for issue #3 (underscores in URLs converted to `<em>` tags). The scanner replaced
the regex pipeline in Step 4 of `quikdown()` with a single-function character walker
that processes inline constructs in priority order.

It was replaced with a simpler attribute-placeholder approach (Approach C) that
fixes the same bug with ~10 lines instead of ~120.

## Contents

- `scanInline.js` — the scanner function (final single-function version)
- `original-regex-pipeline.js` — the v1.2.9 regex pipeline it replaced
- `tradeoffs.md` — size/complexity/correctness comparison of all approaches
- `why.md` — rationale for building it, and why we moved away

## Timeline

- v1.2.9: regex pipeline (original, has the bug)
- branch `fix/url-underscore-parsing-bug-3`: scanner implemented (7 nested helpers, ~237 lines)
- refactored to single function (~120 lines, 11.8 KB -> 11.0 KB ESM minified)
- reverted to attribute-placeholder approach (Approach C)
