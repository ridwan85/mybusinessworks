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
                /home|living|kitchen|house|vacuum|sealer|cleaner|appliance|decor|bedding|cook|food|storage|doorbell|security|camera|monitor|lock|entry|porch|yard|garden|laundry|bath/i,
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
                /tech|electronic|computer|office|work|gadget|phone|laptop|audio|headphone|charger|keyboard|mouse|monitor|tablet|usb|ssd|router|wifi/i,
            ) &&
            // Keep home-security cameras/doorbells in Home & living, not Work & tech.
            !testCategory(r, /doorbell|security camera|home security|video doorbell/i),
    },
    {
        slug: 'everyday-essentials',
        label: 'Everyday essentials',
        blurb: 'From must-haves to nice-to-haves—reviewed the same way.',
        src: '/images/site/hero-parcels.jpg',
        match: (r) => {
            const specific = categoryHubs.filter((h) => h.slug !== 'everyday-essentials');
            return !specific.some((h) => h.match(r));
        },
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

/** Map messy Amazon leaf categories into cleaner on-site labels when needed. */
export function normalizeProductCategory(raw: string | undefined, title = '') {
    const text = `${raw ?? ''} ${title}`;
    if (/doorbell|home security|security camera/i.test(text)) return 'Home Security';
    if (/vacuum sealer|food sealer/i.test(text)) return 'Kitchen';
    return (raw ?? '').trim() || undefined;
}
