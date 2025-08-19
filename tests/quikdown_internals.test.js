import quikdown from '../dist/quikdown.esm.js';

describe('Internal Functions Coverage', () => {
    
    describe('sanitizeUrl function - Line 90 coverage', () => {
        // We need to expose the internal sanitizeUrl function for testing
        // This is a bit hacky but necessary for 100% coverage
        
        test('should handle empty URL in sanitizeUrl', () => {
            // To trigger line 90, we need to pass an actual empty string to sanitizeUrl
            // This happens when the regex captures an empty group
            
            // Try with a single space - this will be captured by the regex
            const spaceUrl = '[text]( )';
            const result = quikdown(spaceUrl);
            // Single space gets passed to sanitizeUrl, trimmed, but doesn't trigger line 90
            expect(result).toContain('href=""');
            
            // The only way to trigger line 90 is if the regex somehow captures nothing
            // But the regex [^)]+ requires at least one character
            // So line 90 might be defensive programming that can't be reached
        });
        
        test('should return empty string for truly empty URLs', () => {
            // Test various empty URL scenarios
            const testCases = [
                '[link]()',      // Empty URL
                '[link](   )',   // Spaces only
                '[link](\t)',    // Tab only
                '[link](\n)',    // Newline (won't match regex)
                '![image]()',    // Empty image URL
                '![image](   )', // Spaces in image URL
            ];
            
            testCases.forEach(markdown => {
                const result = quikdown(markdown);
                // These should either not parse as links or have empty href/src
                expect(result).toBeDefined();
                
                // Check if it was parsed as a link/image
                if (result.includes('href=') || result.includes('src=')) {
                    // If parsed, should have empty URL
                    expect(result).toMatch(/(href|src)=""/);
                }
            });
        });
        
        test('should handle empty URL with allow_unsafe_urls option', () => {
            // Test empty URLs with allow_unsafe_urls enabled
            const markdown = '[link](   )';  // Spaces that trim to empty
            
            // With allow_unsafe_urls=false (default)
            const result1 = quikdown(markdown, { allow_unsafe_urls: false });
            expect(result1).toContain('href=""');
            
            // With allow_unsafe_urls=true
            const result2 = quikdown(markdown, { allow_unsafe_urls: true });
            expect(result2).toContain('href="   "'); // Spaces preserved
        });
    });
    
    describe('Line 63 - additionalStyle without base style', () => {
        test('should handle custom tags with only additionalStyle', () => {
            // This tests the branch where styles[tag] is undefined but additionalStyle exists
            // Tables with alignment use additionalStyle
            
            const alignedTable = `| Header |\n|:------:|\n| Center |`;
            const result = quikdown(alignedTable, { inline_styles: true });
            
            // Should have center alignment style
            expect(result).toContain('text-align:center');
            
            // Test all alignment types
            const allAlignments = `| Left | Center | Right |\n|:-----|:------:|------:|\n| L | C | R |`;
            const result2 = quikdown(allAlignments, { inline_styles: true });
            
            expect(result2).toContain('text-align:center');
            expect(result2).toContain('text-align:right');
            // Left alignment doesn't add style (it's default)
        });
    });
    
    describe('Helper function to extract and test sanitizeUrl', () => {
        test('should properly sanitize various URL types', () => {
            // Test that our URL sanitization works correctly
            const tests = [
                { input: '[link](http://example.com)', expected: 'href="http://example.com"' },
                { input: '[link](https://example.com)', expected: 'href="https://example.com"' },
                { input: '[link](javascript:alert(1))', expected: 'href="#"' },
                { input: '[link](vbscript:alert(1))', expected: 'href="#"' },
                { input: '[link](data:text/html,<script>)', expected: 'href="#"' },
                { input: '![img](data:image/png;base64,xyz)', expected: 'src="data:image/png;base64,xyz"' },
                { input: '[link](#anchor)', expected: 'href="#anchor"' },
                { input: '[link](/path/to/page)', expected: 'href="/path/to/page"' },
                { input: '[link](  https://example.com  )', expected: 'href="https://example.com"' }, // With spaces
            ];
            
            tests.forEach(({ input, expected }) => {
                const result = quikdown(input);
                expect(result).toContain(expected);
            });
        });
    });
});