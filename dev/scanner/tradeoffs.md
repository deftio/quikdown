# Approach Comparison — Issue #3 Fix

## The Bug

Emphasis regexes (`_text_`, `**text**`, etc.) run on the full HTML string after
links and images are rendered. Underscores/asterisks inside `href` and `src`
attribute values get interpreted as emphasis markers:

```
Input:  [Link](https://example.org/file_mytest_123.pdf)
Output: <a href="https://example.org/file<em>mytest</em>123.pdf">Link</a>
```

## Approaches Considered

### A: PR #4 — Full-tag placeholder (bensonjacob100)

Protect entire `<a>...</a>` and `<img>` elements with placeholders before
running emphasis regexes, restore after.

```js
const protectedBlocks = [];
html = html.replace(/(<a\b[^>]*>.*?<\/a>|<img\b[^>]*>)/gis, (match) => {
    const key = `%%URL${protectedBlocks.length}%%`;
    protectedBlocks.push(match);
    return key;
});
// ... emphasis regexes run ...
html = html.replace(/%%URL(\d+)%%/g, (_, i) => protectedBlocks[i]);
```

| Metric           | Value                               |
|------------------|-------------------------------------|
| Lines added      | +13                                 |
| Size impact      | ~0                                  |
| Link text emphasis | Broken — over-protects link text  |
| Robustness       | Good for URLs, but blocks valid emphasis in link text |

### B: Character-walking scanner (this archive)

Replace the entire regex pipeline with a character walker that processes
constructs in priority order. URLs emitted verbatim, link text recursively
scanned.

| Metric           | Value                               |
|------------------|-------------------------------------|
| Lines added      | +120 (net +75 after deleting regexes) |
| Size impact      | +1.5 KB (~15% of core parser)       |
| Link text emphasis | Correct                           |
| Robustness       | Best — structurally prevents the bug |

### C: Attribute-only placeholder (adopted approach)

Protect only `href="..."` and `src="..."` attribute *values* before emphasis,
restore after. Link text remains exposed to emphasis processing.

```js
const savedAttrs = [];
html = html.replace(/(href|src)="([^"]*)"/g, (m, attr, val) => {
    savedAttrs.push(val);
    return `${attr}="%%ATTR${savedAttrs.length - 1}%%"`;
});
// ... emphasis regexes unchanged ...
html = html.replace(/%%ATTR(\d+)%%/g, (_, i) => savedAttrs[i]);
```

| Metric           | Value                               |
|------------------|-------------------------------------|
| Lines added      | ~10                                 |
| Size impact      | ~0                                  |
| Link text emphasis | Correct — only attrs are protected |
| Robustness       | Good                                |

### D: Regex negative lookahead

Modify emphasis regexes to skip matches inside `="..."` attribute values.

| Metric           | Value                               |
|------------------|-------------------------------------|
| Lines changed    | ~5                                  |
| Size impact      | ~0                                  |
| Link text emphasis | Correct                           |
| Robustness       | Fragile — hard to get right for all nesting |

## Decision Matrix

|                  | Lines | Size   | Correctness | Simplicity | Contributor credit |
|------------------|-------|--------|-------------|------------|-------------------|
| A: PR #4         | +13   | 0      | Partial     | High       | Yes               |
| B: Scanner       | +75   | +1.5KB | Full        | Low        | No                |
| C: Attr-only     | +10   | 0      | Full        | High       | Co-author         |
| D: Lookahead     | +5    | 0      | Full        | Low        | No                |

## Recommendation

Approach C. Same spirit as PR #4 (placeholder-based), but scoped correctly
to attribute values. Smallest correct fix. Credits the PR author via
`Co-authored-by` trailer.
