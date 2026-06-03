// Server-side image upload validation: MIME allow-list, size cap, true file
// header (magic-byte) sniffing, and filename hardening. The browser-reported
// MIME type can be spoofed, so the magic-byte check is the authoritative one.

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
export const MAX_FILENAME_LENGTH = 255

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

export interface ImageValidationResult {
  valid: boolean
  error?: string
}

/** Cheap pre-checks on the File metadata (MIME + size). */
export function validateImageUpload(file: File): ImageValidationResult {
  if (!file) return { valid: false, error: 'No file provided' }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: 'Only JPEG, PNG, GIF, and WebP images are allowed' }
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'Image must be under 10MB' }
  }
  if (file.size === 0) {
    return { valid: false, error: 'Image file is empty' }
  }
  return { valid: true }
}

/**
 * Inspect the first bytes of the buffer to confirm it is actually one of the
 * allowed image formats — defends against a spoofed Content-Type.
 */
export function verifyImageMagicBytes(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 12) return false
  const bytes = new Uint8Array(buffer.slice(0, 12))

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true
  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return true
  // WebP: "RIFF" .... "WEBP"
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return true

  return false
}

/**
 * Produce a safe storage filename: strips path separators, control chars, and
 * caps length. Always pairs a random component with a MIME-derived extension so
 * a spoofed/odd original name can't influence the stored path.
 */
export function safeStorageFilename(mime: string, prefix = ''): string {
  const ext = EXT_BY_MIME[mime] || 'bin'
  const rand = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const base = `${prefix}${rand}.${ext}`
  return base.slice(0, MAX_FILENAME_LENGTH)
}

/** Sanitize a caller-supplied filename: remove path separators + control chars, cap length. */
export function sanitizeFilename(name: string): string {
  return (name || 'file')
    .replace(/[\\/]/g, '') // strip path separators
    .replace(/[\x00-\x1f]/g, '') // strip control chars
    .replace(/\.{2,}/g, '.') // collapse path-traversal dots
    .trim()
    .slice(0, MAX_FILENAME_LENGTH) || 'file'
}

/**
 * Full server-side validation of an uploaded File: metadata checks + magic bytes.
 * Returns the validated ArrayBuffer (so callers don't read it twice).
 */
export async function validateImageFile(
  file: File
): Promise<{ valid: true; buffer: ArrayBuffer } | { valid: false; error: string }> {
  const meta = validateImageUpload(file)
  if (!meta.valid) return { valid: false, error: meta.error! }

  const buffer = await file.arrayBuffer()
  if (!verifyImageMagicBytes(buffer)) {
    return { valid: false, error: 'Invalid file format' }
  }
  return { valid: true, buffer }
}
