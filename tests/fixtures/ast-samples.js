/**
 * Shared test fixtures for AST, JSON, YAML, and AST-HTML tests
 */

// Basic markdown samples with expected AST structures
export const samples = {
    // Simple heading
    heading: {
        markdown: '# Hello',
        ast: {
            type: 'document',
            children: [
                {
                    type: 'heading',
                    level: 1,
                    children: [{ type: 'text', value: 'Hello' }]
                }
            ]
        }
    },

    // Paragraph with text
    paragraph: {
        markdown: 'Hello world',
        ast: {
            type: 'document',
            children: [
                {
                    type: 'paragraph',
                    children: [{ type: 'text', value: 'Hello world' }]
                }
            ]
        }
    },

    // Bold text
    bold: {
        markdown: '**bold**',
        ast: {
            type: 'document',
            children: [
                {
                    type: 'paragraph',
                    children: [
                        {
                            type: 'strong',
                            children: [{ type: 'text', value: 'bold' }]
                        }
                    ]
                }
            ]
        }
    },

    // Italic text
    italic: {
        markdown: '*italic*',
        ast: {
            type: 'document',
            children: [
                {
                    type: 'paragraph',
                    children: [
                        {
                            type: 'em',
                            children: [{ type: 'text', value: 'italic' }]
                        }
                    ]
                }
            ]
        }
    },

    // Inline code
    inlineCode: {
        markdown: '`code`',
        ast: {
            type: 'document',
            children: [
                {
                    type: 'paragraph',
                    children: [{ type: 'code', value: 'code' }]
                }
            ]
        }
    },

    // Code block
    codeBlock: {
        markdown: '```js\nconst x = 1;\n```',
        ast: {
            type: 'document',
            children: [
                {
                    type: 'code_block',
                    lang: 'js',
                    content: 'const x = 1;',
                    fence: '```'
                }
            ]
        }
    },

    // Link
    link: {
        markdown: '[text](https://example.com)',
        ast: {
            type: 'document',
            children: [
                {
                    type: 'paragraph',
                    children: [
                        {
                            type: 'link',
                            url: 'https://example.com',
                            children: [{ type: 'text', value: 'text' }]
                        }
                    ]
                }
            ]
        }
    },

    // Image
    image: {
        markdown: '![alt text](image.png)',
        ast: {
            type: 'document',
            children: [
                {
                    type: 'paragraph',
                    children: [
                        {
                            type: 'image',
                            url: 'image.png',
                            alt: 'alt text'
                        }
                    ]
                }
            ]
        }
    },

    // Unordered list
    unorderedList: {
        markdown: '- item 1\n- item 2\n- item 3',
        ast: {
            type: 'document',
            children: [
                {
                    type: 'list',
                    ordered: false,
                    items: [
                        { type: 'list_item', checked: null, children: [{ type: 'text', value: 'item 1' }] },
                        { type: 'list_item', checked: null, children: [{ type: 'text', value: 'item 2' }] },
                        { type: 'list_item', checked: null, children: [{ type: 'text', value: 'item 3' }] }
                    ]
                }
            ]
        }
    },

    // Ordered list
    orderedList: {
        markdown: '1. first\n2. second\n3. third',
        ast: {
            type: 'document',
            children: [
                {
                    type: 'list',
                    ordered: true,
                    items: [
                        { type: 'list_item', checked: null, children: [{ type: 'text', value: 'first' }] },
                        { type: 'list_item', checked: null, children: [{ type: 'text', value: 'second' }] },
                        { type: 'list_item', checked: null, children: [{ type: 'text', value: 'third' }] }
                    ]
                }
            ]
        }
    },

    // Task list
    taskList: {
        markdown: '- [ ] unchecked\n- [x] checked',
        ast: {
            type: 'document',
            children: [
                {
                    type: 'list',
                    ordered: false,
                    items: [
                        { type: 'list_item', checked: false, children: [{ type: 'text', value: 'unchecked' }] },
                        { type: 'list_item', checked: true, children: [{ type: 'text', value: 'checked' }] }
                    ]
                }
            ]
        }
    },

    // Blockquote
    blockquote: {
        markdown: '> quoted text',
        ast: {
            type: 'document',
            children: [
                {
                    type: 'blockquote',
                    children: [
                        {
                            type: 'paragraph',
                            children: [{ type: 'text', value: 'quoted text' }]
                        }
                    ]
                }
            ]
        }
    },

    // Horizontal rule
    hr: {
        markdown: '---',
        ast: {
            type: 'document',
            children: [{ type: 'hr' }]
        }
    },

    // Table
    table: {
        markdown: '| A | B |\n|---|---|\n| 1 | 2 |',
        ast: {
            type: 'document',
            children: [
                {
                    type: 'table',
                    headers: [
                        [{ type: 'text', value: 'A' }],
                        [{ type: 'text', value: 'B' }]
                    ],
                    rows: [
                        [
                            [{ type: 'text', value: '1' }],
                            [{ type: 'text', value: '2' }]
                        ]
                    ],
                    alignments: ['left', 'left']
                }
            ]
        }
    },

    // Combined formatting
    combined: {
        markdown: '# Title\n\nParagraph with **bold** and *italic*.\n\n```js\ncode\n```',
        ast: {
            type: 'document',
            children: [
                {
                    type: 'heading',
                    level: 1,
                    children: [{ type: 'text', value: 'Title' }]
                },
                {
                    type: 'paragraph',
                    children: [
                        { type: 'text', value: 'Paragraph with ' },
                        { type: 'strong', children: [{ type: 'text', value: 'bold' }] },
                        { type: 'text', value: ' and ' },
                        { type: 'em', children: [{ type: 'text', value: 'italic' }] },
                        { type: 'text', value: '.' }
                    ]
                },
                {
                    type: 'code_block',
                    lang: 'js',
                    content: 'code',
                    fence: '```'
                }
            ]
        }
    }
};

// Forgiving parser test cases
export const forgivingSamples = {
    // URL with spaces (should be trimmed)
    linkWithSpaces: {
        markdown: '[text](  https://example.com  )',
        expectedUrl: 'https://example.com'
    },

    // Mismatched fences (should still parse)
    mismatchedFences: {
        markdown: '```js\ncode\n~~~',
        shouldParse: true
    },

    // Unclosed code fence
    unclosedFence: {
        markdown: '```js\ncode without closing fence',
        shouldParse: true
    },

    // Table without outer pipes
    tableNoOuterPipes: {
        markdown: 'A | B\n---|---\n1 | 2',
        shouldParse: true
    },

    // Various line endings
    crlfLineEndings: {
        markdown: '# Hello\r\n\r\nWorld',
        shouldParse: true
    },

    // CR only line endings
    crLineEndings: {
        markdown: '# Hello\r\rWorld',
        shouldParse: true
    },

    // List with varying indentation
    varyingIndentList: {
        markdown: '- item 1\n  - nested\n    - deep nested',
        shouldParse: true
    }
};

export default { samples, forgivingSamples };
