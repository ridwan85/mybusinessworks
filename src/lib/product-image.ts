/**
 * Product photos allowed on the public site.
 * Amazon-hosted URLs (SiteStripe or Product Advertising API) stay on Amazon's servers.
 * own.jpg is a photo the owner took. Local copies of Amazon images are not shown.
 * Keep the same host rules in scripts/lib/amazon-image.mjs.
 */

export function isAmazonHostedImageUrl(value?: string): boolean {
    const raw = String(value || '').trim();
    if (!raw) return false;
    const normalized = raw.startsWith('//') ? `https:${raw}` : raw;
    let url: URL;
    try {
        url = new URL(normalized);
    } catch {
        return false;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    return /(^|\.)((media-amazon|ssl-images-amazon|images-amazon)\.com|amazon-adsystem\.com)$/i.test(url.hostname);
}

export function isOwnerPhotoPath(value?: string): boolean {
    const raw = String(value || '').trim().split(/[?#]/)[0];
    return /^\/images\/reviews\/[a-z0-9]+\/own\.(jpe?g|png|webp)$/i.test(raw);
}

export function allowedProductImage(value?: string): string | undefined {
    if (isAmazonHostedImageUrl(value) || isOwnerPhotoPath(value)) return value;
    return undefined;
}

type ImageFields = {
    siteStripeImage?: string;
    ownImage?: string;
    imageSrc?: string;
};

/** Hero image for a review: SiteStripe URL, then the owner's photo. Local Amazon copies are dropped. */
export function displayImage(data?: ImageFields): string | undefined {
    if (!data) return undefined;
    return (
        allowedProductImage(data.siteStripeImage) ||
        allowedProductImage(data.ownImage) ||
        allowedProductImage(data.imageSrc)
    );
}

/** SiteStripe "Image" snippet: Amazon-hosted <a>/<img> only. */
export function isSafeSiteStripeHtml(html?: string): boolean {
    if (!html?.trim()) return false;
    if (/<script|\son\w+\s*=|javascript:|data:/i.test(html)) return false;
    if (/<(?!\/?(?:a|img)\b)[a-z]/i.test(html)) return false;
    const src = html.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i)?.[1];
    return isAmazonHostedImageUrl(src);
}
