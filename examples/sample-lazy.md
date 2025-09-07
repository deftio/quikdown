# Lazy Linefeeds Demo

## Single Newlines Create Line Breaks

With lazy linefeeds enabled:
This line
And this line
All appear on separate lines!

Without lazy linefeeds:
You need two spaces at the end  
To create a line break.

## Still Works with Paragraphs

Double newlines still create paragraphs.

Like this one!

## Code Blocks Preserved

```javascript
// Newlines in code blocks
// are preserved as-is
function test() {
    return true;
}
```

## Lists Work Normally

- Item 1
- Item 2
- Item 3

## Perfect for Chat/LLM Output

When users press Enter
They expect a new line
Not a continuous paragraph!

> **Tip:** Toggle the "Lazy Linefeeds" checkbox to see the difference!