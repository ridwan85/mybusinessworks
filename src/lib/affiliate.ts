/** Pull the Associate tag from a review's affiliate URL. Falls back to the site default. */
export function affiliateTag(affiliateUrl: string | undefined, fallback = 'dailyvirald06-20') {
    if (!affiliateUrl) return fallback;
    try {
        return new URL(affiliateUrl).searchParams.get('tag') || fallback;
    } catch {
        return fallback;
    }
}

/** Amazon links on a review use that post's tag, even if a compare URL was saved with another tag. */
export function withPostTag(href: string, affiliateUrl: string | undefined) {
    const tag = affiliateTag(affiliateUrl);
    try {
        const url = new URL(href);
        const host = url.hostname.toLowerCase();
        const amazon = host === 'amazon.com' || host.endsWith('.amazon.com') || host === 'amzn.to' || host.endsWith('.amzn.to');
        if (!amazon) return href;
        url.searchParams.set('tag', tag);
        return url.toString();
    } catch {
        return href;
    }
}
