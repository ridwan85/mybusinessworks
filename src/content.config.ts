import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { isAmazonHostedImageUrl, isOwnerPhotoPath } from './lib/product-image';

const reviews = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/reviews' }),
    schema: z.object({
        title: z.string(),
        description: z.string(),
        asin: z.string(),
        brand: z.string().optional(),
        category: z.string().optional(),
        affiliateUrl: z.string().url(),
        // Optional Amazon-hosted image (SiteStripe or Product Advertising API). Not a downloaded file.
        siteStripeImage: z
            .string()
            .url()
            .refine((value) => isAmazonHostedImageUrl(value), {
                message: 'siteStripeImage must be an Amazon-hosted image URL from SiteStripe or the Product Advertising API.',
            })
            .optional(),
        // Optional photo the owner took. Example: /images/reviews/<asin>/own.jpg
        ownImage: z
            .string()
            .refine((value) => isOwnerPhotoPath(value), {
                message: 'ownImage must be a site path like /images/reviews/<asin>/own.jpg.',
            })
            .optional(),
        // On-site lifestyle creatives are allowed. source.jpg (a re-hosted Amazon packshot) is not rendered.
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
        // Optional pin-style lines. Used when a review should echo its Pinterest headline treatment.
        eyebrow: z.string().min(1).optional(),
        subline: z.string().min(1).optional(),
        // Short real-life explanation under "Why it helps" (2-4 points).
        whyHelps: z.array(z.string().min(1)).min(2).max(4),
        /** Two short lines under the H1. Feelings and outcome, not a spec list. */
        shortVerdict: z.string().min(1).max(240),
        buyIf: z.array(z.string().min(1)).min(2).max(3),
        skipIf: z.array(z.string().min(1)).min(2).max(3),
        compare: z
            .array(
                z.object({
                    role: z.enum(['this', 'cheaper', 'different']),
                    name: z.string().min(1),
                    bestFor: z.string().min(1),
                    limit: z.string().min(1),
                    href: z.string().url(),
                }),
            )
            .length(3),
        angle: z.enum(['time', 'convenience', 'incident']),
        ctaLabel: z.string().optional(),
        features: z.array(z.string()),
        pubDate: z.coerce.date(),
        /** When we added the product to the catalog (ISO). Prefer this over pubDate for “latest”. */
        createdAt: z.coerce.date().optional(),
    }),
});

export const collections = { reviews };
