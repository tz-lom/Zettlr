// Transpiles Markdown and HTML criss and cross
import { Processor } from 'unified'
import { remark } from 'remark'
import { rehype } from 'rehype'
import { Root as HastRoot } from 'hast'
import { Root as MdastRoot, Parent, Text } from 'mdast'
import remarkFrontmatter from 'remark-frontmatter' // Processes frontmatters
import remarkMath from 'remark-math' // Processes Math in mdast
import remarkRehype from 'remark-rehype' // mdast -> hast
import remarkStringify from 'remark-stringify' // mdast -> string
import rehypeStringify from 'rehype-stringify' // hast -> string
import rehypeRemark from 'rehype-remark' // hast -> mdast

/**
 * Returns a new Markdown processor that can process Markdown source
 *
 * @return  {Processor<MdastRoot>}  The processor
 */
function mdProcessor (): Processor<MdastRoot, MdastRoot, MdastRoot, string> {
  return remark()
    .use(remarkFrontmatter, [
      // Either Pandoc-style frontmatters ...
      // { type: 'yaml', fence: { open: '---', close: '...' } },
      // ... or Jekyll/Static site generators-style frontmatters.
      { type: 'yaml', fence: { open: '---', close: '---' } }
    ])
    .use(remarkMath)
}

/**
 * This is a DEBUG function used until issue #5 at micromark-extension-frontmatter is fixed
 *
 * @param   {string}  md  The original Markdown
 *
 * @return  {string}      The new Markdown with Pandoc frontmatters normalized to Jekyll-style
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
function __DEBUG__normalizeFrontmatter (md: string): string {
  const eol = md.includes('\r\n')
    ? '\r\n'
    : md.includes('\n\r') ? '\n\r' : '\n'

  if (!md.startsWith(`---${eol}`)) {
    return md // No frontmatter, nothing to do
  }

  const lines = md.split(eol)

  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      return md // We first found a correct frontmatter, so nothing to do
    } else if (lines[i] === '...') {
      // Pandoc style ending, so exchange and return normalized frontmatter
      lines[i] = '---'
      return lines.join(eol)
    }
  }

  return md
}

/**
 * Returns a new HTML processor that can process HTML code
 *
 * @return  {Processor<HastRoot>}  The processor
 */
function htmlProcessor (): Processor<HastRoot, HastRoot, HastRoot, string> {
  return rehype()
}

/**
 * Turns Markdown to HTML
 *
 * @param   {string}           md       The Markdown source
 * @param   {string}           library  Optional CSL library to resolve citations
 *
 * @return  {Promise<string>}           Resolves with the HTML code
 */
export async function md2html (md: string, library?: string): Promise<string> {
  const file = await mdProcessor()
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(__DEBUG__normalizeFrontmatter(md))
  return String(file)
}

/**
 * Turns HTML to Markdown
 *
 * @param   {string}           html  The HTML source
 *
 * @return  {Promise<string>}        Resolves with the Markdown code
 */
export async function html2md (html: string): Promise<string> {
  const file = await htmlProcessor()
    .use(rehypeRemark)
    .use(remarkStringify)
    .process(html)
  return String(file)
}

/**
* Returns just the text nodes from a string of Markdown, using mdast
*
* @param   {string|Parent}  input  Either Markdown string or an AST element (only)
*
* @return  {Text[]}            A set of text nodes (including their positions)
*/
export function extractTextnodes (input: string|Parent): Text[] {
  const ast = (typeof input === 'string') ? mdProcessor().parse(__DEBUG__normalizeFrontmatter(input)) : input
  const textNodes: Text[] = []
  // NOTE: We're dealing with an mdast, not the CodeMirror Markdown mode one!
  const ignoreBlocks = [ 'code', 'math' ]

  for (const child of ast.children) {
    if (ignoreBlocks.includes(child.type)) {
      continue // Ignore non-text blocks
    }

    if ('children' in child && Array.isArray(child.children)) {
      textNodes.push(...extractTextnodes(child)) // Text nodes cannot have children
    } else if (child.type === 'text') {
      // Only spit out text nodes
      textNodes.push(child)
    }
  }

  return textNodes
}
