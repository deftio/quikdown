# Table Examples

## Basic Table

| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |

## Table with Alignment

| Left Aligned | Center Aligned | Right Aligned |
|:-------------|:--------------:|--------------:|
| Left         | Center         | Right         |
| 123          | 456            | 789           |
| abc          | def            | ghi           |

## Table Without Leading/Trailing Pipes (GFM Style)

Name | Age | City
-----|-----|-----
Alice | 30 | New York
Bob | 25 | Los Angeles
Carol | 35 | Chicago

## Table with Markdown Content

| Feature | Description | Example |
|---------|-------------|---------|
| **Bold** | Make text bold | **Important** |
| *Italic* | Emphasize text | *emphasis* |
| `Code` | Inline code | `var x = 1` |
| [Links](https://example.com) | Clickable links | [Click me](https://example.com) |
| ~~Strike~~ | Strikethrough | ~~deleted~~ |

## Complex Table

| Language | Typing | Paradigm | Year | Popular Frameworks |
|----------|--------|----------|------|-------------------|
| **JavaScript** | Dynamic | Multi-paradigm | 1995 | React, Vue, Angular |
| **Python** | Dynamic | Multi-paradigm | 1991 | Django, Flask |
| **TypeScript** | Static | OOP/Functional | 2012 | Same as JS |
| **Rust** | Static | Systems | 2010 | Actix, Rocket |

## CSV Support

Use a fence to create view csv content

```csv

 Language, Typing, Paradigm, Year, Popular, Frameworks 
 **JavaScript** , Dynamic , Multi-paradigm , 1995 , React Vue Angular  Svelte Bitwrench
 **Python**, Dynamic, Multi-paradigm, 1991, Django FastAPI Flask 
 **TypeScript** , Static , OOP/Functional , 2012, Same as JS 
 **Rust** , Static, Systems , 2010 , Actix  Rocket 

```