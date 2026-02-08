/**
 * quikdown_ast - Markdown to AST Parser
 * TypeScript definitions
 */

declare module 'quikdown/ast' {
  /**
   * AST Node Types
   */
  export type ASTNodeType =
    | 'document'
    | 'heading'
    | 'paragraph'
    | 'code_block'
    | 'blockquote'
    | 'list'
    | 'list_item'
    | 'table'
    | 'hr'
    | 'text'
    | 'strong'
    | 'em'
    | 'del'
    | 'code'
    | 'link'
    | 'image'
    | 'br';

  /**
   * Base AST Node
   */
  export interface ASTNode {
    type: ASTNodeType;
    children?: ASTNode[];
  }

  /**
   * Document root node
   */
  export interface DocumentNode extends ASTNode {
    type: 'document';
    children: ASTNode[];
  }

  /**
   * Heading node
   */
  export interface HeadingNode extends ASTNode {
    type: 'heading';
    level: 1 | 2 | 3 | 4 | 5 | 6;
    children: ASTNode[];
  }

  /**
   * Paragraph node
   */
  export interface ParagraphNode extends ASTNode {
    type: 'paragraph';
    children: ASTNode[];
  }

  /**
   * Code block node
   */
  export interface CodeBlockNode extends ASTNode {
    type: 'code_block';
    lang: string | null;
    content: string;
    fence: '```' | '~~~';
  }

  /**
   * Blockquote node
   */
  export interface BlockquoteNode extends ASTNode {
    type: 'blockquote';
    children: ASTNode[];
  }

  /**
   * List node
   */
  export interface ListNode extends ASTNode {
    type: 'list';
    ordered: boolean;
    items: ListItemNode[];
  }

  /**
   * List item node
   */
  export interface ListItemNode extends ASTNode {
    type: 'list_item';
    checked: boolean | null;
    children: ASTNode[];
  }

  /**
   * Table node
   */
  export interface TableNode extends ASTNode {
    type: 'table';
    headers: ASTNode[][];
    rows: ASTNode[][][];
    alignments: ('left' | 'center' | 'right')[];
  }

  /**
   * Horizontal rule node
   */
  export interface HRNode extends ASTNode {
    type: 'hr';
  }

  /**
   * Text node
   */
  export interface TextNode extends ASTNode {
    type: 'text';
    value: string;
  }

  /**
   * Strong (bold) node
   */
  export interface StrongNode extends ASTNode {
    type: 'strong';
    children: ASTNode[];
  }

  /**
   * Emphasis (italic) node
   */
  export interface EmNode extends ASTNode {
    type: 'em';
    children: ASTNode[];
  }

  /**
   * Strikethrough node
   */
  export interface DelNode extends ASTNode {
    type: 'del';
    children: ASTNode[];
  }

  /**
   * Inline code node
   */
  export interface CodeNode extends ASTNode {
    type: 'code';
    value: string;
  }

  /**
   * Link node
   */
  export interface LinkNode extends ASTNode {
    type: 'link';
    url: string;
    children: ASTNode[];
  }

  /**
   * Image node
   */
  export interface ImageNode extends ASTNode {
    type: 'image';
    url: string;
    alt: string;
  }

  /**
   * Line break node
   */
  export interface BRNode extends ASTNode {
    type: 'br';
  }

  /**
   * Options for the AST parser
   */
  export interface QuikdownASTOptions {
    // Reserved for future options
  }

  /**
   * Parse markdown to AST
   * @param markdown - The markdown source text
   * @param options - Optional configuration
   * @returns The AST document object
   */
  function quikdown_ast(markdown: string, options?: QuikdownASTOptions): DocumentNode;

  namespace quikdown_ast {
    /**
     * The version of quikdown_ast
     */
    export const version: string;
  }

  export = quikdown_ast;
}

// For ES6 module imports
export default quikdown_ast;
export {
  ASTNode,
  DocumentNode,
  HeadingNode,
  ParagraphNode,
  CodeBlockNode,
  BlockquoteNode,
  ListNode,
  ListItemNode,
  TableNode,
  HRNode,
  TextNode,
  StrongNode,
  EmNode,
  DelNode,
  CodeNode,
  LinkNode,
  ImageNode,
  BRNode,
  QuikdownASTOptions
};
