/**
 * quikdown_edit_format — markdown text transforms behind QuikdownEditor.format()
 *
 * Everything here is a pure string function. A transform takes the markdown
 * source plus a selection (start/end character offsets) and returns the new
 * markdown plus the new selection. The editor uses the same functions for
 * the source pane and the rendered pane, so formatting behaves the same in
 * every browser engine and needs no document.execCommand.
 *
 * @license BSD-2-Clause
 */

/** Inline commands and the marker each one writes. */
const INLINE_MARKERS = { bold: '**', italic: '*', strike: '~~', code: '`' };

/** Every command name format() accepts. */
export const FORMAT_COMMANDS = [
    'bold', 'italic', 'strike', 'code', 'link',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'heading', 'paragraph',
    'ul', 'ol', 'task', 'quote', 'codeblock', 'hr', 'table',
    'indent', 'outdent'
];

// Block prefix of a line: indent, blockquote markers, then at most one of
// heading / task item / bullet / ordered marker.
// eslint-disable-next-line security/detect-unsafe-regex -- linear: every repetition of the quote group must start with ">", so there is one match path
const LINE_RE = /^([ \t]*)((?:>[ \t]?)*)(?:(#{1,6})(?:[ \t]+|$)|([-*+])[ \t]+(\[[ xX]\])(?:[ \t]+|$)|([-*+])(?:[ \t]+|$)|(\d+)\.(?:[ \t]+|$))?/;

const FENCE_RE = /^[ \t]*(`{3,}|~{3,})/;

/**
 * Split one line into its block prefix and its text.
 * @returns {{indent:string, quote:string, kind:(null|'h'|'ul'|'ol'|'task'), level:number, check:string, prefix:number, rest:string}}
 */
export function parseLine(line) {
    const m = LINE_RE.exec(line);
    let kind = null;
    if (m[3]) kind = 'h';
    else if (m[5]) kind = 'task';
    else if (m[6]) kind = 'ul';
    else if (m[7]) kind = 'ol';
    return {
        indent: m[1],
        quote: m[2],
        kind,
        level: m[3] ? m[3].length : 0,
        check: m[5] || '',
        prefix: m[0].length,
        rest: line.slice(m[0].length)
    };
}

/**
 * Offsets of the whole lines a selection touches. A selection that ends
 * just after a newline does not include the following line.
 */
function lineRange(md, start, end) {
    const ls = md.lastIndexOf('\n', start - 1) + 1;
    const anchor = end > start && md[end - 1] === '\n' ? end - 1 : end;
    let le = md.indexOf('\n', anchor);
    if (le === -1) le = md.length;
    return { ls, le };
}

/**
 * Inline spans (code, bold, italic, strike, link) in one line of text.
 * Offsets are relative to `text`; `m` is the marker length on each side.
 */
export function inlineSpans(text) {
    const spans = [];
    const blank = (s, from, to) => s.slice(0, from) + ' '.repeat(to - from) + s.slice(to);
    let masked = text;

    // Code spans win over everything else; hide their contents.
    text.replace(/`([^`\n]+)`/g, (match, inner, at) => {
        spans.push({ type: 'code', start: at, end: at + match.length, m: 1 });
        masked = blank(masked, at, at + match.length);
        return match;
    });

    // Links: keep the text visible to the emphasis passes, hide the target.
    // eslint-disable-next-line security/detect-unsafe-regex -- linear: every repetition of the inner group must start with "(", so there is one match path
    masked.replace(/\[([^\]\n]*)\]\(([^()\n]*(?:\([^()\n]*\)[^()\n]*)*)\)/g, (match, label, dest, at) => {
        spans.push({
            type: 'link', start: at, end: at + match.length, m: 1,
            textStart: at + 1, textEnd: at + 1 + label.length,
            destStart: at + label.length + 3, destEnd: at + match.length - 1
        });
        masked = blank(masked, at + 1 + label.length, at + match.length);
        return match;
    });

    // The closing marker is the end of its run, so "***x***" is bold around "*x*".
    const bold = (match, inner, at) => {
        spans.push({ type: 'bold', start: at, end: at + match.length, m: 2 });
        masked = blank(masked, at, at + 2);
        masked = blank(masked, at + match.length - 2, at + match.length);
        return match;
    };
    masked.replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*(?!\*)/g, bold);
    masked.replace(/__(?=\S)(.+?)(?<=\S)__(?!_)/g, bold);

    masked.replace(/~~(?=\S)(.+?)(?<=\S)~~/g, (match, inner, at) => {
        spans.push({ type: 'strike', start: at, end: at + match.length, m: 2 });
        return match;
    });

    const italic = (match, inner, at) => {
        spans.push({ type: 'italic', start: at, end: at + match.length, m: 1 });
        return match;
    };
    masked.replace(/(?<![*\\])\*(?![*\s])(.+?)(?<![*\s])\*(?!\*)/g, italic);
    masked.replace(/(?<![A-Za-z0-9_])_(?![_\s])(.+?)(?<![\s_])_(?![A-Za-z0-9_])/g, italic);

    return spans;
}

/** True for characters that belong to a word for caret expansion. */
function isWordChar(ch) {
    return ch !== undefined && !/[\s*_~`[\]()<>]/.test(ch);
}

/** Result helper. */
function result(markdown, start, end) {
    return { markdown, start, end };
}

/**
 * Toggle an inline marker (bold, italic, strike, code) over the selection.
 */
function toggleInline(md, start, end, type) {
    const mk = INLINE_MARKERS[type];
    let caretShift = null;

    if (start === end) {
        // Caret inside a word: act on the word and keep the caret in place.
        let a = start;
        let b = end;
        while (isWordChar(md[a - 1])) a--;
        while (isWordChar(md[b])) b++;
        if (a === b) {
            // Caret between an empty pair of this marker: remove the pair.
            let before = 0;
            let after = 0;
            const ch = mk[0];
            while (md[start - 1 - before] === ch) before++;
            while (md[start + after] === ch) after++;
            const run = Math.min(before, after);
            const paired = type === 'italic' ? run % 2 === 1
                : type === 'code' ? run >= 1
                    : run >= 2;
            if (paired) {
                return result(md.slice(0, start - mk.length) + md.slice(start + mk.length), start - mk.length, start - mk.length);
            }
            return result(md.slice(0, start) + mk + mk + md.slice(start), start + mk.length, start + mk.length);
        }
        caretShift = start - a;
        start = a;
        end = b;
    }

    // One segment per line, without the block prefix or outer whitespace.
    const segs = [];
    let pos = md.lastIndexOf('\n', start - 1) + 1;
    while (pos <= end) {
        let le = md.indexOf('\n', pos);
        if (le === -1) le = md.length;
        const line = md.slice(pos, le);
        let a = Math.max(start, pos + parseLine(line).prefix);
        let b = Math.min(end, le);
        while (a < b && /\s/.test(md[a])) a++;
        while (b > a && /\s/.test(md[b - 1])) b--;
        if (a < b && !FENCE_RE.test(line)) {
            const spans = inlineSpans(line)
                .filter(s => s.type === type)
                .map(s => ({ start: s.start + pos, end: s.end + pos, m: s.m }));
            segs.push({ a, b, spans, on: spans.find(s => s.start <= a && b <= s.end) || null });
        }
        pos = le + 1;
    }
    if (segs.length === 0) return result(md, start, end);

    const turnOff = segs.every(s => s.on);
    let out = '';
    let cursor = 0;
    let newStart = 0;
    let newEnd = 0;

    segs.forEach((seg, i) => {
        let r0;
        let r1;
        let rep;
        let selA;
        let selB;
        if (turnOff) {
            const sp = seg.on;
            const open = md.slice(sp.start, sp.start + sp.m);
            const innerStart = sp.start + sp.m;
            const innerEnd = sp.end - sp.m;
            // "Whole span" ignores other markers and spaces hugging the edges.
            let cs = innerStart;
            let ce = innerEnd;
            while (cs < ce && /[*_~`\s]/.test(md[cs])) cs++;
            while (ce > cs && /[*_~`\s]/.test(md[ce - 1])) ce--;
            r0 = sp.start;
            r1 = sp.end;
            if (seg.a <= cs && seg.b >= ce) {
                rep = md.slice(innerStart, innerEnd);
                selA = Math.max(seg.a, innerStart) - innerStart;
                selB = Math.min(seg.b, innerEnd) - innerStart;
            } else {
                // Selection is part of the span: split the span around it.
                const a = Math.max(seg.a, innerStart);
                const b = Math.min(seg.b, innerEnd);
                const left = md.slice(innerStart, a);
                const right = md.slice(b, innerEnd);
                const L = left.replace(/\s+$/, '');
                const R = right.replace(/^\s+/, '');
                const head = (L ? open + L + open : '') + left.slice(L.length);
                const tail = right.slice(0, right.length - R.length) + (R ? open + R + open : '');
                rep = head + md.slice(a, b) + tail;
                selA = head.length;
                selB = head.length + (b - a);
            }
        } else {
            // Merge any spans of this type the selection overlaps, then wrap.
            const hit = seg.spans.filter(s => s.start < seg.b && s.end > seg.a);
            r0 = Math.min(seg.a, ...hit.map(s => s.start));
            r1 = Math.max(seg.b, ...hit.map(s => s.end));
            let text = '';
            let at = r0;
            hit.forEach(s => {
                text += md.slice(at, s.start) + md.slice(s.start + s.m, s.end - s.m);
                at = s.end;
            });
            text += md.slice(at, r1);
            rep = mk + text + mk;
            selA = mk.length;
            selB = mk.length + text.length;
        }
        out += md.slice(cursor, r0);
        if (i === 0) newStart = out.length + selA;
        if (i === segs.length - 1) newEnd = out.length + selB;
        out += rep;
        cursor = r1;
    });
    out += md.slice(cursor);

    if (caretShift !== null) {
        const caret = Math.min(newStart + caretShift, newEnd);
        return result(out, caret, caret);
    }
    return result(out, newStart, newEnd);
}

/**
 * Insert, retarget, or remove a link.
 * `url` string: link the selection (or retarget the link under it).
 * `url` null / '' / false: remove the link under the selection.
 * `url` undefined: link the selection with a placeholder target, selected.
 */
function toggleLink(md, start, end, url) {
    const { ls } = lineRange(md, start, start);
    let le = md.indexOf('\n', start);
    if (le === -1) le = md.length;
    end = Math.min(end, le);
    const link = inlineSpans(md.slice(ls, le))
        .filter(s => s.type === 'link')
        .map(s => ({ start: s.start + ls, end: s.end + ls, textStart: s.textStart + ls, textEnd: s.textEnd + ls }))
        .find(s => s.start <= start && end <= s.end);
    const remove = url === null || url === '' || url === false;

    if (link) {
        const text = md.slice(link.textStart, link.textEnd);
        if (remove) {
            return result(md.slice(0, link.start) + text + md.slice(link.end), link.start, link.start + text.length);
        }
        if (url === undefined) return result(md, link.textStart, link.textEnd);
        const rep = `[${text}](${url})`;
        return result(md.slice(0, link.start) + rep + md.slice(link.end), link.start + 1, link.start + 1 + text.length);
    }
    if (remove) return result(md, start, end);

    if (start === end) {
        while (isWordChar(md[start - 1])) start--;
        while (isWordChar(md[end])) end++;
    }
    while (start < end && /\s/.test(md[start])) start++;
    while (end > start && /\s/.test(md[end - 1])) end--;
    const target = url === undefined ? 'url' : String(url);
    const text = md.slice(start, end) || (url === undefined ? 'link' : target);
    const rep = `[${text}](${target})`;
    const out = md.slice(0, start) + rep + md.slice(end);
    if (url === undefined) {
        const at = start + text.length + 3;
        return result(out, at, at + target.length);
    }
    return result(out, start + 1, start + 1 + text.length);
}

/**
 * Rewrite the whole lines under the selection with `fn(lines) → lines`.
 * A caret keeps its distance from the end of its line; a range selection
 * becomes the rewritten lines.
 */
function rewriteLines(md, start, end, fn) {
    const { ls, le } = lineRange(md, start, end);
    const oldLines = md.slice(ls, le).split('\n');
    const newLines = fn(oldLines);
    const block = newLines.join('\n');
    const out = md.slice(0, ls) + block + md.slice(le);
    if (start !== end) return result(out, ls, ls + block.length);
    const fromEnd = le - start;
    const caret = Math.max(ls + parseLine(newLines[0]).prefix, ls + block.length - fromEnd);
    return result(out, caret, caret);
}

/** Lines a block command acts on: the non-blank ones, or a lone blank line. */
function targets(lines) {
    const idx = [];
    lines.forEach((l, i) => { if (l.trim() !== '') idx.push(i); });
    return idx.length ? idx : [0];
}

function setHeading(md, start, end, level) {
    return rewriteLines(md, start, end, lines => {
        const t = targets(lines);
        const parsed = lines.map(parseLine);
        const same = level > 0 && t.every(i => parsed[i].kind === 'h' && parsed[i].level === level);
        const mark = level > 0 && !same ? '#'.repeat(level) + ' ' : '';
        return lines.map((l, i) => {
            if (!t.includes(i)) return l;
            const p = parsed[i];
            if (level === 0) return p.rest;
            return p.indent + p.quote + mark + p.rest;
        });
    });
}

function setList(md, start, end, kind) {
    return rewriteLines(md, start, end, lines => {
        const t = targets(lines);
        const parsed = lines.map(parseLine);
        const same = t.every(i => parsed[i].kind === kind);
        let n = 0;
        return lines.map((l, i) => {
            if (!t.includes(i)) return l;
            const p = parsed[i];
            let mark = '';
            if (!same) {
                if (kind === 'ol') mark = `${++n}. `;
                else if (kind === 'task') mark = `- ${p.check || '[ ]'} `;
                else mark = '- ';
            }
            return p.indent + p.quote + mark + p.rest;
        });
    });
}

function toggleQuote(md, start, end) {
    return rewriteLines(md, start, end, lines => {
        const t = targets(lines);
        const quoted = t.every(i => parseLine(lines[i]).quote !== '');
        if (quoted) return lines.map(l => l.replace(/^([ \t]*)>[ \t]?/, '$1'));
        return lines.map(l => (l.trim() === '' ? '>' : '> ' + l));
    });
}

function shiftIndent(md, start, end, dir) {
    return rewriteLines(md, start, end, lines => lines.map(l => {
        if (l.trim() === '') return l;
        return dir > 0 ? '  ' + l : l.replace(/^(?: {1,2}|\t)/, '');
    }));
}

function toggleCodeBlock(md, start, end, lang) {
    const { ls, le } = lineRange(md, start, end);
    const lines = md.slice(ls, le).split('\n');
    const isFence = l => FENCE_RE.test(l);
    // A fence line opens a block when an even number of fence lines precede it.
    const opens = at => md.slice(0, at).split('\n').filter(isFence).length % 2 === 0;

    // Selection includes its own fence lines: drop them.
    if (lines.length >= 2 && isFence(lines[0]) && isFence(lines[lines.length - 1]) && opens(ls)) {
        const inner = lines.slice(1, -1).join('\n');
        return result(md.slice(0, ls) + inner + md.slice(le), ls, ls + inner.length);
    }
    // Selection sits between two fence lines: drop those.
    const prevStart = ls > 0 ? md.lastIndexOf('\n', ls - 2) + 1 : -1;
    const nextEnd = le < md.length ? (md.indexOf('\n', le + 1) === -1 ? md.length : md.indexOf('\n', le + 1)) : -1;
    if (prevStart >= 0 && nextEnd >= 0 && isFence(md.slice(prevStart, ls - 1)) && isFence(md.slice(le + 1, nextEnd)) && opens(prevStart)) {
        const inner = md.slice(ls, le);
        const tail = md.slice(nextEnd);
        const out = md.slice(0, prevStart) + inner + tail;
        return result(out, start - (ls - prevStart), end - (ls - prevStart));
    }
    const open = '```' + (lang ? String(lang) : '') + '\n';
    const inner = md.slice(ls, le);
    const out = md.slice(0, ls) + open + inner + '\n```' + md.slice(le);
    return result(out, start + open.length, end + open.length);
}

/**
 * Insert a block on its own lines after the current line, padded with one
 * blank line on each side where there is neighbouring content.
 */
function insertBlock(md, start, end, block, selFrom, selTo) {
    const { ls, le } = lineRange(md, start, end);
    const blankLine = md.slice(ls, le).trim() === '';
    const at = blankLine ? ls : le;
    const before = md.slice(0, at);
    const after = md.slice(blankLine ? le : at);
    const lead = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
    // `after` is empty or starts at a line break
    const trail = after === '' ? '\n' : after.startsWith('\n\n') ? '' : '\n';
    const base = before.length + lead.length;
    const out = before + lead + block + trail + after;
    if (selFrom === undefined) {
        const caret = base + block.length + trail.length;
        return result(out, caret, caret);
    }
    return result(out, base + selFrom, base + selTo);
}

function insertTable(md, start, end, value) {
    const cols = Math.max(1, Math.min(20, parseInt(value && value.cols, 10) || 2));
    const rows = Math.max(1, Math.min(100, parseInt(value && value.rows, 10) || 2));
    const names = [];
    for (let c = 1; c <= cols; c++) names.push(`Column ${c}`);
    const lines = [
        '| ' + names.join(' | ') + ' |',
        '| ' + names.map(() => '---').join(' | ') + ' |'
    ];
    for (let r = 0; r < rows; r++) lines.push('| ' + names.map(() => ' ').join(' | ') + ' |');
    return insertBlock(md, start, end, lines.join('\n'), 2, 2 + names[0].length);
}

/**
 * Apply a formatting command to markdown.
 *
 * @param {string} markdown
 * @param {number} start  selection start offset
 * @param {number} end    selection end offset
 * @param {string} command one of FORMAT_COMMANDS
 * @param {*} [value]     link target, heading level, code language, or table size
 * @returns {{markdown:string, start:number, end:number}|null} null for an unknown command
 */
export function formatMarkdown(markdown, start, end, command, value) {
    const md = typeof markdown === 'string' ? markdown : '';
    let s = Math.max(0, Math.min(md.length, Number(start) || 0));
    let e = Math.max(0, Math.min(md.length, Number(end) || 0));
    if (s > e) [s, e] = [e, s];

    switch (command) {
        case 'bold':
        case 'italic':
        case 'strike':
        case 'code':
            return toggleInline(md, s, e, command);
        case 'link':
            return toggleLink(md, s, e, value);
        case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
            return setHeading(md, s, e, parseInt(command[1], 10));
        case 'heading':
            return setHeading(md, s, e, Math.max(0, Math.min(6, parseInt(value, 10) || 0)));
        case 'paragraph':
            return setHeading(md, s, e, 0);
        case 'ul':
        case 'ol':
        case 'task':
            return setList(md, s, e, command);
        case 'quote':
            return toggleQuote(md, s, e);
        case 'indent':
            return shiftIndent(md, s, e, 1);
        case 'outdent':
            return shiftIndent(md, s, e, -1);
        case 'codeblock':
            return toggleCodeBlock(md, s, e, value);
        case 'hr':
            return insertBlock(md, s, e, '---');
        case 'table':
            return insertTable(md, s, e, value);
        default:
            return null;
    }
}

/**
 * Describe the formatting at a selection, for toolbar pressed states.
 *
 * @returns {{bold:boolean, italic:boolean, strike:boolean, code:boolean, link:boolean,
 *            heading:number, list:(null|'ul'|'ol'|'task'), quote:boolean, codeblock:boolean}}
 */
export function getFormatState(markdown, start, end) {
    const md = typeof markdown === 'string' ? markdown : '';
    let s = Math.max(0, Math.min(md.length, Number(start) || 0));
    let e = Math.max(0, Math.min(md.length, Number(end) || 0));
    if (s > e) [s, e] = [e, s];

    const ls = md.lastIndexOf('\n', s - 1) + 1;
    let le = md.indexOf('\n', s);
    if (le === -1) le = md.length;
    const line = md.slice(ls, le);
    const p = parseLine(line);

    // Inside a fenced block when an odd number of fence lines precede this one.
    let fences = 0;
    md.slice(0, ls).split('\n').forEach(l => { if (FENCE_RE.test(l)) fences++; });
    const codeblock = fences % 2 === 1 && !FENCE_RE.test(line);

    const state = {
        bold: false, italic: false, strike: false, code: false, link: false,
        heading: codeblock ? 0 : p.level,
        list: codeblock || p.kind === 'h' ? null : p.kind,
        quote: !codeblock && p.quote !== '',
        codeblock
    };
    if (codeblock) return state;

    const a = s - ls;
    const b = Math.min(e, le) - ls;
    inlineSpans(line).forEach(sp => {
        const inside = a === b
            ? sp.start + sp.m <= a && a <= sp.end - sp.m
            : sp.start <= a && b <= sp.end;
        if (inside) state[sp.type] = true;
    });
    return state;
}

/**
 * Translate a character offset in `from` to the matching offset in `to`.
 * The two texts are expected to be near-identical (the same document before
 * and after a round trip through the rendered pane). Text outside the
 * changed region maps exactly; inside it, lines are aligned by a longest
 * common subsequence and the column is kept.
 */
export function mapOffset(from, to, offset) {
    offset = Math.max(0, Math.min(from.length, offset));
    if (from === to) return offset;

    const max = Math.min(from.length, to.length);
    let p = 0;
    while (p < max && from.charCodeAt(p) === to.charCodeAt(p)) p++;
    // Before the first difference, or `to` only adds text after all of `from`
    if (offset < p || p === from.length) return offset;
    let x = 0;
    while (x < max - p && from.charCodeAt(from.length - 1 - x) === to.charCodeAt(to.length - 1 - x)) x++;
    if (x > 0 && offset >= from.length - x) return to.length - (from.length - offset);

    // Widen the changed region to whole lines.
    const top = from.lastIndexOf('\n', p - 1) + 1;
    let fromEnd = from.indexOf('\n', from.length - x);
    if (fromEnd === -1) fromEnd = from.length;
    const toEnd = to.length - (from.length - fromEnd);
    const A = from.slice(top, fromEnd).split('\n');
    const B = to.slice(top, Math.max(top, toEnd)).split('\n');

    // Line of the offset within A, and its column.
    let row = 0;
    let rowStart = top;
    while (row < A.length - 1 && rowStart + A[row].length < offset) {
        rowStart += A[row].length + 1;
        row++;
    }
    const col = offset - rowStart;

    const startOfB = j => {
        let at = top;
        for (let k = 0; k < j; k++) at += B[k].length + 1;
        return at;
    };

    if (A.length * B.length > 250000) {
        // Too large to align: keep the relative position.
        const ratio = (offset - top) / Math.max(1, fromEnd - top);
        return Math.min(to.length, top + Math.round(ratio * Math.max(0, toEnd - top)));
    }

    // Longest common subsequence over lines.
    const n = A.length;
    const m = B.length;
    const dp = [];
    for (let i = 0; i <= n; i++) dp.push(new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
    }
    const match = new Array(n).fill(-1);
    for (let i = 0, j = 0; i < n && j < m;) {
        if (A[i] === B[j]) { match[i] = j; i++; j++; }
        else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
        else j++;
    }

    let target = match[row];
    if (target === -1) {
        // Unmatched line: pair it with the line at the same position in the
        // gap between the neighbouring matches, if there is one.
        let prev = row - 1;
        while (prev >= 0 && match[prev] === -1) prev--;
        let next = row + 1;
        while (next < n && match[next] === -1) next++;
        const gapStart = prev >= 0 ? match[prev] + 1 : 0;
        const gapEnd = next < n ? match[next] : m;
        const guess = gapStart + (row - prev - 1);
        if (guess < gapEnd) target = guess;
        else return Math.min(to.length, startOfB(gapEnd < m ? gapEnd : m - 1) + (gapEnd < m ? 0 : B[m - 1].length));
    }
    return Math.min(to.length, startOfB(target) + Math.min(col, B[target].length));
}

/**
 * Move an offset that sits inside a line's block prefix ("## ", "- ", "> ")
 * to the first character after it. Used before placing a caret marker so the
 * marker cannot break block syntax.
 */
export function skipBlockPrefix(md, offset) {
    const ls = md.lastIndexOf('\n', offset - 1) + 1;
    let le = md.indexOf('\n', offset);
    if (le === -1) le = md.length;
    const prefix = parseLine(md.slice(ls, le)).prefix;
    return offset < ls + prefix ? ls + prefix : offset;
}
