import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Amazon product links open in the same window. In-app browsers (Pinterest,
// etc.) have no tab UI, and target=_blank plus Amazon's app handoff freezes the CTA.
function isSameWindowStoreLink(href) {
    try {
        const host = new URL(href).hostname.toLowerCase();
        return host === 'amazon.com' || host.endsWith('.amazon.com') || host === 'amzn.to' || host.endsWith('.amzn.to');
    } catch {
        return false;
    }
}

// Marks every external link in Markdown as an affiliate-safe link.
// amazon.com and amzn.to stay same-window; other external links still open in a new tab.
function rehypeSponsoredLinks() {
    const walk = (node) => {
        const href = node.properties?.href;
        if (node.type === 'element' && node.tagName === 'a' && typeof href === 'string' && /^https?:/.test(href)) {
            if (isSameWindowStoreLink(href)) {
                node.properties.rel = ['sponsored', 'nofollow'];
                delete node.properties.target;
            } else {
                node.properties.rel = ['sponsored', 'nofollow', 'noopener'];
                node.properties.target = '_blank';
            }
        }
        node.children?.forEach(walk);
    };
    return (tree) => walk(tree);
}

export default defineConfig({
    site: 'https://mybusinesswork.com',
    output: 'static',
    integrations: [
        sitemap({
            filter: (page) => !page.includes('/oauth/'),
        }),
    ],
    markdown: { rehypePlugins: [rehypeSponsoredLinks] },
});
