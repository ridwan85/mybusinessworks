import fs from 'node:fs';
import path from 'node:path';

const cache = new Map<string, { width: number; height: number } | null>();

/** Width and height of a file in `public/`, for img width/height attributes. */
export function localImageSize(src: string | undefined): { width: number; height: number } | undefined {
    if (!src || !src.startsWith('/') || src.startsWith('//')) return undefined;
    const key = src.split('?')[0];
    if (cache.has(key)) return cache.get(key) || undefined;
    const file = path.join(process.cwd(), 'public', decodeURIComponent(key));
    let result: { width: number; height: number } | null = null;
    try {
        result = readSize(fs.readFileSync(file));
    } catch {
        result = null;
    }
    cache.set(key, result);
    return result || undefined;
}

function readSize(buf: Buffer): { width: number; height: number } | null {
    if (buf.length > 24 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') {
        return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (buf[0] === 0xff && buf[1] === 0xd8) {
        let i = 2;
        while (i < buf.length - 9) {
            if (buf[i] !== 0xff) {
                i += 1;
                continue;
            }
            const marker = buf[i + 1];
            if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
                return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
            }
            if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
                i += 2;
                continue;
            }
            const seg = buf.readUInt16BE(i + 2);
            if (seg < 2) return null;
            i += 2 + seg;
        }
    }
    return null;
}
