/**
 * Product photos allowed on the public site.
 * Required: do not re-host Amazon packshots (source.jpg or a downloaded CDN file).
 * Amazon-hosted SiteStripe / API URLs stay on Amazon's servers.
 * Optional: lifestyle creatives already in this repo (not Amazon downloads) may still be shown.
 * own.jpg is a photo the owner took.
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

/** Downloaded Amazon packshot. Never publish or render this filename. */
export function isRehostedAmazonPhoto(value?: string): boolean {
    const raw = String(value || '').trim().split(/[?#]/)[0];
    return /\/source\.(jpe?g|png|webp)$/i.test(raw);
}

/** On-site creative that is not an Amazon packshot copy. */
export function isLocalLifestyleImage(value?: string): boolean {
    const raw = String(value || '').trim().split(/[?#]/)[0];
    if (!raw || isRehostedAmazonPhoto(raw)) return false;
    return /^\/images\/reviews\/[a-z0-9]+\/[a-z0-9][a-z0-9-]*\.(jpe?g|png|webp)$/i.test(raw);
}

export function allowedProductImage(value?: string): string | undefined {
    if (isRehostedAmazonPhoto(value)) return undefined;
    if (isAmazonHostedImageUrl(value) || isOwnerPhotoPath(value) || isLocalLifestyleImage(value)) return value;
    return undefined;
}

type ImageFields = {
    siteStripeImage?: string;
    ownImage?: string;
    imageSrc?: string;
};

/** Hero image: SiteStripe URL, then the owner's photo, then an on-site lifestyle creative. Amazon packshots are dropped. */
export function displayImage(data?: ImageFields): string | undefined {
    if (!data) return undefined;
    return (
        allowedProductImage(data.siteStripeImage) ||
        allowedProductImage(data.ownImage) ||
        allowedProductImage(data.imageSrc)
    );
}

/**
 * First image safe to share on Pinterest and other crawlers.
 * Amazon-hosted URLs are skipped — Rich Pins must not depend on them.
 */
export function shareImage(...candidates: (string | undefined)[]): string | undefined {
    for (const candidate of candidates) {
        const allowed = allowedProductImage(candidate);
        if (allowed && !isAmazonHostedImageUrl(allowed)) return allowed;
    }
    return undefined;
}

/** SiteStripe "Image" snippet: Amazon-hosted <a>/<img> only. */
export function isSafeSiteStripeHtml(html?: string): boolean {
    if (!html?.trim()) return false;
    if (/<script|\son\w+\s*=|javascript:|data:/i.test(html)) return false;
    if (/<(?!\/?(?:a|img)\b)[a-z]/i.test(html)) return false;
    const src = html.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i)?.[1];
    return isAmazonHostedImageUrl(src);
}
