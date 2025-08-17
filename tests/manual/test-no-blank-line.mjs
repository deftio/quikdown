import quikdown from '../../dist/quikdown.esm.js';

// Test case that mimics the exact structure in live-demo.html
const testCase = `\`\`\`javascript
// Some code
console.log("test");
\`\`\`
## Next Section
~~~python
def hello():
    print("Python with tildes")
~~~`;

console.log("=== Test without blank line between sections ===");
const result = quikdown(testCase);
console.log(result);
console.log("\n=== Does it contain 'language-python'? ===");
console.log(result.includes('language-python') ? "✓ YES" : "✗ NO");

// Now test with a blank line
const testCaseWithBlank = `\`\`\`javascript
// Some code
console.log("test");
\`\`\`

## Next Section

~~~python
def hello():
    print("Python with tildes")
~~~`;

console.log("\n=== Test WITH blank line between sections ===");
const resultWithBlank = quikdown(testCaseWithBlank);
console.log(resultWithBlank);
console.log("\n=== Does it contain 'language-python'? ===");
console.log(resultWithBlank.includes('language-python') ? "✓ YES" : "✗ NO");