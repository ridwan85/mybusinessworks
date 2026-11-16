/**
 * Zernio (zernio.com, formerly Late) — temporary production Pin publisher
 * while Pinterest Standard API access is blocked.
 * Same draft → human confirm → one pin flow.
 */
import { fail, requireEnv } from './pinterest.mjs';

const ZERNIO_API_BASE = process.env.ZERNIO_API_BASE?.trim() || 'https://zernio.com/api/v1';

export function zernioConfigured() {
    return Boolean(process.env.ZERNIO_API_KEY?.trim());
}

/** Prefer Zernio when key is set, unless PINTEREST_PUBLISH_VIA=pinterest. */
export function shouldPublishViaZernio() {
    const via = (process.env.PINTEREST_PUBLISH_VIA || '').trim().toLowerCase();
    if (via === 'pinterest') return false;
    if (via === 'zernio') {
        if (!zernioConfigured()) fail('PINTEREST_PUBLISH_VIA=zernio but ZERNIO_API_KEY is missing.');
        return true;
    }
    return zernioConfigured();
}

async function zernioFetch(path, { method = 'GET', body } = {}) {
    const key = requireEnv('ZERNIO_API_KEY');
    const res = await fetch(`${ZERNIO_API_BASE}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    return { res, json };
}

/** List connected social accounts so you can copy ZERNIO_PINTEREST_ACCOUNT_ID. */
export async function listZernioAccounts() {
    const { res, json } = await zernioFetch('/accounts');
    if (!res.ok) {
        fail(`Zernio accounts failed (${res.status}): ${json.message || JSON.stringify(json)}`);
    }
    return json;
}

/**
 * Create one Pinterest Pin through Zernio.
 * Media URL must already be publicly reachable (deployed site).
 */
export async function createPinViaZernio({ boardId, draft }) {
    const accountId = requireEnv('ZERNIO_PINTEREST_ACCOUNT_ID');
    if (!draft?.mediaUrl?.startsWith('https://')) {
        fail('Draft mediaUrl must be a public https URL for Zernio (deploy the pin image first).');
    }

    const payload = {
        content: draft.description || draft.hook || draft.title,
        title: draft.title || draft.hook,
        mediaItems: [{ type: 'image', url: draft.mediaUrl }],
        platforms: [
            {
                platform: 'pinterest',
                accountId,
                platformSpecificData: {
                    boardId,
                    title: draft.title || draft.hook,
                    link: draft.link,
                },
            },
        ],
        publishNow: true,
    };

    const { res, json } = await zernioFetch('/posts', { method: 'POST', body: payload });
    if (!res.ok) {
        fail(`Zernio Pin create failed (${res.status}): ${json.message || JSON.stringify(json)}`);
    }

    const post = json.post || json;
    const platform = Array.isArray(post.platforms)
        ? post.platforms.find((p) => p.platform === 'pinterest') || post.platforms[0]
        : null;

    return {
        provider: 'zernio',
        id: platform?.platformPostId || post._id || post.id,
        zernioPostId: post._id || post.id,
        url: platform?.platformPostUrl,
        raw: json,
    };
}
