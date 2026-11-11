/** Lightweight SEO helpers — JSON-LD + FAQ extraction from review Markdown. */

export type FaqItem = { question: string; answer: string };

/** Parse `## FAQ` / `### Question` blocks from review Markdown bodies. */
export function parseFaqFromMarkdown(body: string): FaqItem[] {
    const lines = body.replace(/\r\n/g, '\n').split('\n');
    const start = lines.findIndex((l) => /^##\s+FAQ\s*$/i.test(l));
    if (start < 0) return [];
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
        if (/^##\s+/.test(lines[i])) {
            end = i;
            break;
        }
    }
    const section = lines.slice(start + 1, end);
    const items: FaqItem[] = [];
    let question: string | null = null;
    let answerLines: string[] = [];
    const flush = () => {
        if (!question) return;
        const answer = answerLines
            .join(' ')
            .replace(/[*_`]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (answer) items.push({ question, answer });
        question = null;
        answerLines = [];
    };
    for (const line of section) {
        const q = line.match(/^###\s+(.+?)\s*$/);
        if (q) {
            flush();
            question = q[1].trim();
            continue;
        }
        if (question) answerLines.push(line.trim());
    }
    flush();
    return items;
}

export function absoluteUrl(pathOrUrl: string | undefined, site: URL | string | undefined) {
    if (!pathOrUrl || !site) return undefined;
    try {
        return new URL(pathOrUrl, site).href;
    } catch {
        return undefined;
    }
}

export function breadcrumbListJsonLd(items: { name: string; url: string }[]) {
    return {
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: item.name,
            item: item.url,
        })),
    };
}

export function faqPageJsonLd(faqs: FaqItem[]) {
    if (!faqs.length) return null;
    return {
        '@type': 'FAQPage',
        mainEntity: faqs.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: f.answer,
            },
        })),
    };
}

type ReviewSeoInput = {
    title: string;
    description: string;
    hook: string;
    hookSupport: string;
    brand?: string;
    asin: string;
    pubDate: Date;
    pageUrl: string;
    imageUrl?: string;
    faqs: FaqItem[];
    breadcrumbs: { name: string; url: string }[];
};

/** Review + Product (+ optional FAQ / breadcrumbs) as a single @graph. */
export function reviewPageJsonLd(input: ReviewSeoInput) {
    const org = {
        '@type': 'Organization',
        name: 'Daily Viral Deals',
        url: new URL('/', input.pageUrl).origin,
    };

    const product: Record<string, unknown> = {
        '@type': 'Product',
        name: input.title,
        description: input.description,
        sku: input.asin,
        mpn: input.asin,
        url: input.pageUrl,
        ...(input.brand ? { brand: { '@type': 'Brand', name: input.brand } } : {}),
        ...(input.imageUrl ? { image: [input.imageUrl] } : {}),
        // Keep affiliate URLs out of JSON-LD — they belong on visible CTAs with rel=sponsored.
    };

    const review = {
        '@type': 'Review',
        name: input.title,
        headline: input.hook,
        reviewBody: `${input.hookSupport} ${input.description}`.trim(),
        datePublished: input.pubDate.toISOString().slice(0, 10),
        author: org,
        publisher: org,
        url: input.pageUrl,
        itemReviewed: {
            '@type': 'Product',
            name: input.title,
            sku: input.asin,
            ...(input.brand ? { brand: { '@type': 'Brand', name: input.brand } } : {}),
            ...(input.imageUrl ? { image: input.imageUrl } : {}),
        },
        ...(input.imageUrl ? { image: input.imageUrl } : {}),
    };

    const graph: unknown[] = [org, product, review, breadcrumbListJsonLd(input.breadcrumbs)];
    const faq = faqPageJsonLd(input.faqs);
    if (faq) graph.push(faq);

    return {
        '@context': 'https://schema.org',
        '@graph': graph,
    };
}
