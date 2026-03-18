import DOMPurify from 'isomorphic-dompurify'

/** Sanitize plain text before storage or downstream processing. */
export function sanitizePlainText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
}

/**
 * Sanitize HTML to prevent XSS. Allows safe markup like <mark>, <em>, <strong>
 * but strips scripts, event handlers, and dangerous elements.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'code', 'pre', 'blockquote',
      'mark', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'img', 'hr', 'dl', 'dt', 'dd', 'sub', 'sup', 'details', 'summary',
      'figure', 'figcaption', 'del', 'ins', 'abbr', 'kbd', 'var', 'samp',
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel',
      'colspan', 'rowspan', 'style', 'width', 'height', 'loading',
    ],
    ALLOW_DATA_ATTR: false,
  })
}

/** Sanitize search headline HTML (only <mark> tags needed) */
export function sanitizeSearchHeadline(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['mark'],
    ALLOWED_ATTR: [],
  })
}
