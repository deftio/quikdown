import quikdown from '../../dist/quikdown.esm.js';

const CODE = `def parse_markdown(text):
    """Parse markdown with quikdown"""
    return quikdown(text)`;

const testWithBackticks = `\`\`\`python
${CODE}
\`\`\``;

const testWithTildes = `~~~python
${CODE}
~~~`;

console.log("=== Testing identical content ===");

const htmlBackticks = quikdown(testWithBackticks);
const htmlTildes = quikdown(testWithTildes);

console.log("Backticks output:");
console.log(htmlBackticks);

console.log("\nTildes output:");
console.log(htmlTildes);

console.log("\n=== Are they identical? ===");
console.log(htmlBackticks === htmlTildes ? "✓ YES - Outputs are identical!" : "✗ NO - Outputs differ!");

// Test mixed fences in one document
const mixedTest = `
## Code with Backticks

\`\`\`python
def hello():
    print("Using backticks")
\`\`\`

## Code with Tildes

~~~python
def goodbye():
    print("Using tildes")
~~~

## Another with Backticks

\`\`\`javascript
console.log("JavaScript with backticks");
\`\`\`

## Another with Tildes

~~~javascript
console.log("JavaScript with tildes");
~~~
`;

console.log("\n=== Mixed fence test ===");
const mixedHtml = quikdown(mixedTest);
console.log(mixedHtml);