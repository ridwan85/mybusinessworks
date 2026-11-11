// Usage: npm run pinterest:publish -- <draft-json>
// Shows the draft, requires typing "publish", then creates ONE pin via API.
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import {
    createPin,
    fail,
    readDraft,
    refreshAccessTokenIfNeeded,
    requireEnv,
    writePublishReceipt,
} from './lib/pinterest.mjs';

const draftPath = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!draftPath) {
    fail('Pass a draft file: npm run pinterest:publish -- data/pinterest/drafts/<id>.json');
}

const boardId = requireEnv('PINTEREST_BOARD_ID');
const draft = await readDraft(draftPath);
const token = await refreshAccessTokenIfNeeded();

console.log('\n— Pin draft (confirm before API publish) —');
console.log(`File:        ${draftPath}`);
console.log(`Title:       ${draft.title}`);
console.log(`Description: ${draft.description}`);
console.log(`Link:        ${draft.link}`);
console.log(`Image:       ${draft.mediaUrl}`);
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
