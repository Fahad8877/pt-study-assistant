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
      explanation: { type: "array", items: { type: "string" } },
      summary: { type: "array", items: { type: "string" } },
      concepts: { type: "array", items: { type: "object", properties: { title: { type: "string" }, detail: { type: "string" } }, required: ["title", "detail"], additionalProperties: false } },
      terms: { type: "array", items: { type: "object", properties: { term: { type: "string" }, definition: { type: "string" } }, required: ["term", "definition"], additionalProperties: false } },
    },
    required: ["explanation", "summary", "concepts", "terms"],
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
  analyze: "Analyze the lecture for a Master's Physical Therapy student. Return: a simple explanation (3-4 short paragraphs), a summary of the most important points (5-8 bullets), key concepts to remember (4-6, each with a one-sentence detail), and important terms with definitions (6-10).",
  quiz: "Act as an experienced Master's-level Physical Therapy professor and clinical educator. Write multiple-choice questions based ONLY on the provided slides that test understanding and clinical reasoning: clinical application, mechanisms, interpretation of findings, comparing related concepts, clinical decision-making, and applying the content to realistic patient scenarios. Use a short realistic scenario where appropriate (put it in 'scenario', otherwise leave it empty). Do not write fill-in-the-blank questions, do not copy slide sentences verbatim, and do not test pure recall of definitions. Each question has exactly 4 plausible options, answerIndex, a short explanation of why the correct answer is right, and whyOthers: an array aligned with options giving a brief reason each other option is less appropriate (empty string for the correct option). Distribute questions across all the provided slides.",
  case: "Write one simple clinical case related to the lecture: a short patient presentation (3 paragraphs), then 4 questions for the student. Mix 'mcq' questions (4 options, answerIndex, feedback) and 'open' questions (modelAnswer plus 5-10 keywords a good answer should contain). For mcq questions set modelAnswer to '' and keywords to []; for open questions set options to [], answerIndex to 0 and feedback to ''.",
};

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
      system: `You are a study assistant for Master's Physical Therapy students. Use only the provided lecture content. Write all text in ${lang}. Be clear, accurate and concise.`,
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
