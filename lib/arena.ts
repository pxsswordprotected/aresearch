// Typed wrapper for the Are.na v3 REST API.
//
// Docs: https://dev.are.na/documentation
// Base URL: https://api.are.na
//
// Field names below match what api.are.na actually returns today (verified
// against /v3/users/:slug and /v3/channels/:slug/contents) — some older docs
// mention `full_name`, `channel_count`, `class`, `base_class`; the live API
// uses `name`, `counts.channels`, `type`, `base_type`.
//
// We hit only public read endpoints; an optional ARENA_TOKEN (PAT, `read`
// scope) raises the rate limit from 30 req/min (guest) to 300 req/min
// (premium). The token is server-side only — never import this from a
// "use client" file.

const ARENA_BASE = "https://api.are.na";

export type ArenaUser = {
  id: number;
  slug: string;
  name: string;
  avatar?: string;
  counts?: {
    channels?: number;
    followers?: number;
    following?: number;
  };
} & Record<string, unknown>;

export type ArenaChannel = {
  id: number;
  slug: string;
  title: string;
  status?: string;
  base_type: "Channel";
  counts?: {
    blocks?: number;
    channels?: number;
    contents?: number;
    collaborators?: number;
  };
} & Record<string, unknown>;

// Block content types Are.na returns under `type` (capitalized). Unknown
// values fall through the string fallback so future server-side additions
// don't break decoding.
export type ArenaBlockType =
  | "Image"
  | "Text"
  | "Link"
  | "Media"
  | "Attachment"
  | "Embed"
  | (string & {});

export type ArenaRichText = {
  markdown?: string | null;
  html?: string | null;
  plain?: string | null;
};

export type ArenaBlock = {
  id: number;
  type: ArenaBlockType;
  base_type: "Block";
  title?: string | null;
  generated_title?: string;
  // Rich text body. Populated on Text blocks. Embed/Link/Image/Attachment
  // blocks put the upstream summary in `description` instead.
  content?: ArenaRichText | null;
  description?: ArenaRichText | null;
  source?: { url?: string; title?: string | null; provider?: { name?: string; url?: string } } | null;
  attachment?: { url?: string; file_name?: string; extension?: string } | null;
  image?: { original?: { url?: string }; display?: { url?: string }; thumb?: { url?: string } } | null;
  embed?: { url?: string | null; type?: string } | null;
  // Channel-context fields when fetched via /v3/channels/:id/contents.
  position?: number;
  connected_at?: string;
  connected_by_user_id?: number;
} & Record<string, unknown>;

export type ArenaContentItem = ArenaBlock | ArenaChannel;

export type ArenaListMeta = {
  current_page: number;
  total_pages: number;
  total_count: number;
  has_more_pages?: boolean;
};

export type ArenaList<T> = {
  data: T[];
  meta: ArenaListMeta;
};

export class ArenaError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ArenaError";
    this.status = status;
    this.code = code;
  }
}

// Strip URL, normalize, validate.
//
// Accepts:
//   - bare slug:                "j-arab1hdgxzs"
//   - profile URL:              "https://www.are.na/j-arab1hdgxzs"
//   - profile sub-page URL:     "https://www.are.na/j-arab1hdgxzs/channels"
//   - http or https, with or without "www."
//
// Slug allowlist: lowercase letters, digits, hyphens. Are.na slugs are
// generated and conform to this; rejecting everything else stops path
// injection before we hit fetch.
const SLUG_RE = /^[a-z0-9-]+$/;

export function parseUserSlug(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new ArenaError(400, "Empty input");

  let candidate = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      throw new ArenaError(400, `Invalid URL: ${trimmed}`);
    }
    const host = url.hostname.toLowerCase();
    if (host !== "are.na" && host !== "www.are.na") {
      throw new ArenaError(400, `Not an are.na URL: ${host}`);
    }
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length === 0) {
      throw new ArenaError(400, "URL has no user slug");
    }
    candidate = segments[0];
  }

  candidate = candidate.toLowerCase();
  if (!SLUG_RE.test(candidate)) {
    throw new ArenaError(400, `Invalid slug: ${candidate}`);
  }
  return candidate;
}

async function arenaFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  const token = process.env.ARENA_TOKEN;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${ARENA_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let message = `Are.na ${res.status} on ${path}`;
    let code: string | undefined;
    // Are.na error bodies vary; try JSON first, fall back to text.
    try {
      const body = (await res.json()) as {
        message?: string;
        error?: string;
        code?: string;
      };
      if (body.message) message = body.message;
      else if (body.error) message = body.error;
      if (body.code) code = body.code;
    } catch {
      try {
        const text = await res.text();
        if (text) message = text;
      } catch {
        // ignore — keep default message
      }
    }
    throw new ArenaError(res.status, message, code);
  }
  return (await res.json()) as T;
}

export function getUser(slug: string): Promise<ArenaUser> {
  return arenaFetch<ArenaUser>(`/v3/users/${encodeURIComponent(slug)}`);
}

export function getUserChannels(
  slug: string,
  opts: { page?: number; per?: number } = {},
): Promise<ArenaList<ArenaChannel>> {
  const page = opts.page ?? 1;
  const per = opts.per ?? 24;
  const qs = `?type=Channel&page=${page}&per=${per}`;
  return arenaFetch<ArenaList<ArenaChannel>>(
    `/v3/users/${encodeURIComponent(slug)}/contents${qs}`,
  );
}

export async function getAllUserChannels(
  slug: string,
): Promise<ArenaChannel[]> {
  const per = 100;
  const out: ArenaChannel[] = [];
  let page = 1;
  // Are.na caps `per` server-side; loop until we drain. Use meta to stop.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await getUserChannels(slug, { page, per });
    out.push(...res.data);
    if (res.data.length === 0) break;
    if (page >= res.meta.total_pages) break;
    page += 1;
  }
  return out;
}

export function getChannelContents(
  idOrSlug: string | number,
  opts: { page?: number; per?: number } = {},
): Promise<ArenaList<ArenaContentItem>> {
  const page = opts.page ?? 1;
  const per = opts.per ?? 10;
  const key = encodeURIComponent(String(idOrSlug));
  const qs = `?page=${page}&per=${per}`;
  return arenaFetch<ArenaList<ArenaContentItem>>(
    `/v3/channels/${key}/contents${qs}`,
  );
}

export function isArenaChannel(x: ArenaContentItem): x is ArenaChannel {
  return x.base_type === "Channel";
}

export function isArenaBlock(x: ArenaContentItem): x is ArenaBlock {
  return x.base_type === "Block";
}
