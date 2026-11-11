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
        images: z.array(z.string().url()).min(1),
        features: z.array(z.string()),
        pubDate: z.coerce.date(),
    }),
});

export const collections = { reviews };
