/**
 * AI facade used by the app. Picks the provider from APP_CONFIG.aiProvider
 * and falls back to the mock provider if the real API is unreachable.
 */
(function () {
  function provider() {
    // An API key entered in Settings enables the in-browser Claude provider on any host;
    // otherwise the configured provider ("mock" or a backend "api") is used.
    const b = window.AIProviders.browser;
    if (b && b.isConfigured() && window.APP_CONFIG.aiProvider !== "api") return b;
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
        document.dispatchEvent(new CustomEvent("aierror", { detail: { message: String(err.message || err), status: err.status } }));
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
