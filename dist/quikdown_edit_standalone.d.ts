/**
 * QuikdownEditor, standalone build: the same editor with every fence
 * renderer bundled, and `allowExternalFetch` defaulting to false.
 */
import QuikdownEditor from './quikdown_edit.js';

export type {
    EditorOptions, EditorMode, EditorPane, HtmlMode, EditorSelection, FormatState,
    FormatCommand, FormatResult, ChangeSource, ChangeMeta, EditorHistory, EditorScroll,
    SetMarkdownOptions
} from './quikdown_edit.js';

export default QuikdownEditor;
