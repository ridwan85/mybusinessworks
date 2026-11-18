/**
 * Locked mybusinesswork.com review format.
 * Every new product review must follow Hook → Why it helps → Details → CTA.
 * The Astro template owns CTAs + disclosure UI; Markdown body is details only.
 */

export const ANGLES = ['time', 'convenience', 'incident'];

export const BODY_SECTIONS = [
    'Quick verdict',
    'What it does',
    'Who it\'s for',
    'The good parts',
    'Honest limits',
    'FAQ',
    'Bottom line',
];

export const DEFAULT_CTA = 'Check Price on Amazon';

/** Prefer Amazon department / listing category when we can recognize it. */
export function normalizeProductCategory(raw, title = '') {
    const text = `${raw ?? ''} ${title}`;
    if (/amazon devices|doorbell|echo |kindle|fire tv|blink /i.test(text)) return 'Amazon Devices';
    if (/vacuum sealer|food sealer/i.test(text)) return 'Kitchen';
    if (/baby|nursery|video monitor|hellobaby/i.test(text)) return 'Baby Products';
    const cleaned = String(raw ?? '').trim();
    return cleaned || undefined;
}

export const SYSTEM_PROMPT =
    'You are an experienced US affiliate product reviewer and conversion copywriter for mybusinesswork.com. ' +
    'Write in American English, like a friend who would actually say this out loud. Grade 5 or 6 reading level. ' +
    'Use flowing, connected sentences with natural connectors such as because, so, and, and but. ' +
    'Do not stack tiny disconnected fragments. Contractions. Say "you". One to three sentences per paragraph. ' +
    'Open Quick verdict with "You know that moment when", name the reader\'s real moment, validate the feeling, explain why the problem happens, then bring in the product as the fix. ' +
    'Benefits are feelings and outcomes. Specs stay in "What it does", in plain words. ' +
    'If a spec word is needed, explain it. Example: BPA-free (no harmful plastic chemicals). ' +
    'Do not use: elevate, game-changer, seamless, boasts, look no further, in today\'s fast-paced world, or "whether you are X or Y". ' +
    'Never use em dashes. Captions are plain and natural, with no ad-speak and no phrases like "built for" or "ready for". ' +
    'Never write "the listing", "the listing says", or "per the listing". ' +
    'FAQ answers that are yes or no questions start with Yes or No, then finish the sentence naturally, and only state what the product claims. ' +
    'Never write "I tried", "I tested", "we used", or "my kids love it". ' +
    'Do not add "this page did not test" disclaimers. ' +
    'Do not write "Stanley says" or any "Brand says". Use "the claim is" only for performance numbers such as hours cold, battery life, noise, or speed. ' +
    'Do not use "the claim is" for plain facts such as what is in the box, the size, the color, or the material. ' +
    'Buyer comments, only when they are in the source facts, stay "lots of buyers say". Never invent buyer comments. ' +
    'Give honest trade-offs in a warm voice, such as buy one color, not every color. ' +
    'No fake urgency, no invented numbers, no prices. ' +
    'Use ONLY the facts supplied. Never invent specifications, ratings, awards, or medical results. ' +
    'Do not include a title (H1) or an affiliate disclosure. The template owns those. ' +
    'Put one natural Amazon link in Quick verdict and one in an FAQ answer, using the supplied affiliateUrl, ' +
    'as HTML: <a href="AFFILIATE_URL" rel="nofollow sponsored noopener" target="_blank">product name</a>. ' +
    'Page structure is locked: Hook → Why it helps in real life → Details → Amazon CTA (template owns CTAs). ' +
    'Pick ONE primary angle: "time" (saves time), "convenience" (fewer steps / easier), or "incident" (avoids a real-life mess, waste, failure, or headache). ' +
    'Return JSON with keys: ' +
    '"title" (SEO title, max 60 chars, includes the product name), ' +
    '"description" (meta description, max 155 chars), ' +
    '"angle" (one of: time, convenience, incident), ' +
    '"hook" (max 90 chars: emotional H1 with the long-tail keyword; a real frustration, not a spec list), ' +
    '"hookSupport" (1-2 short sentences, max 180 chars: the after feeling, using only supplied facts), ' +
    '"shortVerdict" (two short sentences, max 160 chars, shown under the H1), ' +
    '"whyHelps" (array of 3-4 short sentences under 15 words: feelings and outcomes, not a spec dump), ' +
    '"buyIf" (array of 2-3 short bullets: who should buy, from the facts), ' +
    '"skipIf" (array of 2-3 short bullets: honest reasons to skip), ' +
    '"compare" (array of exactly 3 objects with role, name, bestFor, limit, href. ' +
    'role must be "this", then "cheaper", then "different". ' +
    'For cheaper and different, use an Amazon search URL only: https://www.amazon.com/s?k=WORDS&tag=TAG. Do not invent ASINs or prices.), ' +
    '"ctaLabel" (short Amazon button label, usually "Check Price on Amazon"), ' +
    '"imageCaption" (one genuine caption describing what a product photo shows or does in real life; never prompt-style words like showcase, lifestyle shot, marble look, cinematic, or background), ' +
    '"imageCaptions" (optional array of 0-3 extra genuine photo captions in the same style, for additional product images if provided), ' +
    '"body" (Markdown, simple and skimmable, H2 EXACTLY in this order: Quick verdict, What it does, Who it\'s for, The good parts, Honest limits, FAQ (3-4 questions as H3), Bottom line). ' +
    'Do NOT include Where to Buy, Disclosure, Hook, or Why it helps sections in body—the template owns those.';

export function normalizeReviewOutput(out, { hasImages = false } = {}) {
    const errors = [];
    if (!out?.title) errors.push('missing title');
    if (!out?.description) errors.push('missing description');
    if (!out?.hook) errors.push('missing hook');
    if (!out?.hookSupport) errors.push('missing hookSupport');
    if (!out?.body) errors.push('missing body');
    if (!ANGLES.includes(out?.angle)) errors.push('angle must be time, convenience, or incident');

    const whyHelps = Array.isArray(out?.whyHelps)
        ? out.whyHelps.map((s) => String(s || '').trim()).filter(Boolean).slice(0, 4)
        : [];
    if (whyHelps.length < 2) errors.push('whyHelps needs at least 2 real-life points');

    const shortList = (value, min, max, label) => {
        const items = Array.isArray(value) ? value.map((s) => String(s || '').trim()).filter(Boolean).slice(0, max) : [];
        if (items.length < min) errors.push(`${label} needs ${min}-${max} bullets`);
        return items;
    };
    const buyIf = shortList(out?.buyIf, 2, 3, 'buyIf');
    const skipIf = shortList(out?.skipIf, 2, 3, 'skipIf');
    const shortVerdict = String(out?.shortVerdict || '').trim();
    if (!shortVerdict) errors.push('missing shortVerdict');

    const compareIn = Array.isArray(out?.compare) ? out.compare : [];
    const roles = ['this', 'cheaper', 'different'];
    const compare = roles.map((role) => compareIn.find((row) => row?.role === role)).filter(Boolean);
    if (compare.length !== 3) errors.push('compare needs this, cheaper, and different rows');
    for (const row of compare) {
        if (!row.name || !row.bestFor || !row.limit) errors.push(`compare ${row.role} is incomplete`);
        if (row.role !== 'this') {
            try {
                const url = new URL(String(row.href || ''));
                if (!url.hostname.endsWith('amazon.com') || !url.pathname.startsWith('/s')) {
                    errors.push(`compare ${row.role} href must be an Amazon search URL`);
                }
            } catch {
                errors.push(`compare ${row.role} href must be an Amazon search URL`);
            }
        }
    }

    let body = String(out.body || '')
        .replace(/^##\s*Where to Buy[\s\S]*?(?=^##\s|\Z)/gim, '')
        .replace(/^##\s*Disclosure[\s\S]*?(?=^##\s|\Z)/gim, '')
        .replace(/^>\s*\*\*Disclosure:\*\*[\s\S]*?(?=\n## |\n# |\Z)/gim, '')
        .trim();

    for (const section of BODY_SECTIONS) {
        if (!new RegExp(`^##\\s+${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'im').test(body)) {
            errors.push(`body missing H2: ${section}`);
        }
    }

    const bannedCaption = /\b(showcase|lifestyle shot|product shot|marble look|cinematic|prompt|mockup|hero image|background)\b/i;
    let imageCaption = String(out.imageCaption || '').trim();
    if (hasImages) {
        if (!imageCaption) errors.push('missing imageCaption');
        else if (bannedCaption.test(imageCaption)) errors.push('imageCaption sounds like a prompt; describe what the photo shows/does');
    }

    const imageCaptions = Array.isArray(out.imageCaptions)
        ? out.imageCaptions.map((s) => String(s || '').trim()).filter(Boolean).slice(0, 3)
        : [];
    for (const [i, cap] of imageCaptions.entries()) {
        if (bannedCaption.test(cap)) errors.push(`imageCaptions[${i}] sounds like a prompt`);
    }

    if (errors.length) {
        const err = new Error(errors.join('; '));
        err.details = errors;
        throw err;
    }

    return {
        title: String(out.title).trim(),
        description: String(out.description).trim(),
        angle: out.angle,
        hook: String(out.hook).trim(),
        hookSupport: String(out.hookSupport).trim(),
        shortVerdict,
        whyHelps,
        buyIf,
        skipIf,
        compare: compare.map((row) => ({
            role: row.role,
            name: String(row.name).trim(),
            bestFor: String(row.bestFor).trim(),
            limit: String(row.limit).trim(),
            href: row.role === 'this' ? String(row.href || '').trim() : String(row.href).trim(),
        })),
        ctaLabel: String(out.ctaLabel || DEFAULT_CTA).trim() || DEFAULT_CTA,
        imageCaption: imageCaption || undefined,
        imageCaptions,
        body,
    };
}

export function buildImagesFrontmatter({ imageSrc, showcases = [], imageCaption, imageCaptions = [] }) {
    const paths = [];
    if (imageSrc) paths.push(imageSrc);
    for (const s of showcases) {
        const src = typeof s === 'string' ? s : s?.src;
        if (src && !paths.includes(src)) paths.push(src);
    }
    if (!paths.length) return { imagesLine: null, imageCaptionLine: null };

    const captions = [imageCaption, ...imageCaptions].filter(Boolean);
    const images = paths.map((src, i) => ({
        src,
        caption: captions[i] || captions[0] || 'Product photo for this review.',
        alt: captions[i] || captions[0] || 'Product photo',
    }));

    return {
        imagesLine: `images: ${JSON.stringify(images)}`,
        imageCaptionLine: imageCaption ? `imageCaption: ${JSON.stringify(imageCaption)}` : `imageCaption: ${JSON.stringify(images[0].caption)}`,
    };
}
