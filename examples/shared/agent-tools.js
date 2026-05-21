#!/usr/bin/env node
/**
 * Agent tool helpers shared by llm-tool-editor demo.
 * Implements the same tool surface documented in quikchat's tool-editor example,
 * operating on a QuikdownEditor instance.
 */
'use strict';

/**
 * @param {string} markdown
 * @returns {{ characters: number, words: number, lines: number, paragraphs: number }}
 */
function markdownStats(markdown) {
  const text = markdown.trim();
  return {
    characters: text.length,
    words: text.split(/\s+/).filter(Boolean).length,
    lines: markdown.split('\n').length,
    paragraphs: markdown.split(/\n\s*\n/).filter(function (p) { return p.trim(); }).length,
  };
}

/**
 * @param {string} markdown
 * @param {number} startLine 1-based inclusive
 * @param {number} endLine 1-based inclusive
 */
function extractLines(markdown, startLine, endLine) {
  return markdown.split('\n').slice(startLine - 1, endLine).join('\n');
}

/**
 * @param {import('../../dist/quikdown_edit.esm.js').default} editor
 * @param {string} name
 * @param {Record<string, unknown>} args
 * @returns {string}
 */
function executeEditorTool(editor, name, args) {
  switch (name) {
    case 'read_editor':
      return editor.getMarkdown();

    case 'write_editor':
      editor.setMarkdown(String(args.content || ''));
      return 'Document replaced.';

    case 'replace_text': {
      const find = String(args.find || '');
      const replace = String(args.replace || '');
      const md = editor.getMarkdown();
      const idx = md.indexOf(find);
      if (idx < 0) return 'No match found for find string.';
      editor.setMarkdown(md.slice(0, idx) + replace + md.slice(idx + find.length));
      return 'Replaced first occurrence.';
    }

    case 'extract_text':
      return extractLines(
        editor.getMarkdown(),
        Number(args.start_line) || 1,
        Number(args.end_line) || 1
      );

    case 'get_stats':
      return JSON.stringify(markdownStats(editor.getMarkdown()), null, 2);

    case 'undo':
      if (editor.canUndo()) {
        editor.undo();
        return editor.getMarkdown();
      }
      return 'Nothing to undo.';

    case 'redo':
      if (editor.canRedo()) {
        editor.redo();
        return editor.getMarkdown();
      }
      return 'Nothing to redo.';

    default:
      return 'Unknown tool: ' + name;
  }
}

/**
 * Simulated agent: maps natural-language commands to tool sequences.
 * Replace this with a real LLM + function-calling loop in production.
 *
 * @returns {{ reply: string, tools: Array<{ name: string, args: object, result: string }> }}
 */
function simulateAgentCommand(editor, userText) {
  const text = userText.trim().toLowerCase();
  const tools = [];

  function run(name, args) {
    const result = executeEditorTool(editor, name, args);
    tools.push({ name: name, args: args || {}, result: result });
    return result;
  }

  if (/summari/.test(text)) {
    run('read_editor', {});
    const md = editor.getMarkdown();
    const lines = md.split('\n').filter(function (l) { return l.trim() && !/^#/.test(l.trim()); });
    const bullets = lines.slice(0, 6).map(function (l) { return '- ' + l.replace(/^[-*]\s*/, '').trim(); }).join('\n');
    const summary = '# Summary\n\n' + (bullets || '_No body content to summarize._') + '\n\n---\n*Simulated agent rewrite — connect a real LLM for production.*';
    run('write_editor', { content: summary });
    return {
      reply: 'I read the document and replaced it with a short summary.',
      tools: tools,
    };
  }

  if (/translate|french|français/.test(text)) {
    run('read_editor', {});
    const md = editor.getMarkdown();
    run('write_editor', {
      content: '# Document (simulated French translation)\n\n> **Note:** This demo simulates translation. In production, pass the markdown to your LLM and call `write_editor` with the result.\n\n---\n\n' + md,
    });
    return { reply: 'Simulated translation via `write_editor`.', tools: tools };
  }

  if (/formal/.test(text)) {
    run('read_editor', {});
    const md = editor.getMarkdown();
    run('write_editor', {
      content: md.replace(/^# .+/m, '# Formal revision') + '\n\n---\n*Tone adjusted (simulated).*',
    });
    return { reply: 'Rewrote the document in a more formal tone.', tools: tools };
  }

  if (/faq/.test(text)) {
    run('read_editor', {});
    const md = editor.getMarkdown();
    run('write_editor', {
      content: md + '\n\n## FAQ\n\n**What is quikdown?** A lightweight markdown toolkit for LLM and agent UIs.\n\n**Can it run offline?** Yes — use the standalone editor bundle.\n',
    });
    return { reply: 'Appended a FAQ section at the end.', tools: tools };
  }

  if (/grammar|fix/.test(text)) {
    run('read_editor', {});
    const md = editor.getMarkdown();
    run('replace_text', { find: 'teh ', replace: 'the ' });
    if (tools.length === 1) {
      run('replace_text', { find: '  ', replace: ' ' });
    }
    if (tools.length === 1) {
      return { reply: 'No obvious fixes found — demo only replaces simple patterns.', tools: tools };
    }
    return { reply: 'Applied targeted `replace_text` corrections.', tools: tools };
  }

  if (/stats|how long|word count|length/.test(text)) {
    const stats = run('get_stats', {});
    return {
      reply: 'Document stats:\n\n```json\n' + stats + '\n```',
      tools: tools,
    };
  }

  var lineMatch = text.match(/lines?\s+(\d+)\s*[-–]\s*(\d+)/);
  if (lineMatch || /show me lines/.test(text)) {
    var start = lineMatch ? Number(lineMatch[1]) : 5;
    var end = lineMatch ? Number(lineMatch[2]) : 10;
    var excerpt = run('extract_text', { start_line: start, end_line: end });
    return {
      reply: 'Lines ' + start + '–' + end + ':\n\n```markdown\n' + excerpt + '\n```',
      tools: tools,
    };
  }

  if (/^undo/.test(text)) {
    const result = run('undo', {});
    return { reply: 'Undid the last edit.', tools: tools };
  }

  if (/^redo/.test(text)) {
    const result = run('redo', {});
    return { reply: 'Redid the last undone edit.', tools: tools };
  }

  return {
    reply: '**Simulated agent mode** — no API key required.\n\nTry:\n- "Summarize this"\n- "How long is this document?"\n- "Show me lines 5-10"\n- "Add a FAQ section"\n- "Undo that"\n\nFor a **live LLM** with the same tools, see the [quikchat tool editor demo](https://deftio.github.io/quikchat/examples/example_tool_editor.html).',
    tools: tools,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { markdownStats, extractLines, executeEditorTool, simulateAgentCommand };
}

if (typeof window !== 'undefined') {
  window.QdAgentTools = { markdownStats, extractLines, executeEditorTool, simulateAgentCommand };
}
