# quikdown v1.2.7 (regex) vs quikdown_lex (scanner/grammar)

Comprehensive comparison — 156 tests across 14 categories, plus performance and size benchmarks.

**Test harness:** `dev/lex/test-comparison.js`  
**Date:** 2026-04-11  
**Platform:** Node.js 24.x, Linux x86_64

---

## Feature Parity Summary

| Category | Tests | Match | Diff | Parity |
|----------|------:|------:|-----:|--------|
| Headings | 13 | 12 | 1 | 92.3% |
| Paragraphs | 9 | 8 | 1 | 88.9% |
| Emphasis | 18 | 16 | 2 | 88.9% |
| Links | 12 | 6 | 6 | 50.0% |
| Security / XSS | 8 | 8 | 0 | **100%** |
| Fences | 21 | 12 | 9 | 57.1% |
| Lists | 16 | 15 | 1 | 93.8% |
| Blockquotes | 7 | 6 | 1 | 85.7% |
| Tables | 14 | 14 | 0 | **100%** |
| Horizontal Rules | 5 | 4 | 1 | 80.0% |
| Inline Styles | 8 | 6 | 2 | 75.0% |
| Fence Plugin | 3 | 1 | 2 | 33.3% |
| Edge Cases | 22 | 19 | 3 | 86.4% |
| **TOTAL** | **156** | **127** | **29** | **81.4%** |

---

## Mismatch Analysis

### Trivial / Style differences (easy fixes)

| # | Test | Issue | Fix effort |
|---|------|-------|-----------|
| 1 | Heading trailing hashes with spaces | Lex strips trailing `## ` correctly; main keeps `##` when trailing spaces exist | Lex is arguably more correct |
| 2 | Lazy linefeeds `<br>` | Lex emits `<br>`, main emits `<br class="quikdown-br">` | Lex needs `getAttr('br')` on br tags |
| 3 | H1 inline style | Main has `text-align:left`, lex omits it | Add `text-align:left` to lex h1 style |
| 4 | Fence inline styles | Main applies code style inside pre; lex doesn't | Apply code style in fence inline-style mode |
| 5 | Empty quote `>` | Main doesn't parse `>` alone; lex does | Minor — lex is arguably more correct |
| 6 | Whitespace-only input | Main wraps in `<p>`; lex returns `""` | Either is reasonable |

### Behavioral / Feature gaps in lex

| # | Test | Issue | Fix effort |
|---|------|-------|-----------|
| 7 | **Autolinks** | Lex doesn't convert bare `https://` URLs to `<a>` tags | Medium — add autolink regex to inline parser |
| 8 | **Fence plugin API** | Lex calls `this.opts.fence_plugin()` directly, but main expects `{ render: fn }` object | Easy — check for `.render` property |
| 9 | **Extended fences (4+ backticks)** | Main treats ```````` as inline code; lex treats as fence | Design decision (see below) |
| 10 | **Unclosed fences** | Lex renders unclosed fences as code blocks; main leaves as text | Design decision |
| 11 | **Mismatched fences** | Lex matches ``` with any ```, main requires exact match | Main's behavior is correct |
| 12 | **Link with empty text `[](url)`** | Main doesn't create link; lex does | Minor — match main |
| 13 | **Nested brackets `[[a]](url)`** | Main doesn't parse; lex does | Lex is more capable here |
| 14 | **Formatting across lines** | Lex allows `**bold\nnewline**`; main doesn't | Both are valid interpretations |
| 15 | **Deep list nesting (3+ levels)** | Lex closes sublists differently | Medium — align sublist handling |
| 16 | **Unclosed inline code** | Different leftover text on failed parse | Minor |
| 17 | **Empty bold `****`** | Main leaves as text; lex creates empty `<strong>` | Minor — add check |

### Design Decisions Needed

**Extended fences (4+ backticks):** The current regex parser treats ```````` as inline code runs, which produces garbled output. The lex parser treats them as fences (matching ```` with ````), which is CommonMark-correct behavior. **Recommendation:** Use lex's behavior — it's more useful and spec-compliant.

**Unclosed fences:** Main leaves unclosed fences as raw text. Lex renders them as code blocks (treating EOF as implicit close). **Recommendation:** Main's approach is safer — unclosed fences should not silently become code blocks.

---

## Performance

| Benchmark | Main (regex) | Lex (scanner) | Lex advantage |
|-----------|-------------|---------------|---------------|
| Small doc (5000 iters) | 22,000 ops/sec | 33,000 ops/sec | **+50%** |
| Large doc (100 iters) | 151 ops/sec | 321 ops/sec | **+113%** |

The lexer is significantly faster, especially on large documents. The scanner avoids repeated full-string regex passes, giving it a structural advantage that grows with document size.

---

## File Sizes

| File | Bytes | KB |
|------|------:|---:|
| quikdown.js (source) | 27,265 | 26.6 |
| quikdown.umd.min.js | 9,501 | 9.3 |
| quikdown.esm.min.js | 9,279 | 9.1 |
| quikdown_lex.js (source) | 19,799 | 19.3 |
| quikdown_lex.min.js | 9,226 | 9.0 |

Source: lex is **27% smaller** (19.3K vs 26.6K).  
Minified: lex is **~equal** (9.0K vs 9.1K ESM).

---

## Static API Compatibility

| API | Main | Lex | Match |
|-----|------|-----|-------|
| `emitStyles()` | Yes | Yes | OK |
| `emitStyles(prefix, theme)` | Yes (light/dark) | Yes (no theme param) | **Lex missing dark theme** |
| `configure(opts)` | Yes | Yes | OK |
| `version` | Yes | Yes | OK |

---

## What the Lex Version Buys Us

### Advantages
1. **50-113% faster** — scanner avoids repeated regex passes over the full document
2. **Smaller source** — 19.3K vs 26.6K, easier to read and maintain
3. **Equal minified size** — 9.0K vs 9.1K, no bundle penalty
4. **Debuggable** — step through Scanner + GrammarParser classes vs opaque regex chains
5. **Extensible** — adding a new block type = adding a `parseXxx()` method, not fitting a regex into a multi-pass pipeline
6. **Handles extended fences correctly** — 4+ backtick fences work as expected
7. **No placeholder system** — no `§CB§` / `§IC§` tokens that can leak on edge cases

### Risks
1. **29 mismatches** — need to fix before swapping (most are trivial)
2. **Missing autolinks** — easy to add
3. **Fence plugin API mismatch** — easy to fix
4. **No dark theme in emitStyles** — needs porting
5. **No bidirectional support** — the lex parser doesn't emit `data-qd` attributes (needed for quikdown_bd)

### Work Estimate to Reach Parity

| Task | Effort |
|------|--------|
| Fix fence plugin API (`{ render }` object) | 15 min |
| Add autolink detection to inline parser | 30 min |
| Fix `<br>` tag to use `getAttr('br')` | 5 min |
| Add `text-align:left` to h1 style | 2 min |
| Apply code style in fence inline-style mode | 10 min |
| Match main on empty bold/empty link behavior | 10 min |
| Fix unclosed fence behavior (leave as text) | 20 min |
| Fix mismatched fence handling | 15 min |
| Align deep list nesting | 30 min |
| Port dark theme to `emitStyles()` | 20 min |
| Add `bidirectional` / `data-qd` support | 2-3 hrs |
| Add `task-item` / `task-checkbox` styles | 10 min |
| **Total (excluding bidirectional)** | **~3 hrs** |
| **Total (including bidirectional)** | **~5-6 hrs** |

---

## Recommendation

The lexer is ready to become the primary parser with ~3 hours of alignment work (excluding bidirectional). It's faster, smaller in source, equal in minified size, and architecturally superior for maintenance and extension.

**Suggested approach:**
1. Fix the 29 mismatches on `feature/lexer-impl` branch
2. Run the full mainline test suite (`npm test`) against the lex parser
3. Port bidirectional support
4. Swap `src/quikdown.js` to use the lex engine
5. Run `test-comparison.js` to verify 100% parity
6. Ship as v1.3.0
