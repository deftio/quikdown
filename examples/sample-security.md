# Security Features Demo

## XSS Protection

quikdown automatically escapes HTML tags to prevent XSS attacks:

### Script Tags (Escaped)
<script>alert('This script will not execute!');</script>

### HTML Injection (Escaped)
<div onclick="alert('XSS')">This div is escaped</div>
<img src="#" onerror="alert('XSS')">

### Safe URL Handling

JavaScript URLs are sanitized:
[Click me](javascript:alert('XSS'))

Data URLs are blocked (except images):
[Download](data:text/html,<script>alert('XSS')</script>)

But image data URLs work:
![Safe Image](data:image/png;base64,iVBORw0KGgo)

## Safe Markdown Rendering

All these potentially dangerous inputs are handled safely:

1. **HTML entities**: <script> tags are escaped
2. **Event handlers**: onclick, onerror, etc. are removed
3. **Dangerous protocols**: javascript:, vbscript: are blocked

## Trusted Content via Plugins

If you need to render trusted HTML, use the fence plugin system:

```html-safe
<!-- This would need a custom plugin to render as HTML -->
<div class="custom-widget">
    <p>Trusted content only!</p>
</div>
```

## Testing XSS Vectors

Common XSS attack vectors that are safely handled:

- <iframe src="javascript:alert('XSS')">
- <object data="javascript:alert('XSS')">
- <embed src="javascript:alert('XSS')">
- <img src=# onerror=alert('XSS')>
- <input onfocus=alert('XSS') autofocus>
- <select onfocus=alert('XSS') autofocus>
- <textarea onfocus=alert('XSS') autofocus>
- <button onclick=alert('XSS')>Click</button>

All the above are rendered as escaped text, not executable HTML.

## Summary

✅ **All HTML is escaped by default**
✅ **JavaScript URLs are sanitized**
✅ **Event handlers are removed**
✅ **Safe for untrusted user input**

> Remember: Security by default, opt-in for trusted content!