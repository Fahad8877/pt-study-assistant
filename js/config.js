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
  apiEndpoint: "http://localhost:3000/api/ai",
  maxStoredChars: 200000,
  quizQuestions: 6,
};
