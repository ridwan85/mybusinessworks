import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Marks every external link in Markdown as an affiliate-safe link.
function rehypeSponsoredLinks() {
    const walk = (node) => {
        if (node.type === 'element' && node.tagName === 'a' && /^https?:/.test(node.properties?.href ?? '')) {
            node.properties.rel = ['sponsored', 'nofollow', 'noopener'];
            node.properties.target = '_blank';
        }
        node.children?.forEach(walk);
    };
    return (tree) => walk(tree);
}

export default defineConfig({
    site: 'https://mybusinesswork.com',
    output: 'static',
    integrations: [sitemap()],
    markdown: { rehypePlugins: [rehypeSponsoredLinks] },
});
