// One-off test: npm run test:image
// Reads imageUrl from data/products/<ASIN>.json, sends it to Gemini image model
// with a kitchen showcase prompt, writes tmp/showcase-<ASIN>.png|jpg
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    console.error('GEMINI_API_KEY missing in .env');
    process.exit(1);
}

const asin = process.argv[2] || 'B0HF4XHL1R';
const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const productPath = path.join('data', 'products', `${asin}.json`);
const product = JSON.parse(await fs.readFile(productPath, 'utf8'));
const imageUrl = product.imageUrl;
if (!imageUrl) {
    console.error(`${productPath} has no imageUrl`);
    process.exit(1);
}

await fs.mkdir('tmp', { recursive: true });
const sourcePath = path.join('tmp', `source-${asin}.jpg`);
let imageBytes;
try {
    imageBytes = await fs.readFile(sourcePath);
    console.log(`Using local source ${sourcePath} (${imageBytes.length} bytes)`);
} catch {
    // Prefer a previously saved file (Amazon CDN is often blocked from this env).
    const fallback = path.join('tmp', 'source-product.jpg');
    try {
        imageBytes = await fs.readFile(fallback);
        await fs.copyFile(fallback, sourcePath);
        console.log(`Using fallback source ${fallback}`);
    } catch {
        console.error(`No local source image. Expected ${sourcePath} (from imageUrl: ${imageUrl})`);
        process.exit(1);
    }
}

const prompt =
    process.argv.slice(3).join(' ').trim() ||
    'Show a product showcase for this image with a good kitchen background. ' +
        'Keep the product looking realistic and recognizable. Place it on a clean modern kitchen counter ' +
        'with soft natural light, subtle depth of field, and a polished commercial product-photo look. ' +
        'Do not add logos, watermarks, or text.';

const body = {
    contents: [
        {
            role: 'user',
            parts: [
                { text: prompt },
                {
                    inline_data: {
                        mime_type: 'image/jpeg',
                        data: imageBytes.toString('base64'),
                    },
                },
            ],
        },
    ],
    generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
    },
};

const reqPath = path.join('tmp', 'gemini-req.json');
const resPath = path.join('tmp', 'gemini-res.json');
await fs.writeFile(reqPath, JSON.stringify(body));

const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
console.log(`Calling ${model}...`);
console.log(`Prompt: ${prompt}`);

// Prefer curl: Node's built-in fetch does not honor HTTPS_PROXY in this environment.
const curl = spawnSync(
    'curl',
    ['-sS', '--max-time', '180', '-H', 'Content-Type: application/json', '-d', `@${reqPath}`, endpoint, '-o', resPath, '-w', '%{http_code}'],
    { encoding: 'utf8' },
);
if (curl.error) {
    console.error(curl.error);
    process.exit(1);
}
const httpCode = curl.stdout.trim();
const json = JSON.parse(await fs.readFile(resPath, 'utf8'));
await fs.unlink(reqPath).catch(() => {});

if (httpCode !== '200' || json.error) {
    console.error(`HTTP ${httpCode}`);
    console.error(json.error?.message || JSON.stringify(json, null, 2).slice(0, 2000));
    await fs.unlink(resPath).catch(() => {});
    process.exit(1);
}

const parts = json.candidates?.[0]?.content?.parts ?? [];
let saved = false;
for (const part of parts) {
    if (part.text) console.log('Model text:', part.text.slice(0, 400));
    const inline = part.inlineData || part.inline_data;
    if (inline?.data) {
        const mime = inline.mimeType || inline.mime_type || 'image/png';
        const ext = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : 'png';
        const out = path.join('tmp', `showcase-${asin}.${ext}`);
        await fs.writeFile(out, Buffer.from(inline.data, 'base64'));
        console.log(`Saved generated image → ${out}`);
        saved = true;
    }
}

await fs.unlink(resPath).catch(() => {});
if (!saved) {
    console.error('No image returned in the model response.');
    process.exit(1);
}
