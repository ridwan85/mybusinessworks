/**
 * Which product images this repo is allowed to use.
 * Required: do not re-host Amazon packshots (source.jpg or a file downloaded from Amazon).
 * Amazon-hosted SiteStripe / API URLs stay on Amazon's servers.
 * Optional: lifestyle creatives already in this repo may still be referenced.
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

/** Downloaded Amazon packshot. Never publish or render this filename. */
export function isRehostedAmazonPhoto(value) {
    const raw = String(value || '').trim().split(/[?#]/)[0];
    return /\/source\.(jpe?g|png|webp)$/i.test(raw);
}

/** On-site creative that is not an Amazon packshot copy. */
export function isLocalLifestyleImage(value) {
    const raw = String(value || '').trim().split(/[?#]/)[0];
    if (!raw || isRehostedAmazonPhoto(raw)) return false;
    return /^\/images\/reviews\/[a-z0-9]+\/[a-z0-9][a-z0-9-]*\.(jpe?g|png|webp)$/i.test(raw);
}

export function isAllowedProductImage(value) {
    if (isRehostedAmazonPhoto(value)) return false;
    return isAmazonHostedImageUrl(value) || isOwnerPhotoPath(value) || isLocalLifestyleImage(value);
}
