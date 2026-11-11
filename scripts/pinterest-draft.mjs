// Usage: npm run pinterest:draft [-- <slug-or-asin>]
// Builds pin draft JSON from review Markdown. Does NOT publish.
import {
    buildPinDraft,
    fail,
    listDraftableReviews,
    writeDraft,
} from './lib/pinterest.mjs';

const filter = process.argv.slice(2).find((a) => !a.startsWith('--'));

const reviews = await listDraftableReviews(filter);
if (!reviews.length) {
    fail(filter ? `No reviews matched "${filter}".` : 'No reviews found in src/content/reviews/.');
}

console.log(`Building ${reviews.length} pin draft(s) from reviews…\n`);
for (const review of reviews) {
    const draft = buildPinDraft(review);
    const file = await writeDraft(draft);
    console.log(`✓ ${draft.slug}`);
    console.log(`  title: ${draft.title}`);
    console.log(`  media: ${draft.mediaUrl}`);
    console.log(`  link:  ${draft.link}`);
    console.log(`  file:  ${file}\n`);
}

console.log('Drafts ready. Publish one at a time with:');
console.log('  npm run pinterest:publish -- data/pinterest/drafts/<id>.json');
console.log('(You must type "publish" to confirm each pin.)\n');
