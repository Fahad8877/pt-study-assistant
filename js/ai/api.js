/**
 * Real AI provider adapter (multimodal, three-module generation).
 *
 * One request to the backend (`POST {apiEndpoint}`) generates all three modules
 * for a lecture; the result is cached on the lecture so analyze / quiz / case
 * share it. The quiz can be regenerated for a narrowed slide scope.
 *
 * Request body:
 *   { language: "en"|"ar", modules: ["summary","cases","questions"],
 *     lecture: { title, slides: [{ number, title, markdown, notes, tables }] },
 *     images:  [{ slide, kind, mediaType, data }]   // base64 JPEG, optional
 *     questions: { count, slideNumbers }            // optional narrowing for the quiz
 *   }
 * Response body (see server-example/server.js):
 *   { summary: { markdown, pearls: string[], terms: [{term, definition}] },
 *     cases:   [{ title, demographics, chiefComplaint, hpi, vitals, exam, reasoning: string[],
 *                 plan: string[], questions: [...interactive case questions...] }],
 *     questions: [{ scenario, question, options[4], answerIndex, explanation, whyOthers[4] }] }
 */
(function () {
  const cache = new Map(); // key: lectureId|lang -> response

  function slidesOf(lecture, only) {
    return window.Parsers.segments(lecture)
      .filter((s) => !only || only.includes(s.index))
      .map((s) => ({ number: s.number, title: s.title, markdown: s.markdown || `## ${s.title}\n${s.text}`, notes: s.notes || "", tables: s.tables || [] }));
  }

  async function imagesOf(lecture, only) {
    const cfg = window.APP_CONFIG;
    if (!cfg.apiSendImages) return [];
    const all = await window.Images.get(lecture.id);
    const segs = window.Parsers.segments(lecture);
    const allowed = only ? new Set(only.map((i) => segs[i] && segs[i].number)) : null;
    return all
      .filter((im) => !allowed || allowed.has(im.slide))
      .slice(0, cfg.apiMaxImages)
      .map((im) => ({ slide: im.slide, kind: im.kind, mediaType: "image/jpeg", data: im.dataUrl.replace(/^data:image\/jpeg;base64,/, "") }));
  }

  async function request(body) {
    const res = await fetch(window.APP_CONFIG.apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("AI API error: " + res.status);
    return res.json();
  }

  async function generateAll(lecture, lang) {
    const key = lecture.id + "|" + lang;
    if (cache.has(key)) return cache.get(key);
    const body = {
      language: lang,
      modules: ["summary", "cases", "questions"],
      lecture: { title: lecture.title, slides: slidesOf(lecture) },
      images: await imagesOf(lecture),
      questions: { count: window.APP_CONFIG.quizCountFor(window.Parsers.segments(lecture).length) },
    };
    const data = await request(body);
    cache.set(key, data);
    return data;
  }

  window.AIProviders = window.AIProviders || {};
  window.AIProviders.api = {
    async analyze(lecture, lang) {
      const g = await generateAll(lecture, lang);
      const s = g.summary || {};
      return {
        summaryMarkdown: s.markdown || "",
        sections: [],
        pearls: s.pearls || [],
        terms: s.terms || [],
        explanation: [], summary: s.pearls || [], concepts: [],
      };
    },
    async quiz(lecture, lang, opts) {
      const o = opts || {};
      const narrowed = Array.isArray(o.slideIndexes) && o.slideIndexes.length;
      if (!narrowed) {
        const g = await generateAll(lecture, lang);
        return { questions: g.questions || [] };
      }
      const data = await request({
        language: lang,
        modules: ["questions"],
        lecture: { title: lecture.title, slides: slidesOf(lecture, o.slideIndexes) },
        images: await imagesOf(lecture, o.slideIndexes),
        questions: { count: o.count || window.APP_CONFIG.quizCountFor(o.slideIndexes.length) },
      });
      return { questions: data.questions || [] };
    },
    async clinicalCase(lecture, lang) {
      const g = await generateAll(lecture, lang);
      const cases = g.cases || [];
      // Rotate through generated cases on repeated calls.
      const i = (window.AIProviders.api._caseIndex = ((window.AIProviders.api._caseIndex || 0) + 1) % Math.max(1, cases.length));
      const c = cases[i] || cases[0];
      if (!c) throw new Error("No cases generated");
      const presentation = [
        [c.demographics, c.chiefComplaint].filter(Boolean).join(" "),
        [c.hpi, c.vitals].filter(Boolean).join(" "),
        c.exam || "",
      ].filter(Boolean);
      return Object.assign({ title: c.title || "", presentation }, c, { presentation });
    },
    /** Full structured cases for the lecture page (module B). */
    async cases(lecture, lang) {
      const g = await generateAll(lecture, lang);
      return g.cases || [];
    },
  };
})();
