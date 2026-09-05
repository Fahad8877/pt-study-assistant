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
        question: { type: "string" },
        options: { type: "array", items: { type: "string" } },
        answerIndex: { type: "integer" },
        explanation: { type: "string" },
      }, required: ["question", "options", "answerIndex", "explanation"], additionalProperties: false } },
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
  quiz: "Write 6 multiple-choice questions based ONLY on the lecture content, each with 4 options, the index of the correct option, and a short explanation that cites what the lecture says.",
  case: "Write one simple clinical case related to the lecture: a short patient presentation (3 paragraphs), then 4 questions for the student. Mix 'mcq' questions (4 options, answerIndex, feedback) and 'open' questions (modelAnswer plus 5-10 keywords a good answer should contain). For mcq questions set modelAnswer to '' and keywords to []; for open questions set options to [], answerIndex to 0 and feedback to ''.",
};

app.post("/api/ai", async (req, res) => {
  const { task, language, lecture } = req.body || {};
  if (!SCHEMAS[task] || !lecture || !lecture.text) return res.status(400).json({ error: "Bad request" });
  const lang = language === "ar" ? "Arabic" : "English";
  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      system: `You are a study assistant for Master's Physical Therapy students. Use only the provided lecture content. Write all text in ${lang}. Be clear, accurate and concise.`,
      messages: [{ role: "user", content: `${INSTRUCTIONS[task]}\n\nLecture title: ${lecture.title}\n\nLecture content:\n${lecture.text}` }],
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
