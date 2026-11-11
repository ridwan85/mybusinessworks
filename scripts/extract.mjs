// Usage: npm run extract -- <ASIN-or-amazon-product-url> <file>
// <file> is a page you saved yourself (browser "Save Page As" HTML, or pasted text). Gemini structures it into data/products/<ASIN>.json.
import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import { writeProductJson } from './lib/product-meta.mjs';

const env = process.env;
const args = process.argv.slice(2);
const [idArg, file] = args.filter((a) => !a.startsWith('--'));

function fail(msg) {
    console.error(`\nError: ${msg}\n`);
    process.exit(1);
}

const asin = (idArg?.match(/^[A-Z0-9]{10}$/i) ?? idArg?.match(/\/(?:dp|gp\/product|product)\/([A-Z0-9]{10})/i))?.slice(-1)[0]?.toUpperCase();
if (!asin || !file) fail('Usage: npm run extract -- <ASIN or amazon.com/dp/... URL> <saved-page.html|.txt>');

const P = env.GEMINI_API_KEY
    ? { apiKey: env.GEMINI_API_KEY, baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', model: env.GEMINI_MODEL || 'gemini-flash-latest' }
    : env.XAI_API_KEY
        ? { apiKey: env.XAI_API_KEY, baseURL: 'https://api.x.ai/v1', model: env.XAI_MODEL || 'grok-4' }
        : { apiKey: env.OPENAI_API_KEY, baseURL: undefined, model: env.OPENAI_MODEL || 'gpt-4o-mini' };
if (!P.apiKey) fail('Set GEMINI_API_KEY (or another provider key) in .env');

const raw = await fs.readFile(file, 'utf8');

const text = raw
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 30000);

const client = new OpenAI({ apiKey: P.apiKey, baseURL: P.baseURL });
const res = await client.chat.completions.create({
    model: P.model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
        {
            role: 'system',
            content:
                'Extract product data from the page text. Return JSON with keys: "title" (string), "brand" (string), "category" (short string), ' +
                '"features" (array of the "About this item" bullet points, verbatim). Use only text present in the input; use "" or [] if missing.',
        },
        { role: 'user', content: text },
    ],
});
const data = JSON.parse(res.choices[0].message.content);
if (!data.title || !data.features?.length) fail('Could not find a title and feature bullets in that file. Save the full product page and try again.');

const out = path.join('data', 'products', `${asin}.json`);
const saved = await writeProductJson(out, {
    title: data.title,
    brand: data.brand,
    category: data.category,
    features: data.features,
});
console.log(
    `Wrote ${out} (${data.features.length} features, createdAt ${saved.createdAt}). ` +
        `Review it, then run: npm run generate -- "https://www.amazon.com/dp/${asin}"`,
);
