/**
 * App configuration.
 *
 * AI provider:
 *   "mock" -> realistic, lecture-derived responses generated in the browser (no API needed).
 *   "api"  -> POST requests to `apiEndpoint`, expected to return the same JSON shapes
 *             the mock produces. See server-example/server.js and README.md.
 */
window.APP_CONFIG = {
  aiProvider: "mock",
  apiEndpoint: "http://localhost:3000/api/generate",
  // Send page/slide images to the backend (vision). Set false to send text only.
  apiSendImages: true,
  apiMaxImages: 40,
  maxStoredChars: 200000,
  // Quiz length scales with the amount of selected content (slides/pages).
  quizMinQuestions: 3,
  quizMaxQuestions: 12,
  quizCountFor: (slideCount) => Math.max(3, Math.min(12, Math.round(2 + slideCount * 0.9))),
};
