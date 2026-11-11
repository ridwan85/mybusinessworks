// Usage: npm run generate -- "<amazon-product-url>" [--force]
import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';

const TAG = process.env.AMAZON_ASSOCIATE_TAG;
const env = process.env;
const PROVIDER = env.GEMINI_API_KEY ? 'gemini' : env.XAI_API_KEY ? 'grok' : 'openai';
const PROVIDERS = {
    gemini: { apiKey: env.GEMINI_API_KEY, baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', model: env.GEMINI_MODEL || 'gemini-flash-latest' },
    grok: { apiKey: env.XAI_API_KEY, baseURL: 'https://api.x.ai/v1', model: env.XAI_MODEL || 'grok-4' },
    openai: { apiKey: env.OPENAI_API_KEY, baseURL: undefined, model: env.OPENAI_MODEL || 'gpt-4o-mini' },
};
const MODEL = PROVIDERS[PROVIDER].model;
const DISCLOSURE = 'As an Amazon Associate I earn from qualifying purchases.';

const args = process.argv.slice(2);
const force = args.includes('--force');
const inputUrl = args.find((a) => !a.startsWith('--'));

function fail(msg) {
    console.error(`\nError: ${msg}\n`);
    process.exit(1);
}

if (!inputUrl) fail('Pass an Amazon product URL: npm run generate -- "https://www.amazon.com/dp/XXXXXXXXXX"');
if (!TAG) fail('AMAZON_ASSOCIATE_TAG is missing in .env');
if (!PROVIDERS[PROVIDER].apiKey) fail('Set GEMINI_API_KEY, XAI_API_KEY or OPENAI_API_KEY in .env');

const isAmazonHost = (h) => /(^|\.)amazon\.com$/i.test(h);
const isShortHost = (h) => /^(amzn\.to|a\.co|amzn\.com|link\.amazon)$/i.test(h);

async function resolveUrl(raw) {
    let url;
    try {
        url = new URL(raw);
    } catch {
        fail('Invalid URL.');
    }
    if (url.protocol !== 'https:') fail('URL must use https.');
    if (isShortHost(url.hostname)) {
        const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } });
        await res.body?.cancel();
        url = new URL(res.url);
    }
    if (!isAmazonHost(url.hostname)) fail('Only amazon.com (US store) links are supported.');
    return url;
}

function extractAsin(url) {
    const m = url.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d|product)\/([A-Z0-9]{10})/i);
    if (!m) fail('No product ASIN found. This link points to a non-product page (e.g. a storefront or list). Open the product page and copy its link.');
    return m[1].toUpperCase();
}

const slugify = (s) =>
    s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60)
        .replace(/-+$/, '');

// SiteStripe "Image" snippet: only Amazon-hosted <a>/<img> tags are accepted.
function parseSiteStripe(html, file) {
    if (!html?.trim()) return {};
    const bad = /<script|\son\w+\s*=|javascript:|<(?!\/?(?:a|img)\b)[a-z]/i.test(html);
    const urls = [...html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map((m) => (m[1].startsWith('//') ? `https:${m[1]}` : m[1]));
    const okHost = (u) => {
        try {
            return /(^|\.)(amazon\.com|amazon-adsystem\.com)$/.test(new URL(u).hostname);
        } catch {
            return false;
        }
    };
    const imgSrc = html.match(/<img[^>]+src\s*=\s*["']([^"']*amazon-adsystem\.com[^"']*)["']/i)?.[1];
    if (bad || !urls.length || !urls.every(okHost) || !imgSrc)
        fail(`${file}: "siteStripe" must be the unmodified Image snippet copied from SiteStripe.`);
    return { imageHtml: html.trim(), imageSrc: imgSrc.startsWith('//') ? `https:${imgSrc}` : imgSrc };
}

async function loadProduct(asin) {
    const file = path.join('data', 'products', `${asin}.json`);
    try {
        const p = JSON.parse(await fs.readFile(file, 'utf8'));
        if (!p.title?.trim()) fail(`${file}: "title" is empty.`);
        if (!Array.isArray(p.features) || !p.features.length) fail(`${file}: "features" must be a non-empty array.`);
        return { ...p, ...parseSiteStripe(p.siteStripe, file) };
    } catch (e) {
        if (e.code !== 'ENOENT') throw e;
        await fs.copyFile(path.join('data', 'products', '_example.json'), file);
        fail(
            `No product data for ${asin}. A template was created at ${file}.\n` +
            'Fill in title, features and (optionally) the SiteStripe Image snippet, then run the command again.',
        );
    }
}

async function writeReview(p, asin, affiliateUrl) {
    const { apiKey, baseURL } = PROVIDERS[PROVIDER];
    const client = new OpenAI({ apiKey, baseURL });
    const completion = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.6,
        response_format: { type: 'json_object' },
        messages: [
            {
                role: 'system',
                content:
                    'You are an experienced US affiliate product reviewer and conversion copywriter. Write in American English, helpful and honest. ' +
                    'Use ONLY the facts supplied. Never invent specifications, prices, ratings, awards, or claim hands-on testing. ' +
                    'Do not make medical or guaranteed-result claims. Do not include links, a title (H1), or any affiliate disclosure. ' +
                    'Pick ONE primary angle for the page: "time" (saves time), "convenience" (fewer steps / easier), or "incident" (avoids a real-life mess, waste, failure, or headache). ' +
                    'Return JSON with keys: ' +
                    '"title" (SEO title, max 60 chars, includes the product name), ' +
                    '"description" (meta description, max 155 chars), ' +
                    '"angle" (one of: time, convenience, incident), ' +
                    '"hook" (max 90 chars: a real-life situation headline the product helps with; concrete everyday scene; no product name required), ' +
                    '"hookSupport" (1-2 sentences, max 220 chars: connect that situation to how this product helps, using only supplied facts), ' +
                    '"whyHelps" (array of 3-4 short sentences: each one explains a concrete real-life benefit tied to the chosen angle, using only supplied facts; write like advice to a busy shopper, not a feature list dump), ' +
                    '"ctaLabel" (short Amazon button label, e.g. "Check Price on Amazon"), ' +
                    '"body" (Markdown, 900-1300 words, H2/H3 in this order: Quick Verdict, Key Features, Who It\'s For, Pros, Things to Consider, FAQ (3-4 questions), Final Verdict). ' +
                    'Do NOT include a Where to Buy section—the template owns the CTAs.',
            },
            {
                role: 'user',
                content: JSON.stringify({ product: p.title, brand: p.brand, category: p.category, features: p.features }),
            },
        ],
    });
    const out = JSON.parse(completion.choices[0].message.content);
    if (!out.title || !out.description || !out.body || !out.hook || !out.hookSupport || !out.angle || !Array.isArray(out.whyHelps)) {
        fail('The model returned an incomplete response. Try again.');
    }
    if (!['time', 'convenience', 'incident'].includes(out.angle)) {
        fail(`Invalid angle "${out.angle}". Expected time, convenience, or incident.`);
    }
    out.whyHelps = out.whyHelps.map((s) => String(s || '').trim()).filter(Boolean).slice(0, 4);
    if (out.whyHelps.length < 2) fail('whyHelps needs at least 2 real-life points.');
    return out;
}

const url = await resolveUrl(inputUrl);
const asin = extractAsin(url);
const affiliateUrl = `https://www.amazon.com/dp/${asin}?tag=${encodeURIComponent(TAG)}`;
const product = await loadProduct(asin);

const outDir = path.join('src', 'content', 'reviews');
const existing = (await fs.readdir(outDir)).find((f) => f.endsWith(`-${asin.toLowerCase()}.md`));
if (existing && !force) fail(`Review already exists (${existing}). Use --force to overwrite.`);

console.log(`Generating review for ${asin} with ${MODEL}...`);
const review = await writeReview(product, asin, affiliateUrl);

const body = review.body.trim() + '\n';

const frontmatter = [
    '---',
    `title: ${JSON.stringify(review.title)}`,
    `description: ${JSON.stringify(review.description)}`,
    `asin: ${JSON.stringify(asin)}`,
    product.brand ? `brand: ${JSON.stringify(product.brand)}` : null,
    product.category ? `category: ${JSON.stringify(product.category)}` : null,
    `affiliateUrl: ${JSON.stringify(affiliateUrl)}`,
    product.imageHtml ? `imageHtml: ${JSON.stringify(product.imageHtml)}` : null,
    product.imageSrc ? `imageSrc: ${JSON.stringify(product.imageSrc)}` : null,
    `hook: ${JSON.stringify(review.hook)}`,
    `hookSupport: ${JSON.stringify(review.hookSupport)}`,
    `whyHelps: ${JSON.stringify(review.whyHelps)}`,
    `angle: ${JSON.stringify(review.angle)}`,
    `ctaLabel: ${JSON.stringify(review.ctaLabel || 'Check Price on Amazon')}`,
    `features: ${JSON.stringify(product.features)}`,
    `pubDate: ${new Date().toISOString().slice(0, 10)}`,
    '---',
    '',
]
    .filter((l) => l !== null)
    .join('\n');

const fileName = existing ?? `${slugify(review.title)}-${asin.toLowerCase()}.md`;
await fs.writeFile(path.join(outDir, fileName), frontmatter + '\n' + body);
console.log(`Created src/content/reviews/${fileName}`);
