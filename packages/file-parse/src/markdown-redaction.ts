import { placeholderSource } from '@genoffice/agent-core/redact-core'
import { RedactionMarkError } from './redaction-error'

/**
 * Withheld spans in a markdown file, read as another file's material.
 *
 * The markdown editor persists a withheld span as
 * `<span class="redact-span" data-redaction="" data-label="…">words</span>`
 * (apps/markdown `editor/Redaction.ts`), and its own model view writes the span
 * out as `{{label}}`. The patterns below are the ones its parser patch uses to
 * find the span again (`editor/inlineTokens.ts`); this package cannot import an
 * app, so they are restated here and the tests feed both the same examples.
 *
 * The editor matches on parsed inline tokens and this works on the raw text, so
 * the two differ in one direction only: a span spelled inside a code block is
 * withheld here and shown there. Withholding more than the editor is the safe
 * side of that difference.
 */

/** the opening tag of a persisted span */
const OPEN_RE = /<span\b[^>]*\bdata-redaction\b[^>]*>/gi
const LABEL_RE = /\bdata-label\s*=\s*(?:"([^"]*)"|'([^']*)')/i
const CLOSE_RE = /<\/span\b[^>]*>/gi
/** the attribute that makes a span a withheld one, wherever it is spelled */
const MARK_NAME_RE = /data-redaction/i

/** the file's text with every withheld span replaced by its `{{label}}` marker */
export function redactMarkdownSource(source: string): string {
  if (!MARK_NAME_RE.test(source)) return source
  const open = new RegExp(OPEN_RE)
  const close = new RegExp(CLOSE_RE)
  const out: string[] = []
  let cursor = 0
  for (;;) {
    open.lastIndex = cursor
    const start = open.exec(source)
    if (!start) break
    close.lastIndex = start.index + start[0].length
    const end = close.exec(source)
    // the editor withholds an unclosed span to the end of its paragraph; where
    // that paragraph ends is the parser's call, not one to guess at here
    if (!end) throw new RedactionMarkError('a withheld span is never closed')
    const found = LABEL_RE.exec(start[0])
    const label = (found?.[1] ?? found?.[2] ?? 'private').trim() || 'private'
    out.push(kept(source.slice(cursor, start.index)), placeholderSource(label))
    cursor = end.index + end[0].length
  }
  out.push(kept(source.slice(cursor)))
  return out.join('')
}

/**
 * Text that stays as written. If it still names the mark, a span was spelled in
 * a way the pattern above did not take (a `>` inside an attribute, a tag that
 * never ends), and what it withholds is unknown.
 */
function kept(text: string): string {
  if (MARK_NAME_RE.test(text)) {
    throw new RedactionMarkError('a withheld span is written in a form that cannot be read')
  }
  return text
}
