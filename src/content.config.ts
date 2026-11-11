import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const reviews = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/reviews' }),
    schema: z.object({
        title: z.string(),
        description: z.string(),
        asin: z.string(),
        brand: z.string().optional(),
        category: z.string().optional(),
        affiliateUrl: z.string().url(),
        // Absolute http(s) URLs or site-relative paths like /images/...
        // Strings or { src, caption?, alt? } objects are accepted.
        images: z
            .array(
                z.union([
                    z.string().min(1),
                    z.object({
                        src: z.string().min(1),
                        caption: z.string().optional(),
                        alt: z.string().optional(),
                    }),
                ]),
            )
            .optional(),
        imageHtml: z.string().optional(),
        imageSrc: z.string().min(1).optional(),
        imageCaption: z.string().optional(),
        // Landing-style review arc: Hook → Meat → CTA
        // angle focuses the promise on time, convenience, or avoiding a real-life incident.
        hook: z.string().min(1),
        hookSupport: z.string().min(1),
        // Short real-life explanation under "Why it helps" (2-4 points).
        whyHelps: z.array(z.string().min(1)).min(2).max(4),
        angle: z.enum(['time', 'convenience', 'incident']),
        ctaLabel: z.string().optional(),
        features: z.array(z.string()),
        pubDate: z.coerce.date(),
    }),
});

export const collections = { reviews };
