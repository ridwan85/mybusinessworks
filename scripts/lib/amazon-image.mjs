/**
 * Which product images this repo is allowed to use.
 * Amazon Associates: product images only via SiteStripe or the Product Advertising API,
 * and the browser must load them from Amazon's servers. Do not download them into public/.
 * Keep the same host rules in src/lib/product-image.ts.
 */

export function isAmazonHostedImageUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return false;
    const normalized = raw.startsWith('//') ? `https:${raw}` : raw;
    let url;
    try {
        url = new URL(normalized);
    } catch {
        return false;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    return /(^|\.)((media-amazon|ssl-images-amazon|images-amazon)\.com|amazon-adsystem\.com)$/i.test(url.hostname);
}

/** Owner-supplied photo. Never an Amazon download. Example: /images/reviews/b00xxxx/own.jpg */
export function isOwnerPhotoPath(value) {
    const raw = String(value || '').trim().split(/[?#]/)[0];
    return /^\/images\/reviews\/[a-z0-9]+\/own\.(jpe?g|png|webp)$/i.test(raw);
}

export function isAllowedProductImage(value) {
    return isAmazonHostedImageUrl(value) || isOwnerPhotoPath(value);
}
