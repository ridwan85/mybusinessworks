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
                // Main buttons stay same-window (set in the template). In-body text
                // links that ask for a new tab keep it, with the sponsored rel.
                const target = node.properties.target;
                const wantsBlank = target === '_blank' || (Array.isArray(target) && target.includes('_blank'));
                if (wantsBlank) {
                    node.properties.rel = ['nofollow', 'sponsored', 'noopener'];
                    node.properties.target = '_blank';
                } else {
                    node.properties.rel = ['sponsored', 'nofollow'];
                    delete node.properties.target;
                }
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
    redirects: {
        '/categories/home': '/categories/home-living/',
        '/categories/home-decor': '/categories/home-living/',
        '/categories/health': '/categories/health-household/',
        '/guides/stanley-quencher-vs-counter-kettle': '/guides/keurig-vs-electric-kettle/',
    },
    integrations: [
        sitemap({
            filter: (page) => !page.includes('/oauth/'),
        }),
        {
            name: 'sitemap-xml-copy',
            hooks: {
                'astro:build:done': async ({ dir }) => {
                    const { copyFile } = await import('node:fs/promises');
                    const { fileURLToPath } = await import('node:url');
                    const path = await import('node:path');
                    const out = fileURLToPath(dir);
                    await copyFile(path.join(out, 'sitemap-index.xml'), path.join(out, 'sitemap.xml'));
                },
            },
        },
    ],
    markdown: { rehypePlugins: [rehypeSponsoredLinks] },
});
