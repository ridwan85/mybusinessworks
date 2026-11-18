// AI scenes built from Amazon product photos are disabled.
// This script no longer reads imageUrl or a downloaded product photo.
//
// Text pins (default):
//   npm run pinterest:draft -- <slug>
// Owner photo on the graphic (file must be your own, named own.jpg):
//   npm run pinterest:draft -- <slug> --own-photo
// Gemini edit of that own photo only:
//   PIN_ALLOW_AI_SCENE=1 npm run pinterest:draft -- <slug> --ai-scene

console.error(`
AI scenes built from Amazon product photos are disabled.

New pins are text graphics (headline, benefit lines, brand colors):
  npm run pinterest:draft -- <slug-or-asin>

Optional owner photo, not an Amazon download:
  save public/images/reviews/<asin>/own.jpg
  npm run pinterest:draft -- <slug-or-asin> --own-photo

Gemini stays off unless you opt in, and it still refuses Amazon photos:
  PIN_ALLOW_AI_SCENE=1 npm run pinterest:draft -- <slug-or-asin> --ai-scene
`);
process.exit(1);
