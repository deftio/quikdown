import quikdown from '../../dist/quikdown.esm.js';

const test = `
## Test with ~~~

~~~python
def parse_markdown(text):
    """Parse markdown with quikdown"""
    return quikdown(text)
~~~

## Test with \`\`\`

\`\`\`python
def parse_markdown(text):
    """Parse markdown with quikdown"""
    return quikdown(text)
\`\`\`
`;

console.log("=== Testing fixed fence regex ===");
const result = quikdown(test);
console.log(result);

// Check if both Python blocks are recognized
const pythonBlocks = (result.match(/language-python/g) || []).length;
console.log(`\n✓ Found ${pythonBlocks} Python code blocks`);

// Check that ~~~ is NOT parsed as empty block in heading
if (!result.includes('<h2 class="quikdown-h2">Test with <pre')) {
    console.log('✓ Heading "Test with ~~~" renders correctly');
} else {
    console.log('✗ FAILED: Heading still has embedded <pre> tag');
}