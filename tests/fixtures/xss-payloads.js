/**
 * XSS Payload Corpus for quikdown security testing.
 *
 * Each payload targets a specific injection vector in markdown rendering.
 * The test runner verifies that NONE of these produce executable HTML.
 *
 * Categories:
 *   - script: Direct <script> injection
 *   - event:  on* event handler injection
 *   - url:    javascript:/vbscript: protocol injection
 *   - attr:   Attribute breakout / injection
 *   - entity: HTML entity / encoding bypass
 *   - nested: Multi-layer / recursive payloads
 *   - fence:  Code fence info-string injection
 *   - table:  Table cell injection
 */

// Strings that must NEVER appear in sanitized output
export const DANGEROUS_PATTERNS = [
    /<script[\s>]/i,
    /onerror\s*=/i,
    /onload\s*=/i,
    /onclick\s*=/i,
    /onmouseover\s*=/i,
    /onfocus\s*=/i,
    /onblur\s*=/i,
    /onmouseenter\s*=/i,
    /javascript\s*:/i,
    /vbscript\s*:/i,
    /data\s*:\s*text\/html/i,
    /<iframe[\s>]/i,
    /<object[\s>]/i,
    /<embed[\s>]/i,
    /<form[\s>]/i,
    /<svg[\s>](?!.*&lt;)/i,  // allow escaped <svg
    /<math[\s>](?!.*&lt;)/i,
];

export const payloads = {
    // ── Direct script injection ──
    script: [
        { name: 'basic script tag',
          input: '<script>alert(1)</script>' },
        { name: 'script with src',
          input: '<script src="evil.js"></script>' },
        { name: 'script uppercase',
          input: '<SCRIPT>alert(1)</SCRIPT>' },
        { name: 'script mixed case',
          input: '<ScRiPt>alert(1)</ScRiPt>' },
        { name: 'script with space before >',
          input: '<script >alert(1)</script>' },
        { name: 'script with newline',
          input: '<script\n>alert(1)</script>' },
        { name: 'script in heading',
          input: '# <script>alert(1)</script>' },
        { name: 'script in bold',
          input: '**<script>alert(1)</script>**' },
        { name: 'script in list item',
          input: '- <script>alert(1)</script>' },
    ],

    // ── Event handler injection ──
    event: [
        { name: 'img onerror',
          input: '<img src=x onerror=alert(1)>' },
        { name: 'img onerror in markdown image',
          input: '![x" onerror="alert(1)](img.jpg)' },
        { name: 'body onload',
          input: '<body onload=alert(1)>' },
        { name: 'div onmouseover',
          input: '<div onmouseover="alert(1)">hover</div>' },
        { name: 'input onfocus autofocus',
          input: '<input onfocus=alert(1) autofocus>' },
        { name: 'svg onload',
          input: '<svg onload=alert(1)>' },
        { name: 'details ontoggle',
          input: '<details ontoggle=alert(1) open><summary>x</summary></details>' },
        { name: 'marquee onstart',
          input: '<marquee onstart=alert(1)>' },
    ],

    // ── URL protocol injection ──
    url: [
        { name: 'javascript link',
          input: '[click](javascript:alert(1))' },
        { name: 'javascript link uppercase',
          input: '[click](JAVASCRIPT:alert(1))' },
        { name: 'javascript link with spaces',
          input: '[click](java\tscript:alert(1))' },
        { name: 'javascript link with entities',
          input: '[click](&#106;avascript:alert(1))' },
        { name: 'vbscript link',
          input: '[click](vbscript:alert(1))' },
        { name: 'data text/html link',
          input: '[click](data:text/html,<script>alert(1)</script>)' },
        { name: 'javascript in image src',
          input: '![x](javascript:alert(1))' },
        { name: 'javascript with encoded colon',
          input: '[click](javascript&#58;alert(1))' },
    ],

    // ── Attribute breakout ──
    attr: [
        { name: 'break out of href with quote',
          input: '[x](x" onclick="alert(1))' },
        { name: 'break out of src with quote',
          input: '![x](x" onerror="alert(1))' },
        { name: 'break out of alt with quote',
          input: '![x" onerror="alert(1)](img.jpg)' },
        { name: 'break out of title',
          input: '[x](url "title" onclick="alert(1)")' },
    ],

    // ── Entity / encoding bypass ──
    entity: [
        { name: 'script via HTML entities',
          input: '&#60;script&#62;alert(1)&#60;/script&#62;' },
        { name: 'script via hex entities',
          input: '&#x3C;script&#x3E;alert(1)&#x3C;/script&#x3E;' },
        { name: 'null bytes',
          input: '<scr\x00ipt>alert(1)</script>' },
        { name: 'unicode escapes in script',
          input: '<script>\\u0061lert(1)</script>' },
    ],

    // ── Nested / recursive payloads ──
    nested: [
        { name: 'script inside link text',
          input: '[<script>alert(1)</script>](url)' },
        { name: 'event handler in table cell',
          input: '| <img src=x onerror=alert(1)> |\n|---|\n| cell |' },
        { name: 'script in blockquote',
          input: '> <script>alert(1)</script>' },
        { name: 'script in code block (should be safe)',
          input: '```\n<script>alert(1)</script>\n```' },
        { name: 'double-encoded script',
          input: '&lt;script&gt;alert(1)&lt;/script&gt;' },
        { name: 'nested markdown + HTML',
          input: '**[<img src=x onerror=alert(1)>](url)**' },
    ],

    // ── Fence info-string injection ──
    fence: [
        { name: 'fence lang with quotes',
          input: '```javascript" onmouseover="alert(1)\ncode\n```' },
        { name: 'fence lang with angle brackets',
          input: '```<script>alert(1)</script>\ncode\n```' },
        { name: 'fence lang with event handler',
          input: '```lang onclick=alert(1)\ncode\n```' },
    ],

    // ── Table injection ──
    table: [
        { name: 'script in table header',
          input: '| <script>alert(1)</script> |\n|---|\n| cell |' },
        { name: 'script in table cell',
          input: '| header |\n|---|\n| <script>alert(1)</script> |' },
        { name: 'event handler in table header',
          input: '| <img src=x onerror=alert(1)> |\n|---|\n| cell |' },
    ],
};

// Flat list of all payloads for easy iteration
export const allPayloads = Object.entries(payloads).flatMap(
    ([category, items]) => items.map(item => ({ ...item, category }))
);
