import quikdown from '../../dist/quikdown.esm.js';

const testWithBackticks = `\`\`\`python
def hello():
    print("Hello from backticks")
\`\`\``;

const testWithTildes = `~~~python
def hello():
    print("Hello from tildes")
~~~`;

console.log("=== Input Markdown ===");
console.log("Backticks:", JSON.stringify(testWithBackticks));
console.log("Tildes:", JSON.stringify(testWithTildes));

const htmlBackticks = quikdown(testWithBackticks);
const htmlTildes = quikdown(testWithTildes);

console.log("\n=== HTML Output ===");
console.log("Backticks HTML:", htmlBackticks);
console.log("Tildes HTML:", htmlTildes);

console.log("\n=== Character comparison ===");
for (let i = 0; i < Math.max(htmlBackticks.length, htmlTildes.length); i++) {
    if (htmlBackticks[i] !== htmlTildes[i]) {
        console.log(`Difference at position ${i}:`);
        console.log(`  Backticks[${i}]: '${htmlBackticks[i]}' (code: ${htmlBackticks.charCodeAt(i)})`);
        console.log(`  Tildes[${i}]: '${htmlTildes[i]}' (code: ${htmlTildes.charCodeAt(i)})`);
        break;
    }
}

// Test with fence plugin
console.log("\n=== With fence plugin ===");
const fencePlugin = (code, lang) => {
    console.log(`Plugin called with lang='${lang}', code length=${code.length}`);
    return `<pre class="custom"><code class="lang-${lang}">${code}</code></pre>`;
};

const htmlBackticksPlugin = quikdown(testWithBackticks, { fence_plugin: fencePlugin });
console.log("Backticks with plugin:", htmlBackticksPlugin);

const htmlTildesPlugin = quikdown(testWithTildes, { fence_plugin: fencePlugin });
console.log("Tildes with plugin:", htmlTildesPlugin);