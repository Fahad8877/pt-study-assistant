/**
 * Real AI provider adapter.
 *
 * Sends the lecture to a backend endpoint (see server-example/server.js) and
 * expects JSON in the same shape the mock provider returns:
 *
 *   task "analyze"  -> { explanation: string[], summary: string[],
 *                        concepts: [{title, detail}], terms: [{term, definition}] }
 *   task "quiz"     -> { questions: [{question, options: string[], answerIndex, explanation}] }
 *   task "case"     -> { title, presentation: string[], questions: [
 *                          {type: "mcq", question, options, answerIndex, feedback} |
 *                          {type: "open", question, modelAnswer, keywords: string[]} ] }
 */
(function () {
  async function request(task, lecture, language) {
    const res = await fetch(window.APP_CONFIG.apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task,
        language,
        lecture: { title: lecture.title, text: lecture.text },
      }),
    });
    if (!res.ok) throw new Error("AI API error: " + res.status);
    return res.json();
  }

  window.AIProviders = window.AIProviders || {};
  window.AIProviders.api = {
    analyze: (lecture, lang) => request("analyze", lecture, lang),
    quiz: (lecture, lang) => request("quiz", lecture, lang),
    clinicalCase: (lecture, lang) => request("case", lecture, lang),
  };
})();
