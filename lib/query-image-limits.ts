// Shared byte limits for query-time image uploads.
//
// Pure constants only. NEVER import anything here — this file is bundled
// into both the browser (for the pre-encode `file.size` check) and the
// server (for the post-decode payload check). Adding a runtime import
// would drag that dependency into the client bundle.

// Raw file ceiling enforced client-side before base64 encoding.
export const QUERY_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

// Encoded data-URL ceiling enforced server-side. Base64 inflates payloads
// by ~33%, plus the `data:image/<mime>;base64,` prefix; 12 MB comfortably
// accommodates an 8 MB raw image and blocks anything materially larger.
export const QUERY_IMAGE_MAX_DATA_URL_CHARS = 12 * 1024 * 1024;
