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
        blurb: 'Things you use at home, because they make an ordinary day a little easier.',
        src: '/images/site/hero-home-lifestyle.jpg',
        match: (r) =>
            testCategory(
                r,
                /home|living|kitchen|house|vacuum|sealer|cleaner|appliance|decor|bedding|cook|food|storage|laundry|bath|garden|yard|baby|nursery|video monitor/i,
            ) &&
            // Smart-home gadgets from Amazon Devices belong in Work & tech.
            !testCategory(r, /amazon devices|doorbell|smart home|security camera|echo |kindle|fire tv|video doorbell/i),
    },
    {
        slug: 'work-tech',
        label: 'Work & tech',
        blurb: 'Tools that make work and tech a little less fiddly.',
        src: '/images/site/hero-workspace.jpg',
        match: (r) =>
            testCategory(
                r,
                /tech|electronic|computer|office|work|gadget|phone|laptop|audio|headphone|charger|keyboard|mouse|monitor|tablet|usb|ssd|router|wifi|amazon devices|doorbell|smart home|security camera|echo |kindle|fire tv|video doorbell|camera/i,
            ) &&
            // Nursery / baby monitors stay in Home & living.
            !testCategory(r, /baby|nursery|hellobaby/i),
    },
    {
        slug: 'everyday-essentials',
        label: 'Everyday essentials',
        blurb: 'Other useful picks that did not fit the first two groups.',
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

/** Prefer product create time; fall back to pubDate. */
export function reviewCreatedAt(review: Review) {
    return (review.data.createdAt ?? review.data.pubDate).valueOf();
}

export function sortReviewsNewestFirst(reviews: Review[]) {
    return [...reviews].sort((a, b) => reviewCreatedAt(b) - reviewCreatedAt(a));
}

export function reviewsForHub(reviews: Review[], hub: CategoryHub) {
    return sortReviewsNewestFirst(reviews.filter(hub.match));
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
            reviews: sortReviewsNewestFirst(c.reviews),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

export function findHub(slug: string) {
    return categoryHubs.find((h) => h.slug === slug);
}

/** Same product category first; otherwise same hub. Excludes `current`. */
export function relatedReviews(all: Review[], current: Review, limit = 3) {
    const others = all.filter((r) => r.id !== current.id);
    const cat = current.data.category?.trim().toLowerCase();
    const byCategory = cat
        ? others.filter((r) => r.data.category?.trim().toLowerCase() === cat)
        : [];
    const pool =
        byCategory.length > 0
            ? byCategory
            : others.filter((r) => categoryHubs.some((h) => h.match(current) && h.match(r)));
    return sortReviewsNewestFirst(pool).slice(0, limit);
}

/** Prefer Amazon department / listing category when we can recognize it. */
export function normalizeProductCategory(raw: string | undefined, title = '') {
    const text = `${raw ?? ''} ${title}`;
    if (/amazon devices|doorbell|echo |kindle|fire tv|blink /i.test(text)) return 'Amazon Devices';
    if (/vacuum sealer|food sealer/i.test(text)) return 'Kitchen';
    if (/baby|nursery|video monitor|hellobaby/i.test(text)) return 'Baby Products';
    return (raw ?? '').trim() || undefined;
}
