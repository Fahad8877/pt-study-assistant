/**
 * PT Study Assistant — AI backend (Claude API, multimodal, three-module generation).
 *
 * Setup (Node.js 18+):
 *   npm install @anthropic-ai/sdk express cors
 *   export ANTHROPIC_API_KEY=sk-ant-...        (or run `ant auth login`)
 *   node server.js
 * Then set aiProvider: "api" in js/config.js (endpoint http://localhost:3000/api/generate).
 *
 * Optional environment:
 *   CLAUDE_MODEL   default "claude-opus-5". Sampling temperature is only accepted by the
 *                  4.6-generation models (claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5);
 *                  on claude-opus-5 / sonnet-5 / fable the API rejects `temperature`, so the
 *                  server applies it only when the chosen model supports it.
 *   PORT           default 3000
 *
 * POST /api/generate
 *   { language: "ar"|"en", modules: ["summary","cases","questions"],
 *     lecture: { title, slides: [{ number, title, markdown, notes, tables }] },
 *     images: [{ slide, kind, mediaType, data }],     // base64 JPEG page renders / figures
 *     questions: { count, slideNumbers } }
 *   -> { summary: { markdown, pearls, terms }, cases: [...], questions: [...] }
 */
const express = require("express");
const cors = require("cors");
const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic();
const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5";
const SUPPORTS_TEMPERATURE = /claude-(opus|sonnet)-4-6|claude-haiku-4-5/.test(MODEL);
const MAX_TOKENS = 16000;            // well above the 4000 minimum; keeps long guides intact
const TEMP_EXTRACTION = 0.2;         // summary + questions (factual extraction)
const TEMP_CASES = 0.3;              // clinical case creation

const app = express();
app.use(cors());
app.use(express.json({ limit: "80mb" })); // page images are sent inline as base64

/* ---------- exact system prompt (embedded verbatim) ---------- */
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

/* ---------- module specifications ---------- */
const LANGUAGE_RULE = {
  ar: "Write explanations in clear Arabic. Every scientific/medical term appears in English inside parentheses right after its Arabic translation, e.g. احتشاء عضلة القلب (Myocardial Infarction).",
  en: "Write in clear professional English. Keep scientific/medical terms precise.",
};

const MODULE_A = `MODULE A — Concise High-Yield Summary (شرح مفهوم وغير مطول)
Return Markdown in "summary.markdown": a clean, structured, non-verbose study summary of the WHOLE document (all slides/pages together, never slide by slide).
- Style: high-yield bullets under clear subheadings; no filler, no long introductions.
- Cover, where the document supports it: Pathophysiology & Etiology; Diagnostic Criteria & Gold-Standard Tests; Clinical Features & Key Symptoms; First-line Treatment & Management Steps; and comparison tables (Markdown tables) for differential diagnoses, syndromes, drug classes, orthoses or scales.
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
- "options": exactly 4 (A–D as plain text without letters) containing ONLY valid medical terms, concepts, values or clinical answers — never a slide heading, section label or layout word; "answerIndex": the correct option.
- "explanation": a detailed rationale for why the correct answer is right.
- "whyOthers": array aligned with options — for each distractor why it is wrong (empty string for the correct one).
- Test mechanism, interpretation, sequencing and decision-making; distractors target common misconceptions; never copy sentences verbatim; distribute items across the whole document.`;

/* ---------- structured output schemas ---------- */
const S = {
  str: { type: "string" },
  strArr: { type: "array", items: { type: "string" } },
};
const CASE_QUESTION = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["mcq", "open"] },
    question: S.str, options: S.strArr, answerIndex: { type: "integer" },
    feedback: S.str, modelAnswer: S.str, keywords: S.strArr,
  },
  required: ["type", "question", "options", "answerIndex", "feedback", "modelAnswer", "keywords"],
  additionalProperties: false,
};
const SCHEMA_SUMMARY_QUESTIONS = {
  type: "object",
  properties: {
    summary: {
      type: "object",
      properties: {
        markdown: S.str, pearls: S.strArr,
        terms: { type: "array", items: { type: "object", properties: { term: S.str, definition: S.str }, required: ["term", "definition"], additionalProperties: false } },
      },
      required: ["markdown", "pearls", "terms"], additionalProperties: false,
    },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: { scenario: S.str, question: S.str, options: S.strArr, answerIndex: { type: "integer" }, explanation: S.str, whyOthers: S.strArr },
        required: ["scenario", "question", "options", "answerIndex", "explanation", "whyOthers"], additionalProperties: false,
      },
    },
  },
  required: ["summary", "questions"], additionalProperties: false,
};
const SCHEMA_CASES = {
  type: "object",
  properties: {
    cases: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: S.str, demographics: S.str, chiefComplaint: S.str, hpi: S.str, vitals: S.str, exam: S.str,
          reasoning: S.strArr, plan: S.strArr, questions: { type: "array", items: CASE_QUESTION },
        },
        required: ["title", "demographics", "chiefComplaint", "hpi", "vitals", "exam", "reasoning", "plan", "questions"],
        additionalProperties: false,
      },
    },
  },
  required: ["cases"], additionalProperties: false,
};

/* ---------- document → multimodal content blocks ---------- */
function documentBlocks(lecture, images) {
  const bySlide = new Map();
  (images || []).forEach((im) => { if (!bySlide.has(im.slide)) bySlide.set(im.slide, []); bySlide.get(im.slide).push(im); });
  const layoutLabels = (lecture.slides || []).filter((s) => s.layoutTitle).map((s) => `"${s.title}" (slide/page ${s.number})`);
  const preface = `# ${lecture.title}\n\nThe document follows, one block per slide/page (title, bullet hierarchy, tables, speaker notes), each followed by its rendered image(s) when available. Treat images as authoritative for tables, diagrams, flowcharts and figures.` +
    (layoutLabels.length ? `\n\nLAYOUT METADATA (structural labels only — NOT medical content, never to be used as terms, findings or answer options): ${layoutLabels.join(", ")}.` : "");
  const blocks = [{ type: "text", text: preface }];
  for (const s of lecture.slides || []) {
    blocks.push({ type: "text", text: s.markdown || (s.layoutTitle ? `## Slide ${s.number} — [layout label: ${s.title}]` : `## ${s.title}`) });
    for (const im of bySlide.get(s.number) || []) {
      blocks.push({ type: "text", text: `[${im.kind === "page" ? "Rendered page" : "Figure"} — slide/page ${s.number}]` });
      blocks.push({ type: "image", source: { type: "base64", media_type: im.mediaType || "image/jpeg", data: im.data } });
    }
  }
  return blocks;
}

async function callClaude({ instructions, docBlocks, schema, temperature }) {
  const params = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: [{ type: "text", text: instructions }, ...docBlocks] }],
    output_config: { format: { type: "json_schema", schema } },
  };
  if (SUPPORTS_TEMPERATURE) params.temperature = temperature;
  const response = await client.messages.create(params);
  if (response.stop_reason === "refusal") throw new Error("Model declined the request");
  if (response.stop_reason === "max_tokens") throw new Error("Output truncated; raise MAX_TOKENS");
  const text = response.content.find((b) => b.type === "text");
  return JSON.parse(text.text);
}

app.get("/health", (req, res) => res.json({ ok: true, model: MODEL, temperatureSupported: SUPPORTS_TEMPERATURE }));

app.post("/api/generate", async (req, res) => {
  const { language, modules, lecture, images, questions } = req.body || {};
  if (!lecture || !Array.isArray(lecture.slides) || !lecture.slides.length) return res.status(400).json({ error: "lecture.slides required" });
  const wanted = new Set(Array.isArray(modules) && modules.length ? modules : ["summary", "cases", "questions"]);
  const langRule = LANGUAGE_RULE[language === "ar" ? "ar" : "en"];
  const count = Math.max(5, Math.min(10, (questions && questions.count) || 8));
  const docBlocks = documentBlocks(lecture, images);

  try {
    const jobs = [];
    // Extraction (summary + questions): factual accuracy.
    if (wanted.has("summary") || wanted.has("questions")) {
      const specs = [wanted.has("summary") ? MODULE_A : "For \"summary\" return markdown \"\", pearls [] and terms [].", wanted.has("questions") ? MODULE_C(count) : "For \"questions\" return an empty array."];
      jobs.push(callClaude({
        instructions: `${langRule}\n\n${specs.join("\n\n")}\n\nReturn JSON only, matching the schema.`,
        docBlocks, schema: SCHEMA_SUMMARY_QUESTIONS, temperature: TEMP_EXTRACTION,
      }).then((r) => ({ summary: r.summary, questions: r.questions })));
    }
    // Case creation.
    if (wanted.has("cases")) {
      jobs.push(callClaude({
        instructions: `${langRule}\n\n${MODULE_B}\n\nReturn JSON only, matching the schema.`,
        docBlocks, schema: SCHEMA_CASES, temperature: TEMP_CASES,
      }).then((r) => ({ cases: r.cases })));
    }
    const parts = await Promise.all(jobs);
    const out = Object.assign({ summary: { markdown: "", pearls: [], terms: [] }, cases: [], questions: [] }, ...parts);
    if (!wanted.has("summary")) delete out.summary;
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AI backend (${MODEL}) listening on http://localhost:${PORT}`));
