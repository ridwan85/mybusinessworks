// Usage: npm run generate -- "<amazon-product-url>" [--force]
// Locked format: Hook → Why it helps → Details → Amazon CTA (see scripts/lib/review-format.mjs)
import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import {
    SYSTEM_PROMPT,
    DEFAULT_CTA,
    normalizeReviewOutput,
    buildImagesFrontmatter,
} from './lib/review-format.mjs';

const TAG = process.env.AMAZON_ASSOCIATE_TAG;
const env = process.env;
const PROVIDER = env.GEMINI_API_KEY ? 'gemini' : env.XAI_API_KEY ? 'grok' : 'openai';
const PROVIDERS = {
    gemini: { apiKey: env.GEMINI_API_KEY, baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', model: env.GEMINI_MODEL || 'gemini-flash-latest' },
    grok: { apiKey: env.XAI_API_KEY, baseURL: 'https://api.x.ai/v1', model: env.XAI_MODEL || 'grok-4' },
    openai: { apiKey: env.OPENAI_API_KEY, baseURL: undefined, model: env.OPENAI_MODEL || 'gpt-4o-mini' },
};
const MODEL = PROVIDERS[PROVIDER].model;

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

function collectShowcases(p) {
    const out = [];
    if (Array.isArray(p.showcases)) {
        for (const s of p.showcases) {
            const src = typeof s === 'string' ? s : s?.src;
            if (src) out.push(src);
        }
    }
    if (p.imageUrl && !out.includes(p.imageUrl)) out.push(p.imageUrl);
    return out;
}

async function loadProduct(asin) {
    const file = path.join('data', 'products', `${asin}.json`);
    try {
        const p = JSON.parse(await fs.readFile(file, 'utf8'));
        if (!p.title?.trim()) fail(`${file}: "title" is empty.`);
        if (!Array.isArray(p.features) || !p.features.length) fail(`${file}: "features" must be a non-empty array.`);
        const stripe = parseSiteStripe(p.siteStripe, file);
        const showcases = collectShowcases(p);
        return {
            ...p,
            ...stripe,
            imageSrc: stripe.imageSrc || p.imageSrc || showcases[0] || undefined,
            showcases,
        };
    } catch (e) {
        if (e.code !== 'ENOENT') throw e;
        await fs.copyFile(path.join('data', 'products', '_example.json'), file);
        fail(
            `No product data for ${asin}. A template was created at ${file}.\n` +
                'Fill in title, features and (optionally) imageUrl/showcases/SiteStripe, then run the command again.',
        );
    }
}

async function writeReview(p) {
    const { apiKey, baseURL } = PROVIDERS[PROVIDER];
    const client = new OpenAI({ apiKey, baseURL });
    const hasImages = Boolean(p.imageSrc || p.showcases?.length);
    const completion = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.6,
        response_format: { type: 'json_object' },
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'user',
                content: JSON.stringify({
                    format: 'Daily Viral Deals locked review format',
                    product: p.title,
                    brand: p.brand,
                    category: p.category,
                    features: p.features,
                    hasProductImages: hasImages,
                    imageCount: Math.max(p.showcases?.length || 0, p.imageSrc ? 1 : 0),
                }),
            },
        ],
    });

    let parsed;
    try {
        parsed = JSON.parse(completion.choices[0].message.content);
    } catch {
        fail('The model returned invalid JSON. Try again.');
    }

    try {
        return normalizeReviewOutput(parsed, { hasImages });
    } catch (e) {
        fail(`Locked format validation failed: ${e.message}. Try again.`);
    }
}

const url = await resolveUrl(inputUrl);
const asin = extractAsin(url);
const affiliateUrl = `https://www.amazon.com/dp/${asin}?tag=${encodeURIComponent(TAG)}`;
const product = await loadProduct(asin);

const outDir = path.join('src', 'content', 'reviews');
const existing = (await fs.readdir(outDir)).find((f) => f.endsWith(`-${asin.toLowerCase()}.md`));
if (existing && !force) fail(`Review already exists (${existing}). Use --force to overwrite.`);

console.log(`Generating locked-format review for ${asin} with ${MODEL}...`);
const review = await writeReview(product);
const { imagesLine, imageCaptionLine } = buildImagesFrontmatter({
    imageSrc: product.imageSrc,
    showcases: product.showcases,
    imageCaption: review.imageCaption,
    imageCaptions: review.imageCaptions,
});

const body = review.body + '\n';

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
    imageCaptionLine,
    imagesLine,
    `hook: ${JSON.stringify(review.hook)}`,
    `hookSupport: ${JSON.stringify(review.hookSupport)}`,
    `whyHelps: ${JSON.stringify(review.whyHelps)}`,
    `angle: ${JSON.stringify(review.angle)}`,
    `ctaLabel: ${JSON.stringify(review.ctaLabel || DEFAULT_CTA)}`,
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
console.log(`Format: Hook → Why it helps (${review.whyHelps.length} points) → Details → CTA [${review.angle}]`);
