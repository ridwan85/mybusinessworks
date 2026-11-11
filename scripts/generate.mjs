// Usage: npm run generate -- "<amazon-product-url>" [--force]
import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';

const TAG = process.env.AMAZON_ASSOCIATE_TAG;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
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
if (!process.env.OPENAI_API_KEY) fail('OPENAI_API_KEY is missing in .env');

const isAmazonHost = (h) => /(^|\.)amazon\.com$/i.test(h);
const isShortHost = (h) => /^(amzn\.to|a\.co|amzn\.com)$/i.test(h);

async function resolveUrl(raw) {
    let url;
    try {
        url = new URL(raw);
    } catch {
        fail('Invalid URL.');
    }
    if (url.protocol !== 'https:') fail('URL must use https.');
    if (isShortHost(url.hostname)) {
        const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
        url = new URL(res.url);
    }
    if (!isAmazonHost(url.hostname)) fail('Only amazon.com (US store) links are supported.');
    return url;
}

function extractAsin(url) {
    const m = url.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d|product)\/([A-Z0-9]{10})/i);
    if (!m) fail('Could not find a 10-character ASIN in the URL.');
    return m[1].toUpperCase();
}

const slugify = (s) =>
    s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60)
        .replace(/-+$/, '');

async function loadProduct(asin) {
    const file = path.join('data', 'products', `${asin}.json`);
    try {
        const p = JSON.parse(await fs.readFile(file, 'utf8'));
        if (!p.title?.trim()) fail(`${file}: "title" is empty.`);
        if (!Array.isArray(p.features) || !p.features.length) fail(`${file}: "features" must be a non-empty array.`);
        if (!Array.isArray(p.images) || !p.images.length || !p.images.every((i) => /^https:\/\//.test(i)))
            fail(`${file}: "images" must be a non-empty array of https URLs.`);
        return p;
    } catch (e) {
        if (e.code !== 'ENOENT') throw e;
        await fs.copyFile(path.join('data', 'products', '_example.json'), file);
        fail(
            `No product data for ${asin}. A template was created at ${file}.\n` +
            'Fill in title, features and image URLs (from the Amazon page / SiteStripe), then run the command again.',
        );
    }
}

async function writeReview(p, asin, affiliateUrl) {
    const client = new OpenAI();
    const completion = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.6,
        response_format: { type: 'json_object' },
        messages: [
            {
                role: 'system',
                content:
                    'You are an experienced US affiliate product reviewer and SEO writer. Write in American English, in a helpful, honest, conversational tone. ' +
                    'Use ONLY the facts supplied. Never invent specifications, prices, ratings, awards, or claim hands-on testing. ' +
                    'Do not make medical or guaranteed-result claims. Do not include links, a title (H1), or any affiliate disclosure. ' +
                    'Return JSON with keys: "title" (SEO title, max 60 chars, includes the product name), "description" (meta description, max 155 chars), ' +
                    '"body" (Markdown, 900-1300 words, using H2/H3 headings in this order: Quick Verdict, Key Features, Who It\'s For, Pros, Things to Consider, FAQ (3-4 questions), Final Verdict).',
            },
            {
                role: 'user',
                content: JSON.stringify({ product: p.title, brand: p.brand, category: p.category, features: p.features }),
            },
        ],
    });
    const out = JSON.parse(completion.choices[0].message.content);
    if (!out.title || !out.description || !out.body) fail('The model returned an incomplete response. Try again.');
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

const body = [
    `> **Disclosure:** ${DISCLOSURE} This post contains affiliate links at no extra cost to you.`,
    '',
    review.body.trim(),
    '',
    '## Where to Buy',
    '',
    `[Check the current price and availability on Amazon](${affiliateUrl})`,
    '',
    '---',
    '',
    `*${DISCLOSURE}*`,
    '',
].join('\n');

const frontmatter = [
    '---',
    `title: ${JSON.stringify(review.title)}`,
    `description: ${JSON.stringify(review.description)}`,
    `asin: ${JSON.stringify(asin)}`,
    product.brand ? `brand: ${JSON.stringify(product.brand)}` : null,
    product.category ? `category: ${JSON.stringify(product.category)}` : null,
    `affiliateUrl: ${JSON.stringify(affiliateUrl)}`,
    `images: ${JSON.stringify(product.images)}`,
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
