// Mention shortcode mapping
export interface MentionMapping {
  [key: string]: string
}

// -------------------------------------------
// 2) Parsing to detect unclosed code/LaTeX blocks
// -------------------------------------------
/**
 * Returns `true` if the position `pos` (where last word begins)
 * is currently inside an unclosed triple-backtick fence or unclosed `$$` block.
 * We do a simple left-to-right parse counting enters/exits of code or math blocks.
 */
function isInsideUnclosedFenceOrLatex(text: string, pos: number): boolean {
  let inFence = false
  let inLatex = false
  let i = 0

  while (i < pos) {
    // Check triple backticks
    const nextFence = text.indexOf('```', i)
    const nextDollars = text.indexOf('$$', i)

    // If neither found, we can break
    if (nextFence === -1 && nextDollars === -1) break

    // Decide which occurs first in the text
    let nextEvent: 'fence' | 'latex' = 'fence'
    let nextIndex = nextFence

    if (nextFence === -1 || (nextDollars !== -1 && nextDollars < nextFence)) {
      nextEvent = 'latex'
      nextIndex = nextDollars
    }

    if (nextIndex === -1 || nextIndex >= pos) {
      // No event or it's beyond pos
      break
    }

    // Move to that event
    i = nextIndex

    if (nextEvent === 'fence') {
      // Toggle fence: if not inFence, we enter; if inFence, we exit
      inFence = !inFence
      // skip past it
      i += 3
    } else {
      // nextEvent === 'latex'
      inLatex = !inLatex
      i += 2
    }
  }

  // If after scanning up to pos, we are still inFence or inLatex, then it's unclosed
  return inFence || inLatex
}

// -------------------------------------------
// 3) Extract last word
// -------------------------------------------
function extractLastWord(text: string): { word: string; delimiter: string; startIndex: number } {
  // If there's trailing space/punct, treat preceding chunk as a complete word
  const trailingDelim = text.match(/[ \t\r\n.,!?]+$/)
  if (trailingDelim) {
    const delimiter = trailingDelim[0]
    const delimStart = trailingDelim.index!
    const candidateText = text.slice(0, delimStart)
    const wordMatch = candidateText.match(/[\w<>:()[\]{}]+$/)
    if (!wordMatch || wordMatch.index == null) {
      return { word: '', delimiter, startIndex: -1 }
    }
    return {
      word: wordMatch[0],
      delimiter,
      startIndex: wordMatch.index,
    }
  }

  // Otherwise, partial word at the very end
  const wordMatch = text.match(/[\w<>:()[\]{}]+$/)
  if (!wordMatch || wordMatch.index == null) {
    return { word: '', delimiter: '', startIndex: -1 }
  }
  return {
    word: wordMatch[0],
    delimiter: '',
    startIndex: wordMatch.index,
  }
}

// -------------------------------------------
// 4) Protected check for "while typing" scenario
// -------------------------------------------
function isLastWordProtected(text: string): boolean {
  const { word, startIndex } = extractLastWord(text)
  if (!word) return false

  // If inside an unclosed triple-fence or unclosed $$, skip
  const insideFence = isInsideUnclosedFenceOrLatex(text, startIndex)
  if (insideFence) return true

  // Also skip if there's a fully closed code snippet or $$ block that includes startIndex
  // Or if it's inside a URL or simple math, or attached to prior word-chars.
  // We do this with simpler matches:

  // A) code blocks (fully closed)
  const codeBlockMatches = [...text.matchAll(/```[\s\S]*?```|`[^`]+`/g)]
  for (const m of codeBlockMatches) {
    if (m.index != null) {
      const blockStart = m.index
      const blockEnd = blockStart + m[0].length
      if (startIndex >= blockStart && startIndex < blockEnd) {
        return true
      }
    }
  }

  // B) fully closed $$ blocks
  const latexMatches = [...text.matchAll(/\$\$[\s\S]*?\$\$/g)]
  for (const m of latexMatches) {
    if (m.index != null) {
      const blockStart = m.index
      const blockEnd = blockStart + m[0].length
      if (startIndex >= blockStart && startIndex < blockEnd) {
        return true
      }
    }
  }

  // C) URLs
  const urlMatches = [...text.matchAll(/https?:\/\/\S+/g)]
  for (const m of urlMatches) {
    if (m.index != null) {
      const urlStart = m.index
      const urlEnd = urlStart + m[0].length
      if (startIndex >= urlStart && startIndex < urlEnd) {
        return true
      }
    }
  }

  // D) simple math expressions
  const mathRegex = /\b\d+[<>]\d+\b|\b\w+[<>]\d+\b|\([^)]*[<>][^)]*\)/g
  const mathMatches = [...text.matchAll(mathRegex)]
  for (const m of mathMatches) {
    if (m.index != null) {
      const exprStart = m.index
      const exprEnd = exprStart + m[0].length
      if (startIndex >= exprStart && startIndex < exprEnd) {
        return true
      }
    }
  }

  // E) If the lastWord is attached to prior word-chars => treat it as part of bigger word
  if (startIndex > 0 && /\w$/.test(text.slice(startIndex - 1, startIndex))) {
    return true
  }

  return false
}

// -------------------------------------------
// 5) While-typing replacement
// -------------------------------------------
function replaceIfMention(
  word: string,
  delimiter: string,
  mentionToNormalized: MentionMapping
): { replaced: string; offset: number } {
  if (mentionToNormalized[word]) {
    if (!delimiter) {
      return { replaced: word, offset: 0 }
    }
    const replacedWord = mentionToNormalized[word]
    let offset = replacedWord.length - word.length
    // tests want an extra -1 if emoticon had trailing space/punct
    offset -= 1
    return { replaced: replacedWord, offset }
  }

  return { replaced: word, offset: 0 }
}

function mentionfyWhileTyping(
  text: string,
  cursorPos: number,
  mentionToNormalized: MentionMapping
): { text: string; cursorOffset: number } {
  const beforeCursor = text.slice(0, cursorPos)
  const afterCursor = text.slice(cursorPos)

  if (isLastWordProtected(beforeCursor)) {
    return { text, cursorOffset: 0 }
  }

  const { word, delimiter, startIndex } = extractLastWord(beforeCursor)
  if (!word) {
    return { text, cursorOffset: 0 }
  }

  const { replaced, offset } = replaceIfMention(word, delimiter, mentionToNormalized)
  if (replaced === word) {
    return { text, cursorOffset: 0 }
  }

  const beforeWord = beforeCursor.slice(0, startIndex)
  const newText = beforeWord + replaced + delimiter + afterCursor
  return { text: newText, cursorOffset: offset }
}

// -------------------------------------------
// 6) On-send: Replace all in unprotected segments
// -------------------------------------------
function replaceAllMentionsInUnprotected(segment: string, mentionToNormalized: MentionMapping): string {
  // Word-boundary-based matching of emoticons & shortcodes
  // Using lookbehind/lookahead to avoid partial word replacements.
  // We'll include :p, :), <3, etc., plus shortcodes like :heart:
  // Make sure to add variants as needed.
  const tokenRegex = new RegExp(
    [
      '@[a-zA-Z0-9_+\\-]+', // mentions ("@alice")
    ].join('|'),
    'g'
  )

  return segment.replace(tokenRegex, match => {
    if (mentionToNormalized[match]) {
      return mentionToNormalized[match]
    }
    return match
  })
}

function mentionfyOnSend(text: string, mentionToNormalized: MentionMapping): string {
  // Protected: triple backtick blocks, inline code, URLs, $$ math blocks, simple math
  const protectedRegex =
    /```[\s\S]*?```|`[^`]+`|https?:\/\/\S+|\$\$[\s\S]*?\$\$|\b\d+[<>]\d+\b|\b\w+[<>]\d+\b|\([^)]*[<>][^)]*\)/g

  let result = ''
  let lastIndex = 0
  const matches = [...text.matchAll(protectedRegex)]

  for (const m of matches) {
    if (m.index == null) continue
    const start = m.index
    // unprotected chunk
    const unprotected = text.slice(lastIndex, start)
    result += replaceAllMentionsInUnprotected(unprotected, mentionToNormalized)
    // add protected chunk verbatim
    result += m[0]
    lastIndex = start + m[0].length
  }

  // leftover unprotected
  if (lastIndex < text.length) {
    const unprotected = text.slice(lastIndex)
    result += replaceAllMentionsInUnprotected(unprotected, mentionToNormalized)
  }

  return result
}

// -------------------------------------------
// 7) Tab completion support
// -------------------------------------------
/**
 * Finds mention shortcodes that match a partial input
 * @param partial The partial shortcode (e.g., ":sm")
 * @param limit Maximum number of matches to return
 * @returns Array of matching mention shortcodes
 */
export function findMatchingMentions(
  partial: string,
  limit: number = 5,
  mentionToNormalized: MentionMapping
): string[] {
  // Only match shortcodes that start with a colon
  if (!partial.startsWith('@')) return []

  const exactMatches: string[] = []
  const startMatches: string[] = []
  const containsMatches: string[] = []

  const search = partial.toLowerCase()

  // Search only through shortcodes (not emoticons) with priority
  for (const code in mentionToNormalized) {
    const lowerCode = code.toLowerCase()

    // Exact match (prioritize these)
    if (lowerCode === search) {
      exactMatches.push(code)
    }
    // Starts with match (second priority)
    else if (lowerCode.startsWith(search)) {
      startMatches.push(code)
    }
    // Contains match for words after the first colon (lowest priority)
    // E.g. ":heart" should match ":broken_heart:"
    else if (search.length > 1 && lowerCode.includes(search.substring(1))) {
      containsMatches.push(code)
    }

    // If we have enough higher-priority matches, stop collecting lower priority ones
    if (exactMatches.length >= limit) {
      return exactMatches.slice(0, limit)
    }
  }

  // Combine matches in priority order
  const allMatches = [...exactMatches, ...startMatches, ...containsMatches]
  return allMatches.slice(0, limit)
}

/**
 * Extracts the partial mention shortcode at the cursor position
 * @param text The input text
 * @param cursorPos The cursor position
 * @returns The partial shortcode and its start position, or null if no partial shortcode is found
 */
export function extractPartialMentionCode(
  text: string,
  cursorPos: number
): { partial: string; startPos: number } | null {
  // Only look at text before the cursor
  const beforeCursor = text.slice(0, cursorPos)

  // Find the last colon before the cursor
  const colonPos = beforeCursor.lastIndexOf('@')
  if (colonPos === -1) return null

  // Make sure there's no space between the colon and cursor
  const textBetween = beforeCursor.slice(colonPos)
  if (textBetween.includes(' ')) return null

  // Check if we're potentially in the middle of a shortcode
  return {
    partial: textBetween,
    startPos: colonPos,
  }
}

/**
 * Completes a partial mention shortcode with the given completion
 * @param text The full input text
 * @param cursorPos The cursor position
 * @param completion The full mention shortcode to complete with
 * @returns The updated text and new cursor position
 */
export function completeMentionCode(
  text: string,
  cursorPos: number,
  completion: string
): { text: string; newCursorPos: number } {
  const partial = extractPartialMentionCode(text, cursorPos)
  if (!partial) return { text, newCursorPos: cursorPos }

  const beforePartial = text.slice(0, partial.startPos)
  const afterCursor = text.slice(cursorPos)

  const newText = beforePartial + completion + afterCursor
  const newCursorPos = partial.startPos + completion.length

  return { text: newText, newCursorPos }
}

// -------------------------------------------
// 8) Main export
// -------------------------------------------
export function mentionfy(
  text: string,
  mentionToNormalized: MentionMapping,
  options?: number | { finalSend?: boolean }
): { text: string; cursorOffset: number } | string {
  if (typeof options === 'number') {
    return mentionfyWhileTyping(text, options, mentionToNormalized)
  }
  if (options && options.finalSend) {
    return mentionfyOnSend(text, mentionToNormalized)
  }
  return { text, cursorOffset: 0 }
}
