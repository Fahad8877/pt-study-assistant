/**
 * Browser AI provider — calls the Claude API directly from the page.
 *
 * Works on a static host (GitHub Pages) without any backend. The user's API key
 * is entered in Settings and stored only in this browser (localStorage). It is
 * sent only to https://api.anthropic.com. Mirrors server-example/server.js:
 * same system prompt, three modules, structured outputs, multimodal input.
 */
(function () {
  const API_URL = "https://api.anthropic.com/v1/messages";
  const MAX_TOKENS = 16000;
  const KEY = "pt.ai.settings";

  const DEFAULTS = { apiKey: "", model: "claude-opus-5", sendImages: true, maxImages: 40 };

  function settings() {
    try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { return Object.assign({}, DEFAULTS); }
  }
  function saveSettings(s) {
    localStorage.setItem(KEY, JSON.stringify(Object.assign({}, settings(), s)));
    failedUntil = 0; // new settings: allow an immediate retry
  }
  function isConfigured() { return !!settings().apiKey; }

  /* ---------- exact system prompt (same as the backend) ---------- */
  const SYSTEM_PROMPT = `You are an elite medical education expert and academic tutor. Your objective is to process the uploaded presentation/document with 100% factual accuracy and output a clear, highly structured, concise learning guide comprising a High-Yield Summary, Clinical Cases, and Practice Questions.

CRITICAL PROCESSING RULES:
1. NO STRUCTURAL OR HEADER HALLUCINATIONS: Structural header words, slide section titles, layout labels, or metadata (e.g., 'Categories', 'Overview', 'Slide 1', 'Introduction', 'Objectives', 'Table of Contents') MUST NEVER be treated as medical diagnoses, clinical findings, or question answer options.
2. MEDICAL GROUNDING: Ground all medical facts, percentages, numbers, dosages, and guidelines strictly in the clinical content of the provided document.
3. CONCISE & HIGH-YIELD: Avoid wordy explanations. Use clear subheadings, bullet points, and comparative tables.
4. BILINGUAL TERMS: Present scientific/medical terms in English inside parentheses right after their Arabic translation.
5. COMPLETE STRUCTURE: Always return the output divided into three distinct, beautifully formatted sections:
   - Section 1: Summary (الملخص المفهوم والمختصر)
   - Section 2: Clinical Cases (الحالات السريرية)
   - Section 3: Practice Questions & Rationales (الأسئلة والحلول الشارحة)`;

  const LANGUAGE_RULE = {
    ar: "Write explanations in clear Arabic. Every scientific/medical term appears in English inside parentheses right after its Arabic translation, e.g. احتشاء عضلة القلب (Myocardial Infarction).",
    en: "Write in clear professional English. Keep scientific/medical terms precise.",
  };

  const MODULE_A = `MODULE A — Concise High-Yield Summary (شرح مفهوم وغير مطول)
Return Markdown in "summary.markdown": a clean, structured, non-verbose study summary of the WHOLE document (all slides/pages together, never slide by slide).
- Style: high-yield bullets under clear subheadings; no filler, no long introductions.
- Cover, where the document supports it: Pathophysiology & Etiology (percentages, causes); Diagnostic Criteria & Gold-Standard Tests; Clinical Features & Key Symptoms; First-line Treatment & Management Steps; and comparison tables (Markdown tables) for differential diagnoses, disease types, syndromes, scales or drug classes.
- Preserve every number, percentage, threshold, dose, scale grade and timeline from the document; reproduce tables and figures' data from the provided images.
- "summary.pearls": 6-10 one-line high-yield points. "summary.terms": 8-15 key terms with precise definitions (bilingual as per the language rule).`;

  const MODULE_B = `MODULE B — Real-World Clinical Cases (حالات سريرية)
Return 2-4 vignettes in "cases", each strictly grounded in the document:
- "demographics" (age, sex, relevant context) and "chiefComplaint" (CC).
- "hpi" (history of present illness), "vitals", and "exam" (relevant physical examination / lab / measurement findings — use the document's tests, scales and values).
- "reasoning": step-by-step clinical reasoning (array of steps) explaining WHY the diagnosis/classification is correct based on the document.
- "plan": step-by-step management plan (array), each step justified by the document.
- "questions": 4 interactive items for a student: mix of "mcq" (4 subtle options, answerIndex, feedback naming the misconception behind each distractor) and "open" (modelAnswer plus 5-10 keywords). For mcq set modelAnswer "" and keywords []; for open set options [], answerIndex 0, feedback "".
Never reference the lecture, slides or document in the case text; write as a clinical record.`;

  const MODULE_C = (count) => `MODULE C — Board-Style Practice Questions (أسئلة مقتبسة من الملف)
Return exactly ${count} multiple-choice questions in "questions", mapped directly to the document:
- "scenario": a short clinical vignette when appropriate (empty for conceptual items); "question": a clear clinical or conceptual stem.
- "options": exactly 4 (plain text without letters) containing ONLY valid medical terms, concepts, values or clinical answers — never a slide heading, section label or layout word; "answerIndex": the correct option.
- "explanation": a detailed rationale for why the correct answer is right.
- "whyOthers": array aligned with options — for each distractor why it is wrong (empty string for the correct one).
- Test mechanism, interpretation, sequencing and decision-making; distractors target common misconceptions; never copy sentences verbatim; distribute items across the whole document.`;

  const S = { str: { type: "string" }, strArr: { type: "array", items: { type: "string" } } };
  const CASE_QUESTION = {
    type: "object",
    properties: { type: { type: "string", enum: ["mcq", "open"] }, question: S.str, options: S.strArr, answerIndex: { type: "integer" }, feedback: S.str, modelAnswer: S.str, keywords: S.strArr },
    required: ["type", "question", "options", "answerIndex", "feedback", "modelAnswer", "keywords"], additionalProperties: false,
  };
  const SCHEMA_SUMMARY_QUESTIONS = {
    type: "object",
    properties: {
      summary: { type: "object", properties: { markdown: S.str, pearls: S.strArr, terms: { type: "array", items: { type: "object", properties: { term: S.str, definition: S.str }, required: ["term", "definition"], additionalProperties: false } } }, required: ["markdown", "pearls", "terms"], additionalProperties: false },
      questions: { type: "array", items: { type: "object", properties: { scenario: S.str, question: S.str, options: S.strArr, answerIndex: { type: "integer" }, explanation: S.str, whyOthers: S.strArr }, required: ["scenario", "question", "options", "answerIndex", "explanation", "whyOthers"], additionalProperties: false } },
    },
    required: ["summary", "questions"], additionalProperties: false,
  };
  const SCHEMA_CASES = {
    type: "object",
    properties: { cases: { type: "array", items: { type: "object", properties: { title: S.str, demographics: S.str, chiefComplaint: S.str, hpi: S.str, vitals: S.str, exam: S.str, reasoning: S.strArr, plan: S.strArr, questions: { type: "array", items: CASE_QUESTION } }, required: ["title", "demographics", "chiefComplaint", "hpi", "vitals", "exam", "reasoning", "plan", "questions"], additionalProperties: false } } },
    required: ["cases"], additionalProperties: false,
  };

  /* ---------- document → content blocks ---------- */
  function slidesOf(lecture, only) {
    return window.Parsers.segments(lecture)
      .filter((s) => !only || only.includes(s.index))
      .map((s) => ({ number: s.number, title: s.title, layoutTitle: !!s.layoutTitle, markdown: s.markdown || `## ${s.title}\n${s.text}` }));
  }
  async function imagesOf(lecture, only) {
    const st = settings();
    if (!st.sendImages) return [];
    const all = await window.Images.get(lecture.id);
    const segs = window.Parsers.segments(lecture);
    const allowed = only ? new Set(only.map((i) => segs[i] && segs[i].number)) : null;
    return all.filter((im) => !allowed || allowed.has(im.slide)).slice(0, st.maxImages)
      .map((im) => ({ slide: im.slide, kind: im.kind, data: im.dataUrl.replace(/^data:image\/jpeg;base64,/, "") }));
  }
  function documentBlocks(title, slides, images) {
    const bySlide = new Map();
    images.forEach((im) => { if (!bySlide.has(im.slide)) bySlide.set(im.slide, []); bySlide.get(im.slide).push(im); });
    const layoutLabels = slides.filter((s) => s.layoutTitle).map((s) => `"${s.title}" (slide/page ${s.number})`);
    const preface = `# ${title}\n\nThe document follows, one block per slide/page (title, bullet hierarchy, tables, speaker notes), each followed by its rendered image(s) when available. Treat images as authoritative for tables, diagrams, flowcharts and figures.` +
      (layoutLabels.length ? `\n\nLAYOUT METADATA (structural labels only — NOT medical content, never to be used as terms, findings or answer options): ${layoutLabels.join(", ")}.` : "");
    const blocks = [{ type: "text", text: preface }];
    slides.forEach((s) => {
      blocks.push({ type: "text", text: s.markdown });
      (bySlide.get(s.number) || []).forEach((im) => {
        blocks.push({ type: "text", text: `[${im.kind === "page" ? "Rendered page" : "Figure"} — slide/page ${s.number}]` });
        blocks.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: im.data } });
      });
    });
    return blocks;
  }

  async function callClaude(instructions, docBlocks, schema) {
    const st = settings();
    const supportsTemperature = /claude-(opus|sonnet)-4-6|claude-haiku-4-5/.test(st.model);
    const body = {
      model: st.model,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: [{ type: "text", text: instructions }].concat(docBlocks) }],
      output_config: { format: { type: "json_schema", schema } },
    };
    if (supportsTemperature) body.temperature = /MODULE B/.test(instructions) ? 0.3 : 0.2;
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": st.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json()).error.message; } catch (e) { /* ignore */ }
      const err = new Error(`AI request failed (${res.status})${detail ? ": " + detail : ""}`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    if (data.stop_reason === "refusal") throw new Error("The model declined this request.");
    if (data.stop_reason === "max_tokens") throw new Error("The answer was cut off (max_tokens).");
    const text = (data.content || []).find((b) => b.type === "text");
    return JSON.parse(text.text);
  }

  /* ---------- generation (cached per lecture + language) ---------- */
  const cache = new Map();
  const listeners = new Set();
  function notify(state) { listeners.forEach((fn) => { try { fn(state); } catch (e) { /* ignore */ } }); }

  let failedUntil = 0;
  let lastError = null;
  async function generateAll(lecture, lang) {
    const key = lecture.id + "|" + lang + "|" + settings().model;
    if (cache.has(key)) return cache.get(key);
    if (Date.now() < failedUntil) throw lastError; // avoid hammering the API after a failure
    const langRule = LANGUAGE_RULE[lang === "ar" ? "ar" : "en"];
    const slides = slidesOf(lecture);
    const docBlocks = documentBlocks(lecture.title, slides, await imagesOf(lecture));
    const count = Math.max(5, Math.min(10, window.APP_CONFIG.quizCountFor(slides.length)));
    notify({ phase: "generating" });
    const p = Promise.all([
      callClaude(`${langRule}\n\n${MODULE_A}\n\n${MODULE_C(count)}\n\nReturn JSON only, matching the schema.`, docBlocks, SCHEMA_SUMMARY_QUESTIONS),
      callClaude(`${langRule}\n\n${MODULE_B}\n\nReturn JSON only, matching the schema.`, docBlocks, SCHEMA_CASES),
    ]).then(([a, b]) => ({ summary: a.summary, questions: a.questions, cases: b.cases }));
    cache.set(key, p);
    try { const r = await p; notify({ phase: "done" }); return r; }
    catch (err) { cache.delete(key); failedUntil = Date.now() + 60000; lastError = err; notify({ phase: "error", error: err }); throw err; }
  }

  window.AIProviders = window.AIProviders || {};
  window.AIProviders.browser = {
    settings, saveSettings, isConfigured,
    onProgress: (fn) => listeners.add(fn),
    async testConnection() {
      const st = settings();
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": st.apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: st.model, max_tokens: 16, messages: [{ role: "user", content: "Reply with OK." }] }),
      });
      if (!res.ok) { let d = ""; try { d = (await res.json()).error.message; } catch (e) { /* ignore */ } throw new Error(`${res.status}${d ? ": " + d : ""}`); }
      return true;
    },
    async analyze(lecture, lang) {
      const g = await generateAll(lecture, lang);
      const s = g.summary || {};
      return { summaryMarkdown: s.markdown || "", sections: [], pearls: s.pearls || [], terms: s.terms || [], explanation: [], summary: s.pearls || [], concepts: [] };
    },
    async quiz(lecture, lang, opts) {
      const o = opts || {};
      if (!(Array.isArray(o.slideIndexes) && o.slideIndexes.length)) {
        const g = await generateAll(lecture, lang);
        return { questions: g.questions || [] };
      }
      const langRule = LANGUAGE_RULE[lang === "ar" ? "ar" : "en"];
      const slides = slidesOf(lecture, o.slideIndexes);
      const docBlocks = documentBlocks(lecture.title, slides, await imagesOf(lecture, o.slideIndexes));
      const count = Math.max(5, Math.min(10, o.count || window.APP_CONFIG.quizCountFor(slides.length)));
      const r = await callClaude(`${langRule}\n\nFor "summary" return markdown "", pearls [] and terms [].\n\n${MODULE_C(count)}\n\nReturn JSON only, matching the schema.`, docBlocks, SCHEMA_SUMMARY_QUESTIONS);
      return { questions: r.questions || [] };
    },
    async clinicalCase(lecture, lang) {
      const g = await generateAll(lecture, lang);
      const cases = g.cases || [];
      if (!cases.length) throw new Error("No cases generated");
      const i = (this._caseIndex = ((this._caseIndex || 0) + 1) % cases.length);
      const c = cases[i];
      const presentation = [[c.demographics, c.chiefComplaint].filter(Boolean).join(" "), [c.hpi, c.vitals].filter(Boolean).join(" "), c.exam || ""].filter(Boolean);
      return Object.assign({}, c, { presentation });
    },
  };
})();
