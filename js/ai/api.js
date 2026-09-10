/**
 * Real AI provider adapter.
 *
 * Sends the lecture to a backend endpoint (see server-example/server.js) and
 * expects JSON in the same shape the mock provider returns:
 *
 *   task "analyze"  -> { sections: [{key, title, lead, paragraphs: string[]}]  (whole-document synthesis:
 *                                    overview, mechanisms, assessment, management),
 *                        pearls: string[], terms: [{term, definition}],
 *                        explanation: string[], summary: string[], concepts: [{title, detail}] }
 *   task "quiz"     -> { questions: [{scenario, question, options: string[], answerIndex,
 *                                     explanation, whyOthers: string[] (aligned with options)}] }
 *                      Request extras: quiz: { count, slides: [{number, text}] } — only the
 *                      selected slides are sent, and `count` is the desired number of questions.
 *   task "case"     -> { title, presentation: string[], questions: [
 *                          {type: "mcq", question, options, answerIndex, feedback} |
 *                          {type: "open", question, modelAnswer, keywords: string[]} ] }
 */
(function () {
  async function request(task, lecture, language, extra) {
    const res = await fetch(window.APP_CONFIG.apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({
        task,
        language,
        lecture: { title: lecture.title, text: lecture.text },
      }, extra || {})),
    });
    if (!res.ok) throw new Error("AI API error: " + res.status);
    return res.json();
  }

  function quizExtra(lecture, opts) {
    const o = opts || {};
    const all = window.Parsers.segments(lecture);
    const chosen = Array.isArray(o.slideIndexes) && o.slideIndexes.length ? all.filter((s) => o.slideIndexes.includes(s.index)) : all;
    return {
      quiz: {
        count: o.count || window.APP_CONFIG.quizCountFor(chosen.length),
        slides: chosen.map((s) => ({ number: s.number, text: s.text })),
      },
    };
  }

  window.AIProviders = window.AIProviders || {};
  window.AIProviders.api = {
    analyze: (lecture, lang) => request("analyze", lecture, lang),
    quiz: (lecture, lang, opts) => request("quiz", lecture, lang, quizExtra(lecture, opts)),
    clinicalCase: (lecture, lang) => request("case", lecture, lang),
  };
})();
