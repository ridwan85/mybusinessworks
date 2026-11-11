// Usage: npm run pinterest:publish -- <draft-json>
// Shows the draft, requires typing "publish", then creates ONE pin via API.
// Refuses drafts that lack hook-on-image + hook-in-description Pin assets.
import fs from 'node:fs/promises';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import {
    assertDraftReadyForPublish,
    createPin,
    fail,
    readDraft,
    refreshAccessTokenIfNeeded,
    requireEnv,
    writePublishReceipt,
    PIN_FILENAME,
    PIN_HEIGHT,
    PIN_WIDTH,
    PIN_ASPECT,
} from './lib/pinterest.mjs';

const draftPath = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!draftPath) {
    fail('Pass a draft file: npm run pinterest:publish -- data/pinterest/drafts/<id>.json');
}

const draft = await readDraft(draftPath);
assertDraftReadyForPublish(draft);

if (draft.mediaLocalPath) {
    try {
        await fs.access(draft.mediaLocalPath);
    } catch {
        fail(`Pin image file missing on disk: ${draft.mediaLocalPath}\nRe-run: npm run pinterest:draft`);
    }
}

const boardId = requireEnv('PINTEREST_BOARD_ID');
const token = await refreshAccessTokenIfNeeded();

console.log('\n— Pin draft (confirm before API publish) —');
console.log(`File:        ${draftPath}`);
console.log(`Hook:        ${draft.hook}`);
console.log(`Title:       ${draft.title}`);
console.log(`Description:\n${draft.description}\n`);
console.log(`Image:       ${draft.mediaUrl}`);
console.log(`Pin spec:    ${PIN_WIDTH}×${PIN_HEIGHT} (${PIN_ASPECT}), file ${PIN_FILENAME}`);
console.log(`Hook on img: ${draft.hookOnImage ? 'yes' : 'no'}`);
console.log(`Link:        ${draft.link}`);
console.log(`Board id:    ${boardId}`);
console.log(`Draft hash:  ${draft.draftHash || '(none)'}`);
console.log('\nCompliance: one pin per confirmation. Type exactly: publish\n');

const rl = readline.createInterface({ input, output });
const answer = (await rl.question('Confirm> ')).trim();
rl.close();

if (answer !== 'publish') {
    console.log('Aborted — nothing was sent to Pinterest.');
    process.exit(0);
}

console.log('\nCreating pin via Pinterest API…');
const pin = await createPin({ token, boardId, draft });
const { file, receipt } = await writePublishReceipt({ draft, pin, boardId });

console.log('\nPublished.');
console.log(`Pin id:   ${receipt.pinId || JSON.stringify(pin)}`);
console.log(`Receipt:  ${file}`);
if (pin.id) console.log(`URL hint: https://www.pinterest.com/pin/${pin.id}/`);
console.log('');
