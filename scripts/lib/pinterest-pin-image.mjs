/**
 * Pinterest Pin image, 1000×1500 (2:3).
 *
 * Default: a text graphic (headline, benefit lines, brand colors). No product photo.
 * Optional: the owner's own photo at public/images/reviews/<asin>/own.jpg (--own-photo).
 * Gemini lifestyle scenes are off. They only run with PIN_ALLOW_AI_SCENE=1 and --ai-scene,
 * and only from that own photo. Re-hosted Amazon product photos are never accepted.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
    PIN_FILENAME,
    PIN_HEIGHT,
    PIN_WIDTH,
    PIN_ASPECT,
    fail,
    pinImageLocalPath,
    reviewImageDir,
} from './pinterest.mjs';

const OWN_PHOTO_NAMES = ['own.jpg', 'own.jpeg', 'own.png', 'own.webp'];

async function loadSharp() {
    try {
        const mod = await import('sharp');
        return mod.default;
    } catch (error) {
        fail(
            'Pin graphics need the sharp package (it is not part of the site build).\n' +
                'Install it once in this project: npm install sharp\n' +
                `Details: ${error.message}`,
        );
    }
}

const INK = '#1c171a';
const MUTED = '#6d6168';
const ACCENT = '#b56b78';
const BLUSH = '#f3e4e8';
const PAPER = '#fcfafb';
const BRAND = '#1a1417';

function escapeXml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function fontFile(query) {
    try {
        const file = execFileSync('fc-match', ['-f', '%{file}', query], { encoding: 'utf8' }).trim();
        if (file && file !== 'undefined') return file;
    } catch {
        /* fontconfig is optional; SVG still names generic families */
    }
    return null;
}

function fontFaceCss() {
    const serif = fontFile('Liberation Serif:style=Bold') || fontFile('serif:style=Bold');
    const sans = fontFile('Liberation Sans:style=Regular') || fontFile('sans:style=Regular');
    const sansBold = fontFile('Liberation Sans:style=Bold') || fontFile('sans:style=Bold');
    const faces = [];
    if (serif) faces.push(`@font-face { font-family: 'Pin Serif'; src: url('${serif}'); font-weight: 700; }`);
    if (sans) faces.push(`@font-face { font-family: 'Pin Sans'; src: url('${sans}'); font-weight: 400; }`);
    if (sansBold) faces.push(`@font-face { font-family: 'Pin Sans'; src: url('${sansBold}'); font-weight: 700; }`);
    return faces.join('\n');
}

function ellipsize(line, maxChars) {
    const text = String(line || '').trim();
    if (text.length <= maxChars) return text;
    return `${text.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

/** Word-wrap. Extra words collapse onto the last line with an ellipsis. */
function wrapText(text, maxChars, maxLines) {
    const words = String(text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean);
    if (!words.length || maxLines < 1) return [];
    const lines = [];
    let current = '';
    for (let i = 0; i < words.length; i += 1) {
        const word = words[i];
        const next = current ? `${current} ${word}` : word;
        if (next.length > maxChars && current) {
            lines.push(current);
            current = word;
            if (lines.length === maxLines) {
                const rest = [current, ...words.slice(i + 1)].join(' ');
                lines[maxLines - 1] = ellipsize(`${lines[maxLines - 1]} ${rest}`, maxChars);
                return lines;
            }
        } else {
            current = next;
        }
    }
    if (current) {
        if (lines.length === maxLines) lines[maxLines - 1] = ellipsize(`${lines[maxLines - 1]} ${current}`, maxChars);
        else lines.push(current);
    }
    return lines.slice(0, maxLines);
}

export function checklistLines(review) {
    const fromList = Array.isArray(review?.whyHelps) ? review.whyHelps : [];
    const lines = fromList.map((line) => String(line || '').trim()).filter(Boolean).slice(0, 4);
    if (lines.length) return lines;
    const support = String(review?.hookSupport || '').trim();
    return support ? [support] : [];
}

function kickerFor(review) {
    if (review?.angle === 'time') return 'Saves time';
    if (review?.angle === 'incident') return 'Avoids a headache';
    if (review?.angle === 'convenience') return 'Everyday convenience';
    return 'Daily Viral Deals';
}

function textSvg({ hook, lines, kicker, photoBand }) {
    const serif = "Pin Serif, 'Liberation Serif', Georgia, 'Times New Roman', serif";
    const sans = "Pin Sans, 'Liberation Sans', Inter, Helvetica, Arial, sans-serif";
    const hookSize = hook.length > 90 ? 52 : hook.length > 60 ? 60 : 68;
    const hookChars = hookSize >= 68 ? 20 : hookSize >= 60 ? 24 : 28;
    const hookLines = wrapText(hook, hookChars, photoBand ? 4 : 6);
    const parts = [];
    parts.push(`<rect width="${PIN_WIDTH}" height="${PIN_HEIGHT}" fill="${BLUSH}"/>`);
    parts.push(`<rect x="0" y="0" width="${PIN_WIDTH}" height="18" fill="${ACCENT}"/>`);

    let y = 120;
    if (photoBand) {
        parts.push(`<rect x="48" y="48" width="904" height="700" rx="28" fill="${PAPER}"/>`);
        y = 820;
    }

    parts.push(
        `<text x="72" y="${y}" fill="${ACCENT}" font-family="${sans}" font-size="28" font-weight="700" letter-spacing="3">${escapeXml(
            kicker.toUpperCase(),
        )}</text>`,
    );
    y += photoBand ? 64 : 78;

    const hookLeading = Math.round(hookSize * 1.15);
    for (const line of hookLines) {
        parts.push(
            `<text x="72" y="${y}" fill="${INK}" font-family="${serif}" font-size="${hookSize}" font-weight="700">${escapeXml(line)}</text>`,
        );
        y += hookLeading;
    }

    y += 18;
    parts.push(`<rect x="72" y="${y}" width="120" height="8" rx="4" fill="${ACCENT}"/>`);
    y += 48;

    const bottomLimit = PIN_HEIGHT - 120;
    for (const item of lines) {
        const wrapped = wrapText(item, 42, 3);
        const blockHeight = wrapped.length * 40 + 18;
        if (y + blockHeight > bottomLimit) break;
        parts.push(`<rect x="76" y="${y - 22}" width="16" height="16" rx="4" fill="${ACCENT}"/>`);
        for (const line of wrapped) {
            parts.push(
                `<text x="108" y="${y}" fill="${MUTED}" font-family="${sans}" font-size="30" font-weight="400">${escapeXml(line)}</text>`,
            );
            y += 40;
        }
        y += 18;
    }

    parts.push(`<rect x="0" y="${PIN_HEIGHT - 72}" width="${PIN_WIDTH}" height="72" fill="${BRAND}"/>`);
    parts.push(
        `<text x="72" y="${PIN_HEIGHT - 28}" fill="${PAPER}" font-family="${sans}" font-size="26" font-weight="700">Daily Viral Deals</text>`,
    );

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_WIDTH}" height="${PIN_HEIGHT}" viewBox="0 0 ${PIN_WIDTH} ${PIN_HEIGHT}">
  <style>${fontFaceCss()}</style>
  ${parts.join('\n  ')}
</svg>`;
}

/**
 * Write a 1000×1500 JPEG graphic.
 * ownPhotoPath, when set, is placed in the top band. It is not sent to an image model.
 */
export async function renderGraphicPin({ hook, lines = [], kicker = 'Daily Viral Deals', destPath, ownPhotoPath = null }) {
    const headline = String(hook || '').trim();
    if (!headline) fail('Cannot render a Pin image without a headline.');
    await fs.mkdir(path.dirname(destPath), { recursive: true });

    const sharp = await loadSharp();
    const svg = textSvg({
        hook: headline,
        lines: lines.map((line) => String(line || '').trim()).filter(Boolean).slice(0, 4),
        kicker,
        photoBand: Boolean(ownPhotoPath),
    });

    let image = sharp(Buffer.from(svg)).resize(PIN_WIDTH, PIN_HEIGHT, { fit: 'fill' });
    if (ownPhotoPath) {
        const photo = await sharp(ownPhotoPath)
            .resize(904, 700, { fit: 'cover', position: 'centre' })
            .jpeg({ quality: 90 })
            .toBuffer();
        const base = await image.png().toBuffer();
        image = sharp(base).composite([{ input: photo, left: 48, top: 48 }]);
    }

    await image.jpeg({ quality: 90 }).toFile(destPath);
    const meta = await sharp(destPath).metadata();
    if (meta.width !== PIN_WIDTH || meta.height !== PIN_HEIGHT) {
        fail(`Pin image rendered at ${meta.width}×${meta.height}, expected ${PIN_WIDTH}×${PIN_HEIGHT}.`);
    }
    return destPath;
}

export async function findOwnPhotoPath(review) {
    const dir = reviewImageDir(review);
    for (const name of OWN_PHOTO_NAMES) {
        const candidate = path.join(dir, name);
        try {
            await fs.access(candidate);
            return candidate;
        } catch {
            /* try the next filename */
        }
    }
    return null;
}

async function requireOwnPhoto(review) {
    const found = await findOwnPhotoPath(review);
    if (found) return found;
    const expected = path.join(reviewImageDir(review), 'own.jpg');
    fail(
        `No owner photo at ${expected}.\n` +
            'Save a photo you took (not an Amazon product image) as own.jpg, then rerun with --own-photo.\n' +
            'Re-hosted Amazon photos are not used for pins.',
    );
}

/**
 * Gemini edit of the owner's own photo. Off unless PIN_ALLOW_AI_SCENE=1.
 * Refuses anything except own.jpg / own.jpeg / own.png / own.webp.
 */
async function generateAiSceneFromOwnPhoto(review) {
    if (process.env.PIN_ALLOW_AI_SCENE !== '1') {
        fail(
            'AI product scenes are disabled.\n' +
                'Default pins are text graphics (headline, benefits, brand colors).\n' +
                'To place your own photo on the graphic: npm run pinterest:draft -- <slug> --own-photo\n' +
                'Gemini edits stay off unless PIN_ALLOW_AI_SCENE=1 and the only input is own.jpg.',
        );
    }

    const sourcePath = await requireOwnPhoto(review);
    const base = path.basename(sourcePath).toLowerCase();
    if (!OWN_PHOTO_NAMES.includes(base)) {
        fail(`Refusing ${sourcePath}. AI scenes can only start from your own photo (own.jpg).`);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) fail('GEMINI_API_KEY is missing in .env.');
    const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
    const imageBytes = await fs.readFile(sourcePath);
    const outPath = pinImageLocalPath(review);
    await fs.mkdir(path.dirname(outPath), { recursive: true });

    const hook = String(review.hook || '').trim();
    const prompt = [
        `Create a vertical Pinterest Pin image at exactly ${PIN_WIDTH}x${PIN_HEIGHT} pixels (${PIN_ASPECT} aspect ratio).`,
        'Use the attached photo, which the publisher took themselves. Keep it realistic.',
        'Do not invent a different product, and do not imitate an Amazon listing photo.',
        `OVERLAY this exact hook as large, bold, highly readable text: "${hook}"`,
        'Place the hook in the upper-middle safe area. High contrast text.',
        'Do not add logos, watermarks, URLs, prices, or extra slogans.',
    ].join(' ');

    const body = {
        contents: [
            {
                role: 'user',
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: base.endsWith('.png') ? 'image/png' : base.endsWith('.webp') ? 'image/webp' : 'image/jpeg',
                            data: imageBytes.toString('base64'),
                        },
                    },
                ],
            },
        ],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    };

    await fs.mkdir('tmp', { recursive: true });
    const reqPath = path.join('tmp', `pinterest-pin-req-${review.asin || review.slug}.json`);
    const resPath = path.join('tmp', `pinterest-pin-res-${review.asin || review.slug}.json`);
    await fs.writeFile(reqPath, JSON.stringify(body));
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    console.log(`Generating an AI scene from the owner photo only (${model})…`);

    const curl = spawnSync(
        'curl',
        ['-sS', '--max-time', '180', '-H', 'Content-Type: application/json', '-d', `@${reqPath}`, endpoint, '-o', resPath, '-w', '%{http_code}'],
        { encoding: 'utf8' },
    );
    await fs.unlink(reqPath).catch(() => {});
    if (curl.error) fail(`Pin image request failed: ${curl.error.message}`);

    const httpCode = curl.stdout.trim();
    let json;
    try {
        json = JSON.parse(await fs.readFile(resPath, 'utf8'));
    } catch {
        fail(`Pin image response was not JSON (HTTP ${httpCode}).`);
    }
    await fs.unlink(resPath).catch(() => {});
    if (httpCode !== '200' || json.error) {
        fail(`Pin image generation failed (HTTP ${httpCode}): ${json.error?.message || JSON.stringify(json).slice(0, 800)}`);
    }

    const parts = json.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
        const inline = part.inlineData || part.inline_data;
        if (!inline?.data) continue;
        const buf = Buffer.from(inline.data, 'base64');
        const dest = outPath.endsWith('.jpg') ? outPath : path.join(path.dirname(outPath), PIN_FILENAME);
        const sharp = await loadSharp();
        await sharp(buf).resize(PIN_WIDTH, PIN_HEIGHT, { fit: 'cover' }).jpeg({ quality: 90 }).toFile(dest);
        console.log(`Saved Pin image → ${dest}`);
        return dest;
    }
    fail('Pin image model returned no image data.');
}

/**
 * @param {'template'|'own'|'ai-scene'} [mode]
 * template: text graphic, no photo (default)
 * own: text graphic plus public/images/reviews/<asin>/own.jpg
 * ai-scene: Gemini, own photo only, requires PIN_ALLOW_AI_SCENE=1
 */
export async function generatePinterestPinImage(review, { mode = 'template' } = {}) {
    if (mode === 'ai-scene') return generateAiSceneFromOwnPhoto(review);

    const ownPhotoPath = mode === 'own' ? await requireOwnPhoto(review) : null;
    const destPath = pinImageLocalPath(review);
    console.log(
        ownPhotoPath
            ? `Rendering Pin graphic with owner photo (${PIN_WIDTH}×${PIN_HEIGHT})…`
            : `Rendering text Pin graphic (${PIN_WIDTH}×${PIN_HEIGHT}, no product photo)…`,
    );
    console.log(`Hook on image: "${review.hook}"`);
    await renderGraphicPin({
        hook: review.hook,
        lines: checklistLines(review),
        kicker: kickerFor(review),
        destPath,
        ownPhotoPath,
    });
    console.log(`Saved Pin image → ${destPath}`);
    return destPath;
}
