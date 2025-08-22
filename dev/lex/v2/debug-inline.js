const text = 'para\n# heading';
console.log('Input to parseInline:', JSON.stringify(text));

// Simulate what parseInline does
let pos = 0;
let result = '';

// Skip to newline
while (pos < text.length && text[pos] !== '\n') {
  result += text[pos];
  pos++;
}

console.log('Before newline:', JSON.stringify(result), 'pos:', pos);

// At newline
if (pos < text.length && text[pos] === '\n') {
  const afterNewline = text.slice(pos + 1);
  console.log('After newline:', JSON.stringify(afterNewline));
  
  const match = afterNewline.match(/^(#{1,6}) (.*?)(?:\n|$)/);
  if (match) {
    console.log('Heading matched:', match[0]);
    // Should output: para\n<h1>heading</h1>
    // Currently outputting: para\n\n<h1>heading</h1>
  }
}
