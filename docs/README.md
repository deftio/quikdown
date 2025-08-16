# quikdown Documentation

Complete documentation for the quikdown markdown parser.

## 📚 Documentation

- **[Architecture](architecture.md)** - Parser design, phases, and implementation details
- **[Security Guide](security.md)** - Security model, XSS prevention, and safe usage
- **[API Reference](api-reference.md)** - Complete API documentation with examples
- **[Plugin Development](plugin-guide.md)** - How to create custom fence plugins

## 🚀 Quick Links

- [GitHub Repository](https://github.com/deftio/quikdown)
- [NPM Package](https://www.npmjs.com/package/quikdown)
- [Live Examples](../examples/)

## 📖 Overview

quikdown is a lightweight, secure markdown parser designed for chat and LLM outputs. It prioritizes:

- **Security** - All HTML is escaped by default
- **Size** - ~3KB minified with zero dependencies
- **Extensibility** - Plugin system for custom rendering
- **Simplicity** - Easy to understand and audit

## 🎯 Use Cases

- Chat applications
- LLM output rendering
- Comment systems
- Documentation
- Email templates
- Static site generation

## 💡 Design Philosophy

1. **Secure by Default** - No XSS vulnerabilities without explicit opt-in
2. **Small & Fast** - Optimized for size and performance
3. **Practical** - Focuses on commonly used markdown features
4. **Extensible** - Plugin system for customization
5. **Zero Dependencies** - No supply chain risks

## 🔒 Security First

quikdown escapes all HTML by default. Trusted HTML can only be rendered through explicit fence plugins, making trust granular and intentional.

```javascript
// Safe for untrusted input
const html = quikdown(userInput);

// Trusted HTML requires explicit plugin
const html = quikdown(markdown, {
  fence_plugin: (content, lang) => {
    if (lang === 'trusted-html' && isAdmin()) {
      return content; // Only for trusted sources
    }
  }
});
```

## 📦 Installation

```bash
npm install quikdown
```

Or via CDN:

```html
<script src="https://unpkg.com/quikdown/dist/quikdown.umd.min.js"></script>
```

## 🌟 Features

### Supported Markdown

- **Headings** (`#` through `######`)
- **Bold** (`**text**` or `__text__`)
- **Italic** (`*text*` or `_text_`)
- **Strikethrough** (`~~text~~`)
- **Code** (`` `inline` `` and ` ```blocks``` `)
- **Links** (`[text](url)`)
- **Images** (`![alt](url)`)
- **Lists** (ordered and unordered with nesting)
- **Tables** (with alignment)
- **Blockquotes** (`> quote`)
- **Horizontal rules** (`---`)
- **Line breaks** (two spaces + newline)

### Not Supported (Intentionally)

- Raw HTML passthrough (security)
- Reference-style links (complexity)
- Footnotes (uncommon in chat)
- Definition lists (uncommon)

## 🔧 Configuration

### Options

- `inline_styles` - Use inline CSS instead of classes
- `fence_plugin` - Custom code block renderer

### Methods

- `quikdown(markdown, options)` - Parse markdown to HTML
- `quikdown.configure(options)` - Create configured parser
- `quikdown.emitStyles()` - Get CSS stylesheet
- `quikdown.version` - Version string

## 🤝 Contributing

See [Contributing Guide](../CONTRIBUTING.md)

## 📄 License

BSD-2-Clause - See [LICENSE](../LICENSE.txt)

## 🙏 Acknowledgments

- Inspired by the simplicity of early markdown parsers
- Designed for the modern web with security in mind
- Built for real-world chat and LLM use cases