/**
 * Generate a Pinterest-native Pin image:
 * - 1000×1500 (2:3) — Pinterest recommended standard Pin size
 * - Hook text rendered on the image (large, readable)
 * - Product kept recognizable from a local reference photo
 */
import { spawnSync } from 'node:child_process';
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

/** Force exact Pinterest recommended pixel size when `sips` is available (macOS). */
function enforcePinDimensions(filePath) {
    const probe = spawnSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', filePath], { encoding: 'utf8' });
    if (probe.status !== 0) return;
    const resize = spawnSync('sips', ['-z', String(PIN_HEIGHT), String(PIN_WIDTH), filePath], { encoding: 'utf8' });
    if (resize.status === 0) {
        console.log(`Normalized Pin image to ${PIN_WIDTH}×${PIN_HEIGHT}`);
    }
}

function resolveSourceImagePath(review) {
    const src = String(review.imageSrc || '').trim();
    if (src.startsWith('/images/')) {
        return path.join('public', src.replace(/^\//, ''));
    }
    const dir = reviewImageDir(review);
    return path.join(dir, 'source.jpg');
}

export function buildPinImagePrompt(review) {
    const hook = String(review.hook || '').trim();
    const angle = review.angle || 'convenience';
    const angleCue =
        angle === 'time'
            ? 'Emphasize saving time / fewer steps.'
            : angle === 'incident'
              ? 'Emphasize avoiding a real-life mess or headache (still calm, not panic porn).'
              : 'Emphasize everyday convenience — calm, effortless use.';

    return [
        `Create a vertical Pinterest Pin image at exactly ${PIN_WIDTH}x${PIN_HEIGHT} pixels (${PIN_ASPECT} aspect ratio).`,
        'Use the attached product photo as reference — keep the product realistic and recognizable.',
        'Lifestyle scene that matches an Amazon affiliate product review, polished commercial look, soft natural light.',
        angleCue,
        `OVERLAY this exact hook as large, bold, highly readable text on the image (not a tiny caption):`,
        `"${hook}"`,
        'Place the hook text in the upper-middle safe area so it stays readable on mobile.',
        'High contrast text (white or dark with a subtle solid/soft backdrop behind the words if needed).',
        'Do not add logos, watermarks, URLs, prices, or extra slogans beyond the hook.',
        'No collage borders; one clean vertical Pin composition.',
    ].join(' ');
}

/**
 * Calls Gemini image model via curl (Node fetch often misses proxy/DNS here).
 * Writes public/images/reviews/<asin>/pinterest-pin.jpg
 */
export async function generatePinterestPinImage(review) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) fail('GEMINI_API_KEY is missing in .env (needed to generate Pinterest Pin images).');

    const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
    const sourcePath = resolveSourceImagePath(review);
    let imageBytes;
    try {
        imageBytes = await fs.readFile(sourcePath);
    } catch {
        fail(
            `No local source image for Pin generation at ${sourcePath}.\n` +
                'Save the review lifestyle/source photo there first (or set imageSrc under /images/reviews/...).',
        );
    }

    const outPath = pinImageLocalPath(review);
    await fs.mkdir(path.dirname(outPath), { recursive: true });

    const prompt = buildPinImagePrompt(review);
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

    await fs.mkdir('tmp', { recursive: true });
    const reqPath = path.join('tmp', `pinterest-pin-req-${review.asin || review.slug}.json`);
    const resPath = path.join('tmp', `pinterest-pin-res-${review.asin || review.slug}.json`);
    await fs.writeFile(reqPath, JSON.stringify(body));

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    console.log(`Generating Pinterest Pin image (${PIN_WIDTH}×${PIN_HEIGHT}, ${PIN_ASPECT}) with ${model}…`);
    console.log(`Hook on image: "${review.hook}"`);

    const curl = spawnSync(
        'curl',
        [
            '-sS',
            '--max-time',
            '180',
            '-H',
            'Content-Type: application/json',
            '-d',
            `@${reqPath}`,
            endpoint,
            '-o',
            resPath,
            '-w',
            '%{http_code}',
        ],
        { encoding: 'utf8' },
    );
    await fs.unlink(reqPath).catch(() => {});

    if (curl.error) {
        fail(`Pin image request failed: ${curl.error.message}`);
    }

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
        if (part.text) console.log('Model note:', part.text.slice(0, 240));
        const inline = part.inlineData || part.inline_data;
        if (inline?.data) {
            const mime = inline.mimeType || inline.mime_type || 'image/jpeg';
            const buf = Buffer.from(inline.data, 'base64');
            // Always save as pinterest-pin.jpg for a stable public URL.
            const dest = outPath.endsWith('.jpg') ? outPath : path.join(path.dirname(outPath), PIN_FILENAME);
            await fs.writeFile(dest, buf);
            enforcePinDimensions(dest);
            console.log(`Saved Pin image → ${dest} (${buf.length} bytes, mime ${mime})`);
            return dest;
        }
    }

    fail('Pin image model returned no image data.');
}
