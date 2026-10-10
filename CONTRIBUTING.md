# Contributing

Thanks for looking. Deadpan is a static page with no build step, so a change is a file edit and a test run.

```sh
git clone https://github.com/Arthur031221/Deadpan
cd Deadpan
npm ci
npm start          # serves app/ on http://localhost:4173
npm test           # unit tests, no browser
npm run test:e2e   # real Chromium with a fake camera, needs: npx playwright install chromium
npm run format     # Prettier
```

## Adding a country preset

Presets live in `app/src/core/specs.js`. A preset needs three things:

1. The numbers from the issuing authority's own page (photo size, head height from chin to crown).
2. That page's URL in `source`, and the date you read it in `CHECKED`.
3. A note for anything the page leaves out. Do not fill a gap with a number from a photo shop's blog.

If the authority needs a commercial photographer (Canada does) or rejects any edited picture, say so in `notes`. Open an issue with the link first if you are unsure the page is the right one.

## Changing a rule

Rules are in `app/src/core/geometry.js`. Each rule says whether its numbers come from the spec (`basis: "spec"`) or are Deadpan's own tolerance (`basis: "guide"`). Keep that split honest. A change that touches measurement should come with a run of `npm run fit` and the new numbers in `docs/accuracy.md`.

## Code style

Plain ES modules, no framework, no bundler. Comments explain why, not what. Prettier decides the formatting.
