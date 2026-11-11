/**
 * Internal Pinterest helpers for Daily Viral Deals.
 * Compliant flow: draft from our reviews → human confirm → official API create.
 * Does not scrape Pinterest UI or store other users' Pins/boards.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const SITE_URL = (process.env.SITE_URL || 'https://mybusinesswork.com').replace(/\/$/, '');
/** Production by default. Trial apps must use sandbox until Standard access is approved. */
export const API_BASE = (
    process.env.PINTEREST_API_BASE ||
    (process.env.PINTEREST_USE_SANDBOX === '1'
        ? 'https://api-sandbox.pinterest.com/v5'
        : 'https://api.pinterest.com/v5')
).replace(/\/$/, '');
// boards:write is required by Pins API create even when posting to an existing board.
export const DEFAULT_SCOPES = ['boards:read', 'boards:write', 'pins:read', 'pins:write'];
export const DRAFTS_DIR = path.join('data', 'pinterest', 'drafts');
export const PUBLISHED_DIR = path.join('data', 'pinterest', 'published');
export const REVIEWS_DIR = path.join('src', 'content', 'reviews');

/** Pinterest-recommended standard Pin: 2:3 vertical @ 1000×1500. */
export const PIN_WIDTH = 1000;
export const PIN_HEIGHT = 1500;
export const PIN_ASPECT = '2:3';
export const PIN_FILENAME = 'pinterest-pin.jpg';

const TITLE_MAX = 100;
const DESC_MAX = 800;

export function fail(msg) {
    console.error(`\nError: ${msg}\n`);
    process.exit(1);
}

export function absoluteUrl(src) {
    if (!src) return undefined;
    if (/^https?:\/\//i.test(src)) return src;
    return `${SITE_URL}${src.startsWith('/') ? '' : '/'}${src}`;
}

export function truncate(s, max) {
    const t = String(s || '').trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1).trimEnd()}…`;
}

/** Minimal YAML frontmatter parse for our review files (no nested objects required). */
export function parseReviewFrontmatter(raw, filePath) {
    const m = String(raw).match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) fail(`No frontmatter in ${filePath}`);
    const fm = {};
    const lines = m[1].split(/\r?\n/);
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (!line.trim() || line.trimStart().startsWith('#')) {
            i += 1;
            continue;
        }
        // Skip YAML arrays / nested blocks we don't need for drafts.
        if (/^\s+-\s/.test(line) || /^\s+\w+:/.test(line)) {
            i += 1;
            continue;
        }
        const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
        if (!kv) {
            i += 1;
            continue;
        }
        const key = kv[1];
        let val = kv[2].trim();
        if (val === '' || val === '|' || val === '>') {
            // Skip multiline / empty complex fields.
            i += 1;
            while (i < lines.length && /^\s/.test(lines[i])) i += 1;
            continue;
        }
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        if (val.startsWith('[') && val.endsWith(']')) {
            try {
                fm[key] = JSON.parse(val.replace(/'/g, '"'));
            } catch {
                fm[key] = val;
            }
            i += 1;
            continue;
        }
        fm[key] = val;
        i += 1;
    }
    const slug = path.basename(filePath, '.md');
    return { ...fm, slug, filePath };
}

export async function listDraftableReviews(filterSlug) {
    const names = (await fs.readdir(REVIEWS_DIR)).filter((f) => f.endsWith('.md'));
    const needle = filterSlug ? String(filterSlug).toLowerCase() : '';
    const out = [];
    for (const name of names) {
        const slug = name.replace(/\.md$/, '');
        const filePath = path.join(REVIEWS_DIR, name);
        const raw = await fs.readFile(filePath, 'utf8');
        const review = parseReviewFrontmatter(raw, filePath);
        if (needle) {
            const hay = `${slug} ${review.asin || ''}`.toLowerCase();
            if (!hay.includes(needle)) continue;
        }
        out.push(review);
    }
    out.sort((a, b) => String(a.slug).localeCompare(String(b.slug)));
    return out;
}

export function reviewImageDir(review) {
    const asin = String(review.asin || review.id || 'unknown').toLowerCase();
    return path.join('public', 'images', 'reviews', asin);
}

export function pinImageLocalPath(review) {
    return path.join(reviewImageDir(review), PIN_FILENAME);
}

export function pinImagePublicPath(review) {
    const asin = String(review.asin || review.id || 'unknown').toLowerCase();
    return `/images/reviews/${asin}/${PIN_FILENAME}`;
}

/** Pin copy: hook on the Pin (title + description), not just product SEO title. */
export function buildPinDraft(review, { pinImageReady = false } = {}) {
    const hook = String(review.hook || '').trim();
    if (!hook) fail(`Review ${review.slug} is missing hook — required on the Pin image and description.`);

    const link = `${SITE_URL}/reviews/${review.slug}/`;
    const title = truncate(hook, TITLE_MAX);
    const description = truncate(
        [
            hook,
            review.hookSupport || '',
            `Full review: ${review.title || 'Daily Viral Deals'}`,
        ]
            .map((s) => String(s || '').trim())
            .filter(Boolean)
            .join('\n\n'),
        DESC_MAX,
    );

    const pinRel = pinImagePublicPath(review);
    const mediaUrl = absoluteUrl(pinRel);
    const draft = {
        id: review.asin || review.slug,
        slug: review.slug,
        asin: review.asin || undefined,
        hook,
        title,
        description,
        link,
        mediaUrl,
        mediaLocalPath: pinImageLocalPath(review),
        mediaPublicPath: pinRel,
        sourceImageSrc: review.imageSrc || undefined,
        altText: truncate(`${hook} — Daily Viral Deals`, 500),
        angle: review.angle || undefined,
        pinSpec: {
            width: PIN_WIDTH,
            height: PIN_HEIGHT,
            aspectRatio: PIN_ASPECT,
            hookOnImage: true,
        },
        hookOnImage: Boolean(pinImageReady),
        createdAt: new Date().toISOString(),
        source: 'daily-viral-deals-review',
    };
    draft.draftHash = crypto
        .createHash('sha256')
        .update(
            JSON.stringify({
                title: draft.title,
                description: draft.description,
                link: draft.link,
                mediaUrl: draft.mediaUrl,
                hook: draft.hook,
            }),
        )
        .digest('hex')
        .slice(0, 16);
    return draft;
}

/** Refuse publish unless hook is in the description and a dedicated Pin image exists. */
export function assertDraftReadyForPublish(draft) {
    const hook = String(draft.hook || '').trim();
    if (!hook) fail('Draft is missing hook. Re-run: npm run pinterest:draft');
    if (!String(draft.description || '').includes(hook)) {
        fail('Pin description must include the review hook. Re-run: npm run pinterest:draft');
    }
    if (!draft.hookOnImage || !String(draft.mediaUrl || '').includes(PIN_FILENAME)) {
        fail(
            `Missing Pinterest Pin image with hook on it (${PIN_WIDTH}×${PIN_HEIGHT}, ${PIN_ASPECT}).\n` +
                'Run: npm run pinterest:draft  (generates the Pin image before publish)',
        );
    }
}

export async function writeDraft(draft) {
    await fs.mkdir(DRAFTS_DIR, { recursive: true });
    const file = path.join(DRAFTS_DIR, `${draft.id}.json`);
    await fs.writeFile(file, JSON.stringify(draft, null, 2) + '\n');
    return file;
}

export async function readDraft(filePath) {
    try {
        return JSON.parse(await fs.readFile(filePath, 'utf8'));
    } catch (e) {
        fail(`Cannot read draft ${filePath}: ${e.message}`);
    }
}

export function requireEnv(name) {
    const v = process.env[name]?.trim();
    if (!v) fail(`${name} is missing in .env`);
    return v;
}

export async function refreshAccessTokenIfNeeded() {
    const refresh = process.env.PINTEREST_REFRESH_TOKEN?.trim();
    const appId = process.env.PINTEREST_APP_ID?.trim();
    const appSecret = process.env.PINTEREST_APP_SECRET?.trim();
    let access = process.env.PINTEREST_ACCESS_TOKEN?.trim();
    if (access) return access;
    if (!refresh) fail('PINTEREST_ACCESS_TOKEN is missing (and no PINTEREST_REFRESH_TOKEN to renew).');
    if (!appId || !appSecret) fail('Need PINTEREST_APP_ID and PINTEREST_APP_SECRET to refresh the token.');

    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh,
        continuous_refresh: 'true',
    });
    const basic = Buffer.from(`${appId}:${appSecret}`).toString('base64');
    const res = await fetch('https://api.pinterest.com/v5/oauth/token', {
        method: 'POST',
        headers: {
            Authorization: `Basic ${basic}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        fail(`Token refresh failed (${res.status}): ${json.message || JSON.stringify(json)}`);
    }
    access = json.access_token;
    if (!access) fail('Token refresh returned no access_token.');
    console.log('Refreshed Pinterest access token (update PINTEREST_ACCESS_TOKEN in .env for next runs).');
    if (json.refresh_token) {
        console.log('Also received a new refresh token — update PINTEREST_REFRESH_TOKEN in .env.');
    }
    process.env.PINTEREST_ACCESS_TOKEN = access;
    return access;
}

export async function createPin({ token, boardId, draft }) {
    const payload = {
        title: draft.title,
        description: draft.description,
        board_id: boardId,
        link: draft.link,
        media_source: {
            source_type: 'image_url',
            url: draft.mediaUrl,
        },
    };
    if (draft.altText) payload.alt_text = draft.altText;

    const res = await fetch(`${API_BASE}/pins`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        // Some API versions expect media_url instead of url — retry once.
        if (res.status === 400 && payload.media_source.url) {
            payload.media_source = {
                source_type: 'image_url',
                media_url: draft.mediaUrl,
            };
            const retry = await fetch(`${API_BASE}/pins`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            const retryJson = await retry.json().catch(() => ({}));
            if (!retry.ok) {
                fail(`Pin create failed (${retry.status}): ${retryJson.message || JSON.stringify(retryJson)}`);
            }
            return retryJson;
        }
        const detail = json.message || JSON.stringify(json);
        if (res.status === 403 && /Trial access|api-sandbox/i.test(detail)) {
            fail(
                `Pin create failed (403): ${detail}\n\n` +
                    'Your Pinterest app is on Trial access — production Pin creates are blocked.\n' +
                    'Fix: developers.pinterest.com → your app → Upgrade to Standard access\n' +
                    '(submit a short screen recording of oauth + one confirmed publish).\n' +
                    'Optional test-only: set PINTEREST_USE_SANDBOX=1 and use a sandbox board id.',
            );
        }
        fail(`Pin create failed (${res.status}): ${detail}`);
    }
    return json;
}

export async function writePublishReceipt({ draft, pin, boardId }) {
    await fs.mkdir(PUBLISHED_DIR, { recursive: true });
    const receipt = {
        pinId: pin.id || pin.pin_id || undefined,
        boardId,
        draftHash: draft.draftHash,
        slug: draft.slug,
        publishedAt: new Date().toISOString(),
        link: draft.link,
        mediaUrl: draft.mediaUrl,
    };
    const file = path.join(
        PUBLISHED_DIR,
        `${draft.id}-${receipt.publishedAt.slice(0, 10)}.json`,
    );
    await fs.writeFile(file, JSON.stringify(receipt, null, 2) + '\n');
    return { file, receipt };
}

export function buildAuthorizeUrl({ appId, redirectUri, state, scopes = DEFAULT_SCOPES }) {
    const u = new URL('https://www.pinterest.com/oauth/');
    u.searchParams.set('client_id', appId);
    u.searchParams.set('redirect_uri', redirectUri);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('scope', scopes.join(','));
    u.searchParams.set('state', state);
    return u.toString();
}

export async function exchangeAuthorizationCode({ appId, appSecret, redirectUri, code }) {
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        continuous_refresh: 'true',
    });
    const basic = Buffer.from(`${appId}:${appSecret}`).toString('base64');
    const res = await fetch('https://api.pinterest.com/v5/oauth/token', {
        method: 'POST',
        headers: {
            Authorization: `Basic ${basic}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        fail(`OAuth token exchange failed (${res.status}): ${json.message || JSON.stringify(json)}`);
    }
    return json;
}
