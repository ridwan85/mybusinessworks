/**
 * Product catalog metadata helpers.
 * `createdAt` is stamped once when we first process a product link into data/products/.
 * Never overwrite an existing createdAt (homepage “latest” depends on it).
 */
import fs from 'node:fs/promises';

export function nowCreatedAt() {
    return new Date().toISOString();
}

/** Mutates product: sets createdAt only if missing. Returns true when stamped. */
export function stampCreatedAt(product, when = nowCreatedAt()) {
    if (product?.createdAt) return false;
    product.createdAt = when;
    return true;
}

export async function readProductJson(file) {
    return JSON.parse(await fs.readFile(file, 'utf8'));
}

/**
 * Write product JSON.
 * Merges over an existing file (keeps imageUrl/showcases/etc.).
 * Preserves an existing createdAt forever — first process wins.
 */
export async function writeProductJson(file, product) {
    let existing = null;
    try {
        existing = await readProductJson(file);
    } catch (e) {
        if (e.code !== 'ENOENT') throw e;
    }

    const next = existing ? { ...existing, ...product } : { ...product };
    if (existing?.createdAt) {
        next.createdAt = existing.createdAt;
    } else {
        stampCreatedAt(next);
    }

    await fs.writeFile(file, `${JSON.stringify(next, null, 2)}\n`);
    return next;
}
