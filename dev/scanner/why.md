# Why We Built the Scanner (and Why We Moved Away)

## Why build it

The scanner was the architecturally "correct" solution. The regex pipeline has
a fundamental ordering problem: links/images are rendered to HTML first, then
emphasis regexes see the raw HTML string including attribute values. Any fix
that keeps the regex pipeline is a patch over this ordering issue.

The scanner solves this structurally — it walks the string once, identifies
constructs in priority order (image > link > autolink > bold > strikethrough >
italic > plain text), and never re-scans URL content. Link *text* gets
recursive scanning (emphasis in link text is valid markdown). This mirrors
the approach used in `quikdown_ast.js` and other structural parsers.

The first implementation used 7 nested helper functions (~237 lines). This was
refactored to a single function with inline if/else-if branches (~120 lines),
reducing the ESM minified bundle from 11.8 KB to 10.8 KB (vs the original
9.5 KB pre-scanner).

## Why we moved away

The bug affects a narrow case — emphasis markers inside URL attribute values.
The scanner added ~1.5 KB (15%) to the core parser to fix it. For a project
that advertises being small and lightweight, that's a meaningful cost.

The attribute-placeholder approach (Approach C) fixes the same bug in ~10 lines
with zero size impact. It's a patch, not a structural fix, but:

1. The regex pipeline works correctly for 99%+ of inputs
2. The only problematic case is emphasis markers inside already-rendered
   attribute values — and protecting those attributes specifically is clean
3. The patch is obvious, auditable, and easy to explain
4. It preserves the parser's size advantage

The scanner remains a valid approach if the parser ever needs more sophisticated
inline handling (e.g., nested emphasis, link-within-link). It's archived here
for reference.

## Lessons learned

- Don't let architectural purity override project values (small size, simplicity)
- A 10-line surgical fix beats a 120-line rewrite when the bug is narrow
- Consider the fix-to-impact ratio before choosing an approach
- Outside PRs (even imperfect ones) provide valuable signal about the right fix
