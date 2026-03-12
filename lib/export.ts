import { marked } from 'marked'

/**
 * Export a document to various formats.
 */
export function exportToMarkdown(title: string, content: string): string {
  return `# ${title}\n\n${content}`
}

export function exportToHtml(
  title: string,
  content: string,
  options: { standalone?: boolean; theme?: 'light' | 'dark' } = {},
): string {
  const { standalone = true, theme = 'light' } = options
  const htmlContent = marked.parse(content, { async: false }) as string

  if (!standalone) return htmlContent

  const bgColor = theme === 'dark' ? '#1a1a1a' : '#ffffff'
  const textColor = theme === 'dark' ? '#e0e0e0' : '#1a1a1a'

  return `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.7;
      color: ${textColor};
      background: ${bgColor};
      max-width: 48rem;
      margin: 0 auto;
      padding: 3rem 1.5rem;
    }
    h1 { font-size: 2rem; font-weight: 700; margin-bottom: 1.5rem; }
    h2 { font-size: 1.5rem; font-weight: 600; margin-top: 2rem; margin-bottom: 0.75rem; }
    h3 { font-size: 1.25rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.5rem; }
    p { margin-bottom: 1rem; }
    code {
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 0.875em;
      background: ${theme === 'dark' ? '#2d2d2d' : '#f4f4f5'};
      padding: 0.2em 0.4em;
      border-radius: 3px;
    }
    pre {
      background: ${theme === 'dark' ? '#2d2d2d' : '#f4f4f5'};
      padding: 1rem;
      border-radius: 6px;
      overflow-x: auto;
      margin-bottom: 1rem;
    }
    pre code { background: none; padding: 0; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1rem;
    }
    th, td {
      border: 1px solid ${theme === 'dark' ? '#404040' : '#e4e4e7'};
      padding: 0.5rem 0.75rem;
      text-align: left;
    }
    th { background: ${theme === 'dark' ? '#2d2d2d' : '#f4f4f5'}; font-weight: 600; }
    a { color: #3b82f6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    ul, ol { margin-bottom: 1rem; padding-left: 1.5rem; }
    li { margin-bottom: 0.25rem; }
    blockquote {
      border-left: 3px solid ${theme === 'dark' ? '#404040' : '#e4e4e7'};
      padding-left: 1rem;
      color: ${theme === 'dark' ? '#a0a0a0' : '#71717a'};
      margin-bottom: 1rem;
    }
    hr { border: none; border-top: 1px solid ${theme === 'dark' ? '#404040' : '#e4e4e7'}; margin: 2rem 0; }
    img { max-width: 100%; height: auto; border-radius: 6px; }
    @media print {
      body { max-width: none; padding: 1cm; }
    }
  </style>
</head>
<body>
  <article>
    <h1>${escapeHtml(title)}</h1>
    ${htmlContent}
  </article>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
