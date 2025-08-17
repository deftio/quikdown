import quikdown from '../../dist/quikdown.esm.js';

const testWithBackticks = `
\`\`\`python
def hello():
    print("Hello from backticks")
\`\`\`
`;

const testWithTildes = `
~~~python
def hello():
    print("Hello from tildes")
~~~
`;

console.log("=== Test with ``` backticks ===");
const htmlBackticks = quikdown(testWithBackticks);
console.log(htmlBackticks);

console.log("\n=== Test with ~~~ tildes ===");
const htmlTildes = quikdown(testWithTildes);
console.log(htmlTildes);

console.log("\n=== Are they identical? ===");
console.log(htmlBackticks === htmlTildes ? "YES - Identical" : "NO - Different!");

if (htmlBackticks !== htmlTildes) {
    console.log("\nBackticks result:", JSON.stringify(htmlBackticks));
    console.log("Tildes result:", JSON.stringify(htmlTildes));
}