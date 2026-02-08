/**
 * Comprehensive Markdown Test Suite
 *
 * Tests quikdown parser against a wide variety of markdown inputs
 * with expected outputs. Covers edge cases, tables, line breaks,
 * and various markdown scenarios.
 */

import quikdown from '../dist/quikdown.esm.js';
import { fixtures, runFixture, getAllFixtures } from './fixtures/markdown-samples.js';

// ============================================
// HEADINGS
// ============================================
describe('Headings', () => {
    fixtures.headings.forEach(fixture => {
        const testFn = fixture.skip ? test.skip : test;
        testFn(fixture.name, () => {
            const { passed, errors, result } = runFixture(quikdown, fixture);
            if (!passed) {
                console.log(`\n  Input: ${JSON.stringify(fixture.markdown)}`);
                console.log(`  Output: ${result}`);
                if (fixture.notes) console.log(`  Notes: ${fixture.notes}`);
            }
            expect(passed).toBe(true);
            if (errors.length > 0) {
                throw new Error(errors.join('\n'));
            }
        });
    });
});

// ============================================
// TABLES
// ============================================
describe('Tables', () => {
    fixtures.tables.forEach(fixture => {
        const testFn = fixture.skip ? test.skip : test;
        testFn(fixture.name, () => {
            const { passed, errors, result } = runFixture(quikdown, fixture);
            if (!passed) {
                console.log(`\n  Input: ${JSON.stringify(fixture.markdown)}`);
                console.log(`  Output: ${result}`);
                if (fixture.notes) console.log(`  Notes: ${fixture.notes}`);
            }
            expect(passed).toBe(true);
            if (errors.length > 0) {
                throw new Error(errors.join('\n'));
            }
        });
    });
});

// ============================================
// LINE BREAKS
// ============================================
describe('Line Breaks', () => {
    fixtures.lineBreaks.forEach(fixture => {
        const testFn = fixture.skip ? test.skip : test;
        testFn(fixture.name, () => {
            const { passed, errors, result } = runFixture(quikdown, fixture);
            if (!passed) {
                console.log(`\n  Input: ${JSON.stringify(fixture.markdown)}`);
                console.log(`  Output: ${result}`);
                if (fixture.notes) console.log(`  Notes: ${fixture.notes}`);
            }
            expect(passed).toBe(true);
            if (errors.length > 0) {
                throw new Error(errors.join('\n'));
            }
        });
    });
});

// ============================================
// CODE BLOCKS
// ============================================
describe('Code Blocks', () => {
    fixtures.codeBlocks.forEach(fixture => {
        const testFn = fixture.skip ? test.skip : test;
        testFn(fixture.name, () => {
            const { passed, errors, result } = runFixture(quikdown, fixture);
            if (!passed) {
                console.log(`\n  Input: ${JSON.stringify(fixture.markdown)}`);
                console.log(`  Output: ${result}`);
                if (fixture.notes) console.log(`  Notes: ${fixture.notes}`);
            }
            expect(passed).toBe(true);
            if (errors.length > 0) {
                throw new Error(errors.join('\n'));
            }
        });
    });
});

// ============================================
// LISTS
// ============================================
describe('Lists', () => {
    fixtures.lists.forEach(fixture => {
        const testFn = fixture.skip ? test.skip : test;
        testFn(fixture.name, () => {
            const { passed, errors, result } = runFixture(quikdown, fixture);
            if (!passed) {
                console.log(`\n  Input: ${JSON.stringify(fixture.markdown)}`);
                console.log(`  Output: ${result}`);
                if (fixture.notes) console.log(`  Notes: ${fixture.notes}`);
            }
            expect(passed).toBe(true);
            if (errors.length > 0) {
                throw new Error(errors.join('\n'));
            }
        });
    });
});

// ============================================
// INLINE FORMATTING
// ============================================
describe('Inline Formatting', () => {
    fixtures.inlineFormatting.forEach(fixture => {
        const testFn = fixture.skip ? test.skip : test;
        testFn(fixture.name, () => {
            const { passed, errors, result } = runFixture(quikdown, fixture);
            if (!passed) {
                console.log(`\n  Input: ${JSON.stringify(fixture.markdown)}`);
                console.log(`  Output: ${result}`);
                if (fixture.notes) console.log(`  Notes: ${fixture.notes}`);
            }
            expect(passed).toBe(true);
            if (errors.length > 0) {
                throw new Error(errors.join('\n'));
            }
        });
    });
});

// ============================================
// LINKS AND IMAGES
// ============================================
describe('Links and Images', () => {
    fixtures.linksAndImages.forEach(fixture => {
        const testFn = fixture.skip ? test.skip : test;
        testFn(fixture.name, () => {
            const { passed, errors, result } = runFixture(quikdown, fixture);
            if (!passed) {
                console.log(`\n  Input: ${JSON.stringify(fixture.markdown)}`);
                console.log(`  Output: ${result}`);
                if (fixture.notes) console.log(`  Notes: ${fixture.notes}`);
            }
            expect(passed).toBe(true);
            if (errors.length > 0) {
                throw new Error(errors.join('\n'));
            }
        });
    });
});

// ============================================
// BLOCKQUOTES
// ============================================
describe('Blockquotes', () => {
    fixtures.blockquotes.forEach(fixture => {
        const testFn = fixture.skip ? test.skip : test;
        testFn(fixture.name, () => {
            const { passed, errors, result } = runFixture(quikdown, fixture);
            if (!passed) {
                console.log(`\n  Input: ${JSON.stringify(fixture.markdown)}`);
                console.log(`  Output: ${result}`);
                if (fixture.notes) console.log(`  Notes: ${fixture.notes}`);
            }
            expect(passed).toBe(true);
            if (errors.length > 0) {
                throw new Error(errors.join('\n'));
            }
        });
    });
});

// ============================================
// HORIZONTAL RULES
// ============================================
describe('Horizontal Rules', () => {
    fixtures.horizontalRules.forEach(fixture => {
        const testFn = fixture.skip ? test.skip : test;
        testFn(fixture.name, () => {
            const { passed, errors, result } = runFixture(quikdown, fixture);
            if (!passed) {
                console.log(`\n  Input: ${JSON.stringify(fixture.markdown)}`);
                console.log(`  Output: ${result}`);
                if (fixture.notes) console.log(`  Notes: ${fixture.notes}`);
            }
            expect(passed).toBe(true);
            if (errors.length > 0) {
                throw new Error(errors.join('\n'));
            }
        });
    });
});

// ============================================
// COMPLEX COMBINATIONS
// ============================================
describe('Complex Combinations', () => {
    fixtures.complexCombinations.forEach(fixture => {
        const testFn = fixture.skip ? test.skip : test;
        testFn(fixture.name, () => {
            const { passed, errors, result } = runFixture(quikdown, fixture);
            if (!passed) {
                console.log(`\n  Input: ${JSON.stringify(fixture.markdown)}`);
                console.log(`  Output: ${result}`);
                if (fixture.notes) console.log(`  Notes: ${fixture.notes}`);
            }
            expect(passed).toBe(true);
            if (errors.length > 0) {
                throw new Error(errors.join('\n'));
            }
        });
    });
});

// ============================================
// EDGE CASES
// ============================================
describe('Edge Cases', () => {
    fixtures.edgeCases.forEach(fixture => {
        const testFn = fixture.skip ? test.skip : test;
        testFn(fixture.name, () => {
            const { passed, errors, result } = runFixture(quikdown, fixture);
            if (!passed) {
                console.log(`\n  Input: ${JSON.stringify(fixture.markdown)}`);
                console.log(`  Output: ${result}`);
                if (fixture.notes) console.log(`  Notes: ${fixture.notes}`);
            }
            expect(passed).toBe(true);
            if (errors.length > 0) {
                throw new Error(errors.join('\n'));
            }
        });
    });
});

// ============================================
// STRICTNESS AND FORGIVENESS
// ============================================
describe('Strictness and Forgiveness', () => {
    fixtures.strictness.forEach(fixture => {
        const testFn = fixture.skip ? test.skip : test;
        testFn(fixture.name, () => {
            const { passed, errors, result } = runFixture(quikdown, fixture);
            if (!passed) {
                console.log(`\n  Input: ${JSON.stringify(fixture.markdown)}`);
                console.log(`  Output: ${result}`);
                if (fixture.notes) console.log(`  Notes: ${fixture.notes}`);
            }
            expect(passed).toBe(true);
            if (errors.length > 0) {
                throw new Error(errors.join('\n'));
            }
        });
    });
});

// ============================================
// BIDIRECTIONAL MODE
// ============================================
describe('Bidirectional Mode', () => {
    fixtures.bidirectional.forEach(fixture => {
        const testFn = fixture.skip ? test.skip : test;
        testFn(fixture.name, () => {
            const { passed, errors, result } = runFixture(quikdown, fixture);
            if (!passed) {
                console.log(`\n  Input: ${JSON.stringify(fixture.markdown)}`);
                console.log(`  Output: ${result}`);
                if (fixture.notes) console.log(`  Notes: ${fixture.notes}`);
            }
            expect(passed).toBe(true);
            if (errors.length > 0) {
                throw new Error(errors.join('\n'));
            }
        });
    });
});

// ============================================
// INLINE STYLES MODE
// ============================================
describe('Inline Styles Mode', () => {
    fixtures.inlineStyles.forEach(fixture => {
        const testFn = fixture.skip ? test.skip : test;
        testFn(fixture.name, () => {
            const { passed, errors, result } = runFixture(quikdown, fixture);
            if (!passed) {
                console.log(`\n  Input: ${JSON.stringify(fixture.markdown)}`);
                console.log(`  Output: ${result}`);
                if (fixture.notes) console.log(`  Notes: ${fixture.notes}`);
            }
            expect(passed).toBe(true);
            if (errors.length > 0) {
                throw new Error(errors.join('\n'));
            }
        });
    });
});

// ============================================
// SUMMARY AND STATISTICS
// ============================================
describe('Test Suite Statistics', () => {
    test('should report total fixture count', () => {
        const allFixtures = getAllFixtures();
        console.log(`\n  Total fixtures: ${allFixtures.length}`);

        // Count by category
        const categories = {};
        for (const fixture of allFixtures) {
            categories[fixture.category] = (categories[fixture.category] || 0) + 1;
        }

        console.log('  Fixtures by category:');
        for (const [cat, count] of Object.entries(categories)) {
            console.log(`    - ${cat}: ${count}`);
        }

        expect(allFixtures.length).toBeGreaterThan(100);
    });
});

// ============================================
// SPECIFIC EDGE CASE DEEP DIVES
// ============================================
describe('Deep Dive: Table Edge Cases', () => {
    test('table with varying column counts per row', () => {
        const input = '| A | B | C |\n|---|---|---|\n| 1 | 2 |\n| 3 | 4 | 5 | 6 |';
        const result = quikdown(input);
        expect(result).toContain('<table');
        // Should handle gracefully, not crash
    });

    test('table with only separator characters', () => {
        const input = '| --- | --- |\n|---|---|\n| --- | --- |';
        const result = quikdown(input);
        // Should parse or handle gracefully
    });

    test('table-like content that isnt a table', () => {
        const input = 'The ratio is 1|2 or 3|4';
        const result = quikdown(input);
        expect(result).not.toContain('<table');
        expect(result).toContain('1|2');
    });

    test('table with markdown in every cell', () => {
        const input = '| **Bold** | *Italic* | `Code` | ~~Strike~~ |\n|----------|----------|--------|------------|\n| [Link](u) | ![Img](i) | **B** | *I* |';
        const result = quikdown(input);
        expect(result).toContain('<table');
        expect(result).toContain('<strong');
        expect(result).toContain('<em');
        expect(result).toContain('<code');
    });
});

describe('Deep Dive: Line Break Strictness', () => {
    test('exactly 2 spaces followed by newline', () => {
        const input = 'Line 1  \nLine 2';
        const result = quikdown(input);
        expect(result).toContain('<br');
    });

    test('1 space followed by newline - no break', () => {
        const input = 'Line 1 \nLine 2';
        const result = quikdown(input);
        expect(result).not.toContain('<br');
    });

    test('3 spaces followed by newline', () => {
        const input = 'Line 1   \nLine 2';
        const result = quikdown(input);
        // Current behavior: /  $/ matches 2 spaces at end, third space remains
        // This might or might not create a <br> depending on implementation
    });

    test('tab followed by newline - no break', () => {
        const input = 'Line 1\t\nLine 2';
        const result = quikdown(input);
        expect(result).not.toContain('<br');
    });

    test('trailing spaces at end of paragraph', () => {
        const input = 'Paragraph text  ';
        const result = quikdown(input);
        // Trailing spaces at EOF shouldn't cause issues
        expect(result).toContain('Paragraph text');
    });

    test('lazy_linefeeds converts single newlines', () => {
        const input = 'Line 1\nLine 2\nLine 3';
        const result = quikdown(input, { lazy_linefeeds: true });
        expect(result).toContain('<br');
    });

    test('lazy_linefeeds preserves paragraph breaks', () => {
        const input = 'Para 1\n\nPara 2';
        const result = quikdown(input, { lazy_linefeeds: true });
        expect(result).toContain('<p>');
        // Should have two paragraphs
    });
});

describe('Deep Dive: Inline Formatting Edge Cases', () => {
    test('asterisks inside words', () => {
        const input = 'This*is*tricky';
        const result = quikdown(input);
        // Behavior varies - some parsers format, some don't
    });

    test('underscores inside words', () => {
        const input = 'snake_case_variable';
        const result = quikdown(input);
        // Should ideally NOT format, as it's a variable name
    });

    test('multiple asterisks in sequence', () => {
        const input = '*** not bold or italic ***';
        const result = quikdown(input);
        // Triple asterisks behavior
    });

    test('escaped formatting characters', () => {
        const input = '\\*not italic\\*';
        const result = quikdown(input);
        // Backslash escapes
    });

    test('formatting across multiple words', () => {
        const input = '**this is all bold text here**';
        const result = quikdown(input);
        expect(result).toContain('<strong');
        expect(result).toContain('this is all bold text here');
    });

    test('adjacent formatting', () => {
        const input = '**bold***italic*';
        const result = quikdown(input);
        expect(result).toContain('<strong');
    });

    test('empty formatting markers', () => {
        const input = '** ** and * *';
        const result = quikdown(input);
        // Empty content between markers
    });
});

describe('Deep Dive: Code Block Edge Cases', () => {
    test('fence with very long language string', () => {
        const input = '```' + 'a'.repeat(100) + '\ncode\n```';
        const result = quikdown(input);
        expect(result).toContain('<pre');
        expect(result).toContain('<code');
    });

    test('fence with special chars in language', () => {
        const input = '```c++\ncode\n```';
        const result = quikdown(input);
        expect(result).toContain('language-c++');
    });

    test('fence with spaces in language', () => {
        const input = '```bash script\ncode\n```';
        const result = quikdown(input);
        // First word is typically the language
    });

    test('nested fence markers in code', () => {
        const input = '```\nHere is some ```code``` inside\n```';
        const result = quikdown(input);
        // Should preserve the inner backticks
    });

    test('tilde and backtick fences mixed', () => {
        const input = '```\ncode1\n```\n\n~~~\ncode2\n~~~';
        const result = quikdown(input);
        expect(result).toContain('code1');
        expect(result).toContain('code2');
    });

    test('inline code with multiple backticks', () => {
        const input = 'Use ``code with `backtick` inside``';
        const result = quikdown(input);
        // Double backtick delimiters
    });
});

describe('Deep Dive: List Edge Cases', () => {
    test('list items with multiple paragraphs', () => {
        const input = '- Item 1\n\n  Continued\n\n- Item 2';
        const result = quikdown(input);
        // Multi-paragraph list items
    });

    test('list with blank lines between items', () => {
        const input = '- Item 1\n\n- Item 2\n\n- Item 3';
        const result = quikdown(input);
        // Loose list vs tight list
    });

    test('mixed ordered and unordered at same level', () => {
        const input = '- Unordered\n1. Ordered\n- Back to unordered';
        const result = quikdown(input);
        // Switching list types
    });

    test('deeply nested lists (5 levels)', () => {
        const input = '- L1\n  - L2\n    - L3\n      - L4\n        - L5';
        const result = quikdown(input);
        expect(result).toContain('L1');
        expect(result).toContain('L5');
    });

    test('list with only checkbox', () => {
        const input = '- [ ]';
        const result = quikdown(input);
        // Checkbox with no text
    });

    test('ordered list with wrong numbers', () => {
        const input = '1. First\n1. Second\n1. Third';
        const result = quikdown(input);
        expect(result).toContain('<ol');
        // Numbers in markdown don't have to be sequential
    });
});

describe('Deep Dive: Security', () => {
    test('script injection via various vectors', () => {
        const vectors = [
            '<script>alert(1)</script>',
            '<img src=x onerror=alert(1)>',
            '<svg onload=alert(1)>',
            '<body onload=alert(1)>',
            '<iframe src="javascript:alert(1)">',
            '<a href="javascript:alert(1)">click</a>',
            '<div style="background:url(javascript:alert(1))">',
        ];

        for (const vector of vectors) {
            const result = quikdown(vector);
            // Verify HTML is escaped - the key is that < and > become &lt; and &gt;
            // so the browser won't execute any of these as actual HTML tags
            expect(result).not.toContain('<script');
            expect(result).not.toContain('<img ');
            expect(result).not.toContain('<svg');
            expect(result).not.toContain('<body');
            expect(result).not.toContain('<iframe');
            expect(result).toContain('&lt;'); // Escaped angle brackets
        }
    });

    test('markdown-based injection attempts', () => {
        const attempts = [
            '[click](javascript:alert(1))',
            '![img](javascript:alert(1))',
            '[click](data:text/html,<script>alert(1)</script>)',
        ];

        for (const attempt of attempts) {
            const result = quikdown(attempt);
            expect(result).not.toContain('javascript:');
            expect(result).not.toContain('data:text');
        }
    });

    test('unicode-based obfuscation', () => {
        // JavaScript with unicode escapes
        const input = '[click](\\u006aavascript:alert(1))';
        const result = quikdown(input);
        // Should be safe
    });
});

describe('Deep Dive: Whitespace Handling', () => {
    test('leading spaces on each line', () => {
        const input = '  Line 1\n  Line 2\n  Line 3';
        const result = quikdown(input);
        // How are leading spaces preserved?
    });

    test('trailing spaces preserved in code', () => {
        const input = '```\ncode   \nmore   \n```';
        const result = quikdown(input);
        // Trailing spaces in code blocks
    });

    test('multiple spaces between words', () => {
        const input = 'Word1    Word2';
        const result = quikdown(input);
        // Multiple spaces typically collapse in HTML
    });

    test('non-breaking spaces', () => {
        const input = 'Word1\u00a0\u00a0Word2';
        const result = quikdown(input);
        // NBSP handling
    });

    test('zero-width characters', () => {
        const input = 'Word\u200bWord';
        const result = quikdown(input);
        // Zero-width space
    });
});

describe('Deep Dive: Unicode and i18n', () => {
    test('RTL text', () => {
        const input = '# مرحبا بالعالم\n\nهذا نص عربي';
        const result = quikdown(input);
        expect(result).toContain('<h1');
        expect(result).toContain('مرحبا');
    });

    test('CJK text', () => {
        const input = '# 你好世界\n\n这是中文文本\n\n- 列表项1\n- 列表项2';
        const result = quikdown(input);
        expect(result).toContain('<h1');
        expect(result).toContain('<ul');
    });

    test('emoji in various contexts', () => {
        const input = '# 🎉 Title\n\n**Bold 🔥** and *italic 💡*\n\n- 📌 Item\n- ✅ Done';
        const result = quikdown(input);
        expect(result).toContain('🎉');
        expect(result).toContain('🔥');
    });

    test('combining characters', () => {
        const input = 'café résumé naïve';
        const result = quikdown(input);
        expect(result).toContain('café');
    });

    test('mixed scripts', () => {
        const input = 'English 中文 العربية 日本語';
        const result = quikdown(input);
        expect(result).toContain('English');
        expect(result).toContain('中文');
    });
});
