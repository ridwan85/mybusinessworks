import type { CollectionEntry } from 'astro:content';

export type Review = CollectionEntry<'reviews'>;

export type CategoryHub = {
    slug: string;
    label: string;
    blurb: string;
    src: string;
    /** Return true when a review belongs in this hub. */
    match: (review: Review) => boolean;
};

export const categoryHubs: CategoryHub[] = [
    {
        slug: 'home-living',
        label: 'Home & living',
        blurb: 'Everyday upgrades that earn their space.',
        src: '/images/site/hero-home-lifestyle.jpg',
        match: (r) =>
            testCategory(
                r,
                /home|living|kitchen|house|vacuum|sealer|cleaner|appliance|decor|bedding|cook|food|storage/i,
            ),
    },
    {
        slug: 'work-tech',
        label: 'Work & tech',
        blurb: 'Tools that help you move faster with less friction.',
        src: '/images/site/hero-workspace.jpg',
        match: (r) =>
            testCategory(
                r,
                /tech|electronic|computer|office|work|gadget|phone|laptop|audio|headphone|charger|smart/i,
            ),
    },
    {
        slug: 'everyday-essentials',
        label: 'Everyday essentials',
        blurb: 'From must-haves to nice-to-haves—reviewed the same way.',
        src: '/images/site/hero-parcels.jpg',
        match: () => true,
    },
];

export function slugifyCategory(name: string) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function testCategory(review: Review, re: RegExp) {
    const hay = `${review.data.category ?? ''} ${review.data.title} ${review.data.description}`;
    return re.test(hay);
}

export function reviewsForHub(reviews: Review[], hub: CategoryHub) {
    if (hub.slug === 'everyday-essentials') {
        // Prefer reviews that didn't land in a more specific hub; fall back to all.
        const specific = categoryHubs.filter((h) => h.slug !== 'everyday-essentials');
        const orphans = reviews.filter((r) => !specific.some((h) => h.match(r)));
        return (orphans.length ? orphans : reviews).sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
    }
    return reviews.filter(hub.match).sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export function uniqueProductCategories(reviews: Review[]) {
    const map = new Map<string, { label: string; slug: string; reviews: Review[] }>();
    for (const r of reviews) {
        const label = r.data.category?.trim();
        if (!label) continue;
        const slug = slugifyCategory(label);
        const existing = map.get(slug);
        if (existing) existing.reviews.push(r);
        else map.set(slug, { label, slug, reviews: [r] });
    }
    return [...map.values()]
        .map((c) => ({
            ...c,
            reviews: c.reviews.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

export function findHub(slug: string) {
    return categoryHubs.find((h) => h.slug === slug);
}
