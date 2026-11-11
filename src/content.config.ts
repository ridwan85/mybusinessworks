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
        images: z.array(z.string().min(1)).optional(),
        imageHtml: z.string().optional(),
        imageSrc: z.string().min(1).optional(),
        features: z.array(z.string()),
        pubDate: z.coerce.date(),
    }),
});

export const collections = { reviews };
