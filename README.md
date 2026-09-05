# PT Study Assistant

A simple, clean web app that helps Master's Physical Therapy students study their lecture
slides with an AI assistant. University project prototype.

## Features

- **Upload Lecture** – PDF (`.pdf`) or PowerPoint (`.pptx`). Text is extracted in the browser.
- **AI Study Assistant** – simple explanation, summary of key points, key concepts, terms & definitions.
- **Quiz** – short multiple-choice quiz based only on the lecture, with answer + explanation.
- **Clinical Case** – a patient scenario related to the lecture with questions and feedback.
- **Dashboard** – Continue Studying, Upload Lecture, My Lectures, Quiz, Clinical Case.
- **English / Arabic** switcher with automatic RTL layout.
- Responsive on mobile and desktop.

## Running it

No build step and no installs required.

- **Easiest:** double-click `index.html` to open it in Chrome or Edge.
- **Or with a local server:** run `serve.ps1` (right-click → *Run with PowerShell*, or
  `powershell -ExecutionPolicy Bypass -File serve.ps1`) and it opens http://localhost:8080/.
  Any other static server (`npx serve`, `python -m http.server`) also works.

Internet access is needed the first time for the fonts and the two CDN libraries
(pdf.js, JSZip).

Click **Try a sample lecture** on the Upload page to see the full flow without a file.

Lectures and generated study material are stored in the browser (`localStorage`).

## Project structure

```
index.html              App shell (single page, hash routing)
css/styles.css          Styling, RTL support, responsive rules
js/config.js            Settings: AI provider ("mock" or "api"), endpoint
js/i18n.js              English / Arabic dictionary + RTL switching
js/storage.js           Lecture persistence (localStorage)
js/parsers.js           PDF and PPTX text extraction
js/sample-lecture.js    Built-in demo lecture
js/ai/mock.js           Mock AI provider (lecture-derived responses)
js/ai/api.js            Real AI provider adapter (HTTP)
js/ai/index.js          AI facade used by the UI (picks provider, falls back to mock)
js/app.js               Views, upload flow, quiz and clinical case logic
server-example/server.js  Example Node backend using the Claude API
```

## Connecting a real AI API

The UI only talks to `window.AI` (`analyze`, `quiz`, `clinicalCase`). Providers live in
`js/ai/` and must return these JSON shapes:

```
analyze -> { explanation: string[], summary: string[],
             concepts: [{ title, detail }], terms: [{ term, definition }] }
quiz    -> { questions: [{ question, options: string[], answerIndex, explanation }] }
case    -> { title, presentation: string[], questions: [
              { type: "mcq",  question, options, answerIndex, feedback } |
              { type: "open", question, modelAnswer, keywords: string[] } ] }
```

To use the Claude API:

1. Install Node.js 18+, then in `server-example/` run `npm install @anthropic-ai/sdk express cors`.
2. Set `ANTHROPIC_API_KEY` in your environment and run `node server.js`.
3. In `js/config.js` set `aiProvider: "api"`.

If the API is unreachable the app automatically falls back to the mock provider.

## Deploying

The app is static, so any static host works. `build-bundle.ps1` produces `dist/index.html`,
a single self-contained file (CSS and JS inlined; only the CDN libraries and fonts stay external).

- **Live public site:** https://fahad8877.github.io/pt-study-assistant/
  (GitHub Pages, deployed from the `main` branch of https://github.com/Fahad8877/pt-study-assistant).
- **GitHub Pages (recommended, free, permanent):** create a free GitHub account and an empty
  public repository, then run
  `powershell -ExecutionPolicy Bypass -File deploy-github-pages.ps1 -Repo <repository URL>`.
  Enable Pages once (Settings → Pages → branch `main`, folder `/`). The site appears at
  `https://<user>.github.io/<repo>/`. Re-run the script to publish updates.
- **Netlify Drop / Vercel / Cloudflare Pages:** drag the whole `pt-study-assistant` folder
  (or just `dist/`) onto the host's upload page. No build command, no environment variables.

The example backend in `server-example/` is only needed if you connect a real AI API.

## Limitations (prototype)

- Scanned/image-only PDFs have no text layer and cannot be analyzed (no OCR).
- Old binary `.ppt` files are not supported; save them as `.pptx`.
- In mock mode the interface text follows the selected language, but extracted lecture
  content stays in the language of the lecture.
