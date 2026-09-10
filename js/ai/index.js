/**
 * AI facade used by the app. Picks the provider from APP_CONFIG.aiProvider
 * and falls back to the mock provider if the real API is unreachable.
 */
(function () {
  function provider() {
    const name = window.APP_CONFIG.aiProvider;
    return window.AIProviders[name] || window.AIProviders.mock;
  }

  async function run(method, lecture, opts) {
    const lang = window.I18N.lang;
    const p = provider();
    try {
      return await p[method](lecture, lang, opts);
    } catch (err) {
      if (p !== window.AIProviders.mock) {
        console.warn("AI provider failed, falling back to mock:", err);
        return window.AIProviders.mock[method](lecture, lang, opts);
      }
      throw err;
    }
  }

  window.AI = {
    analyze: (lecture) => run("analyze", lecture),
    // opts: { slideIndexes: number[] | null, count: number }
    quiz: (lecture, opts) => run("quiz", lecture, opts || {}),
    clinicalCase: (lecture) => run("clinicalCase", lecture),
    isMock: () => provider() === window.AIProviders.mock,
  };
})();
