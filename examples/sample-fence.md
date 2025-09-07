# Code Blocks and Fence Plugins

## Standard Code Blocks

### JavaScript with Syntax Highlighting

```javascript
// Function to calculate factorial
function factorial(n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

console.log(factorial(5)); // Output: 120
```

### Python with ~~~ Fences

~~~python
# Fibonacci sequence generator
def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        yield a
        a, b = b, a + b

# Generate first 10 numbers
for num in fibonacci(10):
    print(num, end=' ')
~~~

### HTML Example

```html
<!DOCTYPE html>
<html>
<head>
    <title>quikdown Demo</title>
</head>
<body>
    <h1>Hello World</h1>
</body>
</html>
```

## Mermaid Diagrams

### Flowchart

```mermaid
flowchart TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> E[Fix issues]
    E --> B
    C --> F[Deploy]
    F --> G[End]
```

### Sequence Diagram

```mermaid
sequenceDiagram
    participant U as User
    participant C as Client
    participant S as Server
    participant D as Database
    
    U->>C: Click button
    C->>S: HTTP Request
    S->>D: Query data
    D-->>S: Return results
    S-->>C: JSON Response
    C-->>U: Update UI
```

### Git Graph

```mermaid
gitGraph
    commit
    commit
    branch develop
    checkout develop
    commit
    commit
    checkout main
    merge develop
    commit
    branch feature
    checkout feature
    commit
    commit
    checkout main
    merge feature
```

## CSS Example

```css
/* quikdown styles */
.quikdown-pre {
    background: #f4f4f4;
    padding: 10px;
    border-radius: 4px;
    overflow-x: auto;
}

.quikdown-code {
    background: #f0f0f0;
    padding: 2px 4px;
    border-radius: 3px;
}
```