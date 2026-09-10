/**
 * Example backend for connecting the PT Study Assistant to the real Claude API.
 *
 * Not used by the prototype by default (the app runs fully in the browser with
 * mock responses). To enable it:
 *
 *   1. Install Node.js 18+ and run, inside this folder:
 *        npm install @anthropic-ai/sdk express cors
 *   2. Export your key:  ANTHROPIC_API_KEY=sk-ant-...   (or run `ant auth login`)
 *   3. Start:            node server.js
 *   4. In js/config.js set  aiProvider: "api"  and keep apiEndpoint at
 *      http://localhost:3000/api/ai
 *
 * The endpoint accepts { task, language, lecture: { title, text } } and returns
 * JSON in exactly the shape js/ai/api.js documents, using structured outputs
 * so the response always matches the schema.
 */
const express = require("express");
const cors = require("cors");
const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic();
const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

const SCHEMAS = {
  analyze: {
    type: "object",
    properties: {
      sections: { type: "array", items: { type: "object", properties: {
        key: { type: "string", enum: ["overview", "mechanisms", "assessment", "management"] },
        title: { type: "string" },
        lead: { type: "string" },
        paragraphs: { type: "array", items: { type: "string" } },
      }, required: ["key", "title", "lead", "paragraphs"], additionalProperties: false } },
      pearls: { type: "array", items: { type: "string" } },
      explanation: { type: "array", items: { type: "string" } },
      summary: { type: "array", items: { type: "string" } },
      concepts: { type: "array", items: { type: "object", properties: { title: { type: "string" }, detail: { type: "string" } }, required: ["title", "detail"], additionalProperties: false } },
      terms: { type: "array", items: { type: "object", properties: { term: { type: "string" }, definition: { type: "string" } }, required: ["term", "definition"], additionalProperties: false } },
    },
    required: ["sections", "pearls", "explanation", "summary", "concepts", "terms"],
    additionalProperties: false,
  },
  quiz: {
    type: "object",
    properties: {
      questions: { type: "array", items: { type: "object", properties: {
        scenario: { type: "string" },
        question: { type: "string" },
        options: { type: "array", items: { type: "string" } },
        answerIndex: { type: "integer" },
        explanation: { type: "string" },
        whyOthers: { type: "array", items: { type: "string" } },
      }, required: ["scenario", "question", "options", "answerIndex", "explanation", "whyOthers"], additionalProperties: false } },
    },
    required: ["questions"],
    additionalProperties: false,
  },
  case: {
    type: "object",
    properties: {
      title: { type: "string" },
      presentation: { type: "array", items: { type: "string" } },
      questions: { type: "array", items: { type: "object", properties: {
        type: { type: "string", enum: ["mcq", "open"] },
        question: { type: "string" },
        options: { type: "array", items: { type: "string" } },
        answerIndex: { type: "integer" },
        feedback: { type: "string" },
        modelAnswer: { type: "string" },
        keywords: { type: "array", items: { type: "string" } },
      }, required: ["type", "question", "options", "answerIndex", "feedback", "modelAnswer", "keywords"], additionalProperties: false } },
    },
    required: ["title", "presentation", "questions"],
    additionalProperties: false,
  },
};

const INSTRUCTIONS = {
  analyze: `Write as a Senior Physical Therapy Specialist and Professor synthesising the ENTIRE document as one body of knowledge (never page by page, never "slide 3 says").
- 'sections': exactly four, in this order and with these keys: overview (clinical picture, definitions, epidemiology, scope), mechanisms (pathophysiology, biomechanics, causal chains that explain the presentation), assessment (examination, tests and measures and how findings are interpreted against the mechanism), management (interventions, precautions, contraindications and the staged, criteria-based progression). Each section has a title, a one-sentence expert 'lead' stating the clinical principle, and 2-4 paragraphs of dense professional prose that connect facts into reasoning.
- 'pearls': 6-10 one-line clinical pearls a specialist would want a Master's student to carry into the clinic.
- 'terms': 6-12 key terms with precise definitions. 'concepts': 4-6 core entities with a one-sentence detail. 'summary': 5-8 key points. 'explanation': a 3-paragraph plain-language version for a student.
- Tone: authoritative, precise, domain-expert terminology. Never reference the lecture, slides, text or source; write from expertise, grounded only in the provided content.`,
  quiz: `Write a rigorous board-style assessment. Every item must evaluate mastery, not recall.

CONTENT SCOPE
- Ground every item in the provided material only. Do not introduce facts, values or recommendations that the material does not support.
- Distribute items across all provided slides so later slides are covered as much as early ones.

RIGOR AND DEPTH (each item targets one of these; use all of them across the set)
- Mechanism: why a response, sign or outcome occurs (pathophysiology, biomechanics, physiology).
- Sequencing and progression: what must be achieved before advancing, what comes next and why.
- Decision-making: the most appropriate next step, intervention, precaution or contraindication for a specific patient.
- Interpretation: what a measured value, test result or observed response means for management.
- Discrimination: which of several closely related entities, tests or interventions fits the situation.

SCENARIO REQUIREMENT
- At least two thirds of the items open with a short, realistic clinical vignette in 'scenario' (age, relevant history, key findings, stage of care). Leave 'scenario' empty only for pure mechanism items.

TONE AND PHRASING
- Write as a domain expert examining a Master's-level clinician: authoritative, precise, professional terminology.
- NEVER write "the lecture", "the slide", "the slides", "the text", "the material", "the concept", "according to", "as presented" or any similar reference to the source. The reader must not be able to tell that a source document exists.
- Never use stems such as "Which concept is most relevant to this patient?" or "Which of the following is mentioned?". Phrase stems as direct clinical evaluations, for example:
  * "Given the patient's presentation and examination findings, what is the most appropriate next step in management?"
  * "Which underlying pathophysiological mechanism best accounts for the observed response?"
  * "Which criterion must be satisfied before this patient progresses to the next phase?"
  * "Which examination finding most strongly supports the working diagnosis?"
- No fill-in-the-blank, no true/false, no "all of the above", no negatively phrased stems ("Which is NOT...").

OPTIONS
- Exactly 4 options of similar length and grammatical form; exactly one is defensible as best.
- Never copy sentences from the source verbatim into options; paraphrase in expert language.
- Each distractor must target a specific, common misconception (reversed direction, wrong phase, confused related entity, correct action at the wrong time, right test for the wrong structure, threshold misapplied). No option may be obviously wrong or unrelated to the domain.

EXPLANATIONS
- 'explanation': two to four sentences giving the mechanism or reasoning that makes the correct option best.
- 'whyOthers': array aligned with 'options'; for each distractor one sentence naming the misconception it represents and why it fails here; empty string for the correct option.
- Explanations follow the same tone rules: no references to a lecture, slide or text.`,
  case: `Write one realistic clinical case for a Master's-level physical therapy clinician, grounded only in the provided material.
- 'presentation': three short paragraphs (history and referral; examination findings and relevant measures; the clinical question the clinician must resolve). Write as a case record, never as a summary of a document.
- 'questions': four items that require reasoning through the case: mechanism behind the findings, interpretation of a measure, the most appropriate next step, and prioritisation of the plan. Mix 'mcq' (4 subtle options, answerIndex, feedback naming the misconception behind each distractor) and 'open' (modelAnswer plus 5-10 keywords a strong answer should contain).
- Tone: authoritative, professional, domain-expert terminology. NEVER mention a lecture, slide, text or source.
- For mcq questions set modelAnswer to '' and keywords to []; for open questions set options to [], answerIndex to 0 and feedback to ''.`,
};

const QUIZ_SYSTEM = (lang) => `You are a senior Physical Therapy professor and board examiner writing assessment items for Master's-level clinicians. Your items are known for testing clinical reasoning: mechanism, sequencing, decision-making and interpretation in realistic scenarios. You never reveal or reference the source material; you write as if examining from expertise. Use only the provided content as the basis of truth. Write all text in ${lang}.`;

app.post("/api/ai", async (req, res) => {
  const { task, language, lecture, quiz } = req.body || {};
  if (!SCHEMAS[task] || !lecture || !lecture.text) return res.status(400).json({ error: "Bad request" });
  const lang = language === "ar" ? "Arabic" : "English";
  // For quizzes the app sends only the selected slides and the desired question count.
  let content = `Lecture content:\n${lecture.text}`;
  let instruction = INSTRUCTIONS[task];
  if (task === "quiz" && quiz && Array.isArray(quiz.slides) && quiz.slides.length) {
    content = "Selected slides:\n" + quiz.slides.map((s) => `--- Slide ${s.number} ---\n${s.text}`).join("\n\n");
    instruction += ` Write exactly ${quiz.count || 6} questions.`;
  }
  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      system: task === "quiz" || task === "case"
        ? QUIZ_SYSTEM(lang)
        : `You are a study assistant for Master's Physical Therapy students. Use only the provided lecture content. Write all text in ${lang}. Be clear, accurate and concise.`,
      messages: [{ role: "user", content: `${instruction}\n\nLecture title: ${lecture.title}\n\n${content}` }],
      output_config: { format: { type: "json_schema", schema: SCHEMAS[task] } },
    });
    if (response.stop_reason === "refusal") return res.status(502).json({ error: "Model declined the request" });
    const text = response.content.find((b) => b.type === "text");
    res.json(JSON.parse(text.text));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI request failed" });
  }
});

app.listen(3000, () => console.log("AI backend listening on http://localhost:3000"));
