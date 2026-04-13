# Security Guide

## Overview

quikdown is designed with security as a primary concern. This document explains our security model, design choices, and best practices for safe usage.

## Core Security Principles

### 1. Escape by Default

**All HTML in markdown input is escaped**, preventing XSS attacks:

```javascript
const markdown = '<script>alert("XSS")</script> Hello **world**';
const html = quikdown(markdown);
// Output: &lt;script&gt;alert("XSS")&lt;/script&gt; Hello <strong>world</strong>
```

### 2. No HTML Passthrough

Unlike some markdown parsers, quikdown does **not** allow raw HTML to pass through by default. This is an intentional security decision.

**Why?**
- Prevents XSS attacks
- Eliminates stored XSS vulnerabilities
- Reduces security audit complexity
- Makes the parser safe for untrusted input

### 3. Trusted HTML via Fence Plugins

When you need to render trusted HTML, use the fence plugin system:

```javascript
const trustedHtmlPlugin = {
  render: (content, lang) => {
    // Only allow HTML from explicitly marked blocks
    if (lang === 'html-render' && isSourceTrusted()) {
      return content; // Return raw HTML
    }
    return undefined; // Fall back to escaping
  }
};

const html = quikdown(markdown, { 
  fence_plugin: trustedHtmlPlugin 
});
```

This approach makes trust **explicit and granular**.

## HTML Handling Strategies

### Strategy 1: Never Trust (Recommended)

The safest approach - all HTML is always escaped:

```javascript
// Safe for any user input
const html = quikdown(untrustedMarkdown);
```

### Strategy 2: Trusted Fence Blocks

Allow HTML only in specially marked fence blocks:

````markdown
Regular text with <script>escaped HTML</script>

```html-render
<div class="custom-widget">
  <!-- This HTML will be rendered if the plugin allows it -->
  <button onclick="doSomething()">Click me</button>
</div>
```
````

### Strategy 3: Server-Side Sanitization

If you need inline HTML, sanitize server-side before parsing:

```javascript
// Server-side
const sanitized = DOMPurify.sanitize(userInput);
const markdown = preprocessToMarkdown(sanitized);
const html = quikdown(markdown);
```

## XSS Prevention

### Attack Vectors Prevented

1. **Script Tag Injection**
   ```markdown
   <script>alert('XSS')</script>
   <!-- Rendered as: &lt;script&gt;alert('XSS')&lt;/script&gt; -->
   ```

2. **Event Handler Injection**
   ```markdown
   <img onerror="alert('XSS')" src="x">
   <!-- Rendered as: &lt;img onerror="alert('XSS')" src="x"&gt; -->
   ```

3. **JavaScript URLs**
   ```markdown
   [Click me](javascript:alert('XSS'))
   <!-- Rendered as: <a href="#">Click me</a> -->
   ```

4. **Data URI Attacks**
   ```markdown
   ![](data:text/html,<script>alert('XSS')</script>)
   <!-- Blocked — non-image data: URIs are replaced with # -->
   ```

### URL Sanitization

quikdown includes built-in URL sanitization via `sanitizeUrl()`. All URLs in links and images are checked against a blocklist of dangerous protocols:

- `javascript:` URLs are replaced with `#`
- `vbscript:` URLs are replaced with `#`
- `data:` URLs are replaced with `#` (except `data:image/*`, which is allowed)

## Fence Plugin Security

### Plugin Responsibilities

When you write a fence plugin, YOU are responsible for security:

```javascript
// UNSAFE - Don't do this with untrusted input!
const unsafePlugin = {
  render: (content, lang) => {
    return content; // Returns raw, unescaped HTML
  }
};

// SAFER - Validate and sanitize
const saferPlugin = {
  render: (content, lang) => {
    if (lang === 'mermaid') {
      // Mermaid handles its own escaping
      return `<div class="mermaid">${escapeHtml(content)}</div>`;
    }
    return undefined;
  }
};

// SAFEST - Use established libraries
const safestPlugin = {
  render: (content, lang) => {
    if (lang === 'html-preview') {
      // Use DOMPurify or similar
      return DOMPurify.sanitize(content, {
        ALLOWED_TAGS: ['div', 'span', 'p', 'a'],
        ALLOWED_ATTR: ['class', 'href']
      });
    }
    return undefined;
  }
};
```

### Plugin Best Practices

1. **Validate language identifiers** - Only handle expected languages
2. **Escape by default** - When in doubt, escape HTML
3. **Use allowlists** - Only allow known-safe constructs
4. **Sanitize output** - Use libraries like DOMPurify
5. **Document trust requirements** - Make it clear what input is expected

## Content Security Policy (CSP)

Use CSP headers to add defense-in-depth:

```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self'; 
               style-src 'self' 'unsafe-inline';">
```

Note: `unsafe-inline` for styles is needed if using `inline_styles: true`.

## Safe Usage Patterns

### Pattern 1: User Comments

```javascript
// Safe for user-generated content
function renderComment(userMarkdown) {
  return quikdown(userMarkdown, {
    inline_styles: false  // Use CSS classes
  });
}
```

### Pattern 2: Admin Content with Widgets

```javascript
// Admin users can embed widgets
function renderAdminContent(markdown, isAdmin) {
  const options = {};
  
  if (isAdmin) {
    options.fence_plugin = {
      render: (content, lang) => {
        if (lang === 'widget') {
          return renderWidget(JSON.parse(content));
        }
      }
    };
  }
  
  return quikdown(markdown, options);
}
```

### Pattern 3: Mixed Trust Levels

```javascript
// Different trust for different parts
function renderMixedContent(markdown, trustMap) {
  return quikdown(markdown, {
    fence_plugin: {
      render: (content, lang) => {
        const trust = trustMap[lang];
        if (trust === 'full') {
          return content; // Full trust
        } else if (trust === 'sanitized') {
          return DOMPurify.sanitize(content);
        }
        return undefined; // Default escaping
      }
    }
  });
}
```

## Security Checklist

Before deploying quikdown:

- [ ] **Never pass untrusted HTML** to fence plugins without sanitization
- [ ] **Use CSP headers** for defense-in-depth
- [ ] **Validate plugin output** if accepting third-party plugins
- [ ] **Escape plugin errors** - Don't display raw error messages
- [ ] **Update regularly** - Keep quikdown updated for security fixes
- [ ] **Audit fence plugins** - Review all custom plugin code
- [ ] **Test with malicious input** - Try XSS payloads in testing
- [ ] **Use HTTPS** - Prevent MITM attacks on delivered content
- [ ] **Sanitize URLs** (until built-in support is added)

## Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** open a public issue
2. Email security details to [security contact]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Static Analysis & ReDoS Prevention

quikdown enforces automated security scanning in its build pipeline:

- **ESLint + [eslint-plugin-security](https://www.npmjs.com/package/eslint-plugin-security)** runs on every build (`npm run build` starts with `npm run lint`)
- The `security/detect-unsafe-regex` and `security/detect-non-literal-regexp` rules are set to **error** level, meaning the build fails if a regex with catastrophic backtracking risk or a dynamic `new RegExp()` is introduced
- CI (GitHub Actions) runs the same pipeline, so security regressions block PRs

### ReDoS-safe patterns

All line-classification logic (HR detection, fence tracking, block categorization) uses **linear-scan functions** instead of regex where nested quantifiers would be needed. These shared utilities live in `src/quikdown_classify.js` and are consumed by both the main parser and the editor, ensuring a single source of truth with zero backtracking risk.

For example, CommonMark HR detection (`---`, `***`, `_ _ _`, etc.) uses an O(n) character scan rather than the traditional `/^[-_*](\s*[-_*]){2,}\s*$/` pattern, which is vulnerable to catastrophic backtracking on adversarial input like `"- " * 1000 + "x"`.

### Current scan status

| Check | Status |
|---|---|
| `security/detect-unsafe-regex` | 0 findings (error level) |
| `security/detect-non-literal-regexp` | 0 findings (error level) |
| `security/detect-object-injection` | disabled (false positives on parser array iteration) |
| All other `eslint-plugin-security` rules | 0 findings (warn level) |

## Future Security Enhancements

Planned security improvements:

1. **Configurable URL Allowlist** - Only allow specific URL schemes
2. **Plugin Sandboxing** - Optional plugin output validation
3. **Security Headers Helper** - Generate recommended CSP headers
4. **Built-in DOMPurify Integration** - Optional HTML sanitization

## Summary

quikdown's security model:

1. **Safe by default** - No XSS without explicit opt-in
2. **Explicit trust** - Trusted HTML requires fence plugins
3. **Granular control** - Trust specific blocks, not everything
4. **Developer responsibility** - Plugins must handle security
5. **Defense in depth** - Use with CSP and sanitization
6. **Automated enforcement** - Security lint at error level in CI

When in doubt, **don't trust the input**. The safest quikdown is one that never uses fence plugins with untrusted content.