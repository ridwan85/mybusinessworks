/**
 * Write a 640px-wide WebP next to each on-site JPEG/PNG.
 * Phones request this file through srcset. Pinterest pin files are left alone.
 */
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve('public/images');

async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push(...(await walk(full)));
        else files.push(full);
    }
    return files;
}

const sources = (await walk(root)).filter((file) => {
    if (/pinterest/i.test(path.basename(file))) return false;
    return /\.(jpe?g|png)$/i.test(file);
});

let wrote = 0;
for (const file of sources) {
    const out = file.replace(/\.(jpe?g|png)$/i, '.w640.webp');
    const srcStat = await stat(file);
    try {
        const outStat = await stat(out);
        if (outStat.mtimeMs >= srcStat.mtimeMs) continue;
    } catch {
        /* create it */
    }
    await sharp(file)
        .rotate()
        .resize({ width: 640, withoutEnlargement: true })
        .webp({ quality: 68 })
        .toFile(out);
    wrote += 1;
}

console.log(`webp: ${wrote} new, ${sources.length} sources`);
