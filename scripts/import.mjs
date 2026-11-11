// Usage: copy a product's data with the bookmarklet (tools/bookmarklet.html), then run: npm run import
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

function fail(msg) {
    console.error(`\nError: ${msg}\n`);
    process.exit(1);
}

let d;
try {
    d = JSON.parse(execFileSync('pbpaste', { encoding: 'utf8' }));
} catch {
    fail('The clipboard does not contain product JSON. Click the bookmarklet on an Amazon product page first.');
}

const isStr = (v) => typeof v === 'string';
if (!isStr(d?.asin) || !/^[A-Z0-9]{10}$/.test(d.asin)) fail('Clipboard data has no valid ASIN.');
if (!isStr(d.title) || !d.title.trim()) fail('Clipboard data has no title.');
if (!Array.isArray(d.features) || !d.features.every(isStr) || !d.features.length) fail('Clipboard data has no feature bullets.');

const out = path.join('data', 'products', `${d.asin}.json`);
const existing = await fs.readFile(out, 'utf8').then(JSON.parse, () => ({}));
const product = {
    ...existing,
    title: d.title.trim(),
    brand: isStr(d.brand) ? d.brand.trim() : '',
    category: isStr(d.category) ? d.category.trim() : '',
    features: d.features.map((f) => f.trim()).filter(Boolean),
};
await fs.writeFile(out, JSON.stringify(product, null, 2) + '\n');
console.log(`Wrote ${out} (${product.features.length} features).`);
console.log(`Next: npm run generate -- "https://www.amazon.com/dp/${d.asin}"`);
