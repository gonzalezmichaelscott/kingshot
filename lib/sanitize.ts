// HTML sanitization for any content rendered via dangerouslySetInnerHTML.
//
// The rich-text editor renders a small Markdown subset to HTML (headings,
// bold/italic/underline, lists, images, line breaks). We allow exactly those
// tags/attributes and strip everything else (scripts, event handlers,
// javascript: URLs, etc.), closing the XSS hole where a crafted image URL or
// raw markup could inject attributes/scripts.

import DOMPurify from 'isomorphic-dompurify'

const RICH_TEXT_CONFIG = {
  ALLOWED_TAGS: [
    'h2', 'h3', 'strong', 'b', 'em', 'i', 'u',
    'ul', 'ol', 'li', 'br', 'p', 'span', 'img', 'a',
  ],
  ALLOWED_ATTR: ['class', 'src', 'alt', 'href', 'title', 'data-lightbox', 'target', 'rel'],
  // Only allow http(s) and data: image URLs; DOMPurify drops javascript: etc.
  ALLOWED_URI_REGEXP: /^(?:https?:|data:image\/|mailto:|\/)/i,
}

/** Sanitize rich-text HTML produced by parseMarkdownToHtml before rendering. */
export function sanitizeHtml(html: string): string {
  if (!html) return ''
  return DOMPurify.sanitize(html, RICH_TEXT_CONFIG)
}

/** Strict inline sanitizer (e.g. translated snippets) — only basic emphasis tags. */
export function sanitizeInline(html: string): string {
  if (!html) return ''
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: ['b', 'i', 'em', 'strong'], ALLOWED_ATTR: [] })
}
