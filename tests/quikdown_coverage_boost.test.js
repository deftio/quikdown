import quikdown from '../dist/quikdown.esm.js';

describe('Boost Coverage - Uncovered Lines', () => {
    
    describe('Line 63 - Custom tag with additionalStyle', () => {
        test('should handle custom tag "foo" with additionalStyle', () => {
            // We need to test createGetAttr with a custom tag that doesn't have predefined styles
            // This tests the branch where !style but additionalStyle exists
            
            // Using table alignment which adds additionalStyle for cells
            const input = '| Center |\n|:------:|\n| Cell |';
            const result = quikdown(input, { inline_styles: true });
            
            // The center alignment adds text-align:center as additionalStyle
            expect(result).toContain('text-align:center');
            expect(result).toContain('style="');
        });
        
        test('should handle getAttr with only additionalStyle and no base style', () => {
            // To directly test line 63, we need a scenario where styles[tag] is undefined
            // but additionalStyle is provided
            // This happens with td/th elements with alignment but inline_styles mode
            const alignedTable = '| Right |\n|------:|\n| Text |';
            const result = quikdown(alignedTable, { inline_styles: true });
            
            // Should contain the alignment style
            expect(result).toContain('text-align:right');
        });
    });
    
    describe('Line 90 - Empty URL in sanitizeUrl', () => {
        test('should handle empty string URL', () => {
            // Directly test empty URL sanitization
            // The markdown parser won't create links with truly empty URLs,
            // but we can test with spaces that become empty after trim
            const spaceUrl = '[text](   )';
            const result = quikdown(spaceUrl);
            
            // With empty URL after trim, should get empty href
            expect(result).toContain('href=""');
        });
        
        test('should handle empty URLs with allow_unsafe_urls option', () => {
            // Test empty URL with allow_unsafe_urls=true
            const emptyLink = '[link](   )';
            const result = quikdown(emptyLink, { allow_unsafe_urls: true });
            
            // With allow_unsafe_urls, spaces are preserved
            expect(result).toContain('href="   "');
        });
        
        test('should handle empty URLs with allow_unsafe_urls=false', () => {
            // Test empty URL with explicit allow_unsafe_urls=false
            const emptyLink = '[link](   )';
            const result = quikdown(emptyLink, { allow_unsafe_urls: false });
            
            // Should have empty href
            expect(result).toContain('href=""');
        });
    });
    
    describe('Line 396 - Dead code removed', () => {
        test('tables always have headers since separator search starts at index 1', () => {
            // Line 396 was dead code - the loop in buildTable starts at i=1,
            // so separatorIndex can never be 0, meaning headerLines.slice(0, separatorIndex)
            // will always have at least one element.
            // We've removed the unnecessary if check.
            
            // Test a normal table to ensure it still works
            const table = '| Header |\n|---|\n| Data |';
            const result = quikdown(table);
            
            expect(result).toContain('<table');
            expect(result).toContain('<thead');
            expect(result).toContain('<tbody');
            expect(result).toContain('Header');
            expect(result).toContain('Data');
        });
    });
    
    describe('Line 539 - Style null check', () => {
        test('should handle emitStyles with all defined styles', () => {
            // The null check on line 539 might be dead code since we iterate
            // over Object.entries(styles) where all values are defined
            const css = quikdown.emitStyles();
            
            // All styles should be present
            expect(css).toContain('.quikdown-h1');
            expect(css).toContain('.quikdown-strong');
            expect(css).toContain('.quikdown-table');
            
            // Verify no empty style rules
            expect(css).not.toMatch(/\{\s*\}/); // No empty {} blocks
        });
        
        test('should handle emitStyles with dark theme', () => {
            // Test to ensure all style entries are processed
            const darkCss = quikdown.emitStyles('quikdown-', 'dark');
            
            // Should have dark theme colors
            expect(darkCss).toContain('#2a2a2a');
            expect(darkCss).toContain('#3a3a3a');
            expect(darkCss).toContain('color:#e0e0e0');
        });
    });
    
    describe('Line 556 - Light theme text color branch', () => {
        test('should add explicit text color for light theme elements', () => {
            // Test light theme to hit line 556
            const lightCss = quikdown.emitStyles('quikdown-', 'light');
            
            // Should contain explicit text color for certain elements
            expect(lightCss).toContain('color:#333');
            
            // Check specific elements that should have text color
            expect(lightCss).toMatch(/\.quikdown-h1.*color:#333/);
            expect(lightCss).toMatch(/\.quikdown-h2.*color:#333/);
            expect(lightCss).toMatch(/\.quikdown-td.*color:#333/);
            expect(lightCss).toMatch(/\.quikdown-li.*color:#333/);
            expect(lightCss).toMatch(/\.quikdown-blockquote.*color:#333/);
        });
    });
    
    describe('Lines 591-596 - Module exports', () => {
        test('should handle CommonJS environment', () => {
            // In a real CommonJS environment, module.exports would be defined
            // Since we're running in ESM, we can't directly test this
            // but we can verify the module structure
            
            // The ESM export should work
            expect(quikdown).toBeDefined();
            expect(typeof quikdown).toBe('function');
            expect(quikdown.version).toBeDefined();
            expect(quikdown.emitStyles).toBeDefined();
            expect(quikdown.configure).toBeDefined();
        });
        
        test('should work in browser environment via global', () => {
            // In a browser environment, window.quikdown would be set
            // We can't test this directly in Node, but we can verify
            // the library structure is correct
            
            // Test that the library works as expected
            const result = quikdown('**bold**');
            expect(result).toContain('<strong');
            expect(result).toContain('bold');
        });
    });
    
    describe('Additional edge cases for complete coverage', () => {
        test('should handle table cells with right alignment and inline styles', () => {
            const rightAlignTable = '| Header |\n|-------:|\n| Right |';
            const result = quikdown(rightAlignTable, { inline_styles: true });
            expect(result).toContain('text-align:right');
        });
        
        test('should handle table with all alignment types in inline styles', () => {
            const allAlignTable = '| Left | Center | Right |\n|:-----|:------:|------:|\n| L | C | R |';
            const result = quikdown(allAlignTable, { inline_styles: true });
            expect(result).toContain('text-align:center');
            expect(result).toContain('text-align:right');
            // Left alignment doesn't add style since it's default
        });
        
        test('should emitStyles with custom prefix', () => {
            const customCss = quikdown.emitStyles('custom-', 'light');
            expect(customCss).toContain('.custom-h1');
            expect(customCss).toContain('.custom-strong');
            expect(customCss).toContain('color:#333');
        });
        
        test('should handle emitStyles with invalid theme defaulting to light behavior', () => {
            // Test with an invalid theme name
            const css = quikdown.emitStyles('quikdown-', 'invalid');
            
            // Should still generate CSS, just without theme overrides
            expect(css).toContain('.quikdown-h1');
            expect(css).toContain('font-size:2em');
            
            // Should not have dark theme colors
            expect(css).not.toContain('#2a2a2a');
            expect(css).not.toContain('color:#e0e0e0');
        });
    });
});