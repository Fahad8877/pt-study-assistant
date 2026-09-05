/**
 * Mock AI provider.
 *
 * Produces realistic, lecture-derived study material entirely in the browser
 * using lightweight text analysis (sentence scoring, definition patterns,
 * key-phrase frequency). It returns exactly the JSON shapes a real AI backend
 * should return, so swapping providers requires no UI changes.
 */
(function () {
  const STOP = new Set(("a an the and or but of to in on at for with by from as is are was were be been being " +
    "this that these those it its their his her they them he she we you your our i not no nor so than then " +
    "which who whom whose what when where why how all any both each few more most other some such only own " +
    "same too very can will just should would could may might must shall do does did done has have had having " +
    "into onto over under again further once here there between through during before after above below up down " +
    "out off about also often usually typically generally include includes including such via per within without " +
    "one two three four five first second third e.g i.e etc slide slides lecture objectives objective module master " +
    "learning describe identify outline perform interpret summary").split(/\s+/));

  const PT_DISTRACTORS = [
    "Glasgow Coma Scale", "Apgar score", "Snellen chart", "Doppler ultrasound", "Berg Balance Scale",
    "Modified Ashworth Scale", "Timed Up and Go test", "Oswestry Disability Index", "Borg RPE scale",
    "Thomas test", "Ober test", "Phalen test", "Schober test", "Trendelenburg sign", "Babinski sign",
    "Functional Reach Test", "Six-Minute Walk Test", "Visual Analogue Scale", "Mini-Mental State Examination",
    "Neer impingement test", "Thompson test", "Ottawa ankle rules", "Roos test", "Slump test",
  ];

  const FRAMES = {
    en: {
      explainIntro: (title, c) => `This lecture, "${title}", focuses on ${joinList(c)}.`,
      explainSimple: "In simple terms:",
      explainMain: "The main ideas you should take away are:",
      explainWhy: (c) => `Why it matters for physical therapy practice: understanding ${c} helps you examine patients accurately, choose the right treatment and explain the condition clearly. As you study, connect each concept to assessment, treatment selection and patient education.`,
      explainNoConcept: "Why it matters: connect each point in this lecture to how you would assess and treat a patient in the clinic.",
      conceptDetailFallback: "A recurring idea in this lecture. Review the section where it appears and be ready to explain it in your own words.",
      termFallback: (t) => `A key term in this lecture. It appears in the context: "${t}"`,
      qCloze: "According to the lecture, which term correctly completes this statement?",
      qDefinition: "Which term is being described in the lecture by the following definition?",
      qNumber: "According to the lecture, which value correctly completes this statement?",
      qConcept: "Which of the following is a key concept covered in this lecture?",
      expCloze: (s) => `The lecture states: "${s}"`,
      expDefinition: (t, s) => `The lecture defines ${t} as follows: "${s}"`,
      expConcept: (c) => `"${c}" is a central concept of this lecture. The other options are not covered in this lecture.`,
      caseTitle: (title) => `Clinical case: ${title}`,
      caseP1: (age, sex, occ, c) => `A ${age}-year-old ${sex} who works as ${occ} is referred to the physical therapy clinic. The referral is related to ${c}. The patient reports that the problem started ${onsetEn()} and is now affecting daily activities and work.`,
      caseP2: (s) => `During your initial assessment, your findings are consistent with the following point from the lecture: "${s}"`,
      caseP3: "The patient asks you to explain what is happening and what the physical therapy plan will involve.",
      q1: "Which concept from the lecture is most relevant to this patient's presentation?",
      q1fb: (c, d) => `${c} is the central issue here. ${d}`,
      q2: (c) => `In simple language, explain to the patient what "${c}" means and why it matters for their condition, based on the lecture.`,
      q3: (t) => `The supervising clinician mentions the term "${t}". Which definition matches how the lecture uses it?`,
      q3fb: (t, d) => `In this lecture, ${t} is described as: "${d}"`,
      q4: "Based on the lecture, outline the priorities of your assessment and treatment plan for this patient.",
      openGood: (hits) => `Good answer. You covered important points such as: ${joinList(hits)}. Compare your answer with the model answer below to complete it.`,
      openWeak: "Your answer is missing the key points from the lecture. Read the model answer below, then revisit the summary and key concepts.",
      male: "man", female: "woman",
      occupations: ["a teacher", "a nurse", "an office worker", "a football player", "a construction worker", "a university student", "a retired accountant", "a delivery driver"],
    },
    ar: {
      explainIntro: (title, c) => `تركّز هذه المحاضرة "${title}" على: ${joinList(c, "ar")}.`,
      explainSimple: "بعبارات بسيطة:",
      explainMain: "الأفكار الرئيسية التي يجب أن تخرج بها:",
      explainWhy: (c) => `لماذا هذا مهم في ممارسة العلاج الطبيعي: فهم ${c} يساعدك على فحص المرضى بدقة، واختيار العلاج المناسب، وشرح الحالة بوضوح. أثناء الدراسة اربط كل مفهوم بالتقييم واختيار العلاج وتثقيف المريض.`,
      explainNoConcept: "لماذا هذا مهم: اربط كل نقطة في هذه المحاضرة بكيفية تقييم المريض وعلاجه في العيادة.",
      conceptDetailFallback: "فكرة متكررة في هذه المحاضرة. راجع الجزء الذي وردت فيه وكن مستعدًا لشرحها بأسلوبك.",
      termFallback: (t) => `مصطلح أساسي في هذه المحاضرة. ورد في السياق التالي: "${t}"`,
      qCloze: "وفقًا للمحاضرة، ما المصطلح الذي يكمل هذه العبارة بشكل صحيح؟",
      qDefinition: "ما المصطلح الذي يصفه التعريف التالي في المحاضرة؟",
      qNumber: "وفقًا للمحاضرة، ما القيمة التي تكمل هذه العبارة بشكل صحيح؟",
      qConcept: "أيٌّ مما يلي مفهوم أساسي تناولته هذه المحاضرة؟",
      expCloze: (s) => `تذكر المحاضرة: "${s}"`,
      expDefinition: (t, s) => `تعرّف المحاضرة ${t} كما يلي: "${s}"`,
      expConcept: (c) => `"${c}" مفهوم محوري في هذه المحاضرة. الخيارات الأخرى لم تُذكر في هذه المحاضرة.`,
      caseTitle: (title) => `حالة سريرية: ${title}`,
      caseP1: (age, sex, occ, c) => `${sex} يبلغ من العمر ${age} عامًا، يعمل ${occ}، تمت إحالته إلى عيادة العلاج الطبيعي. ترتبط الإحالة بـ ${c}. يذكر المريض أن المشكلة بدأت ${onsetAr()} وأصبحت تؤثر على الأنشطة اليومية والعمل.`,
      caseP2: (s) => `خلال التقييم الأولي، جاءت نتائجك متوافقة مع النقطة التالية من المحاضرة: "${s}"`,
      caseP3: "يطلب منك المريض أن تشرح له ما يحدث وما الذي ستتضمنه خطة العلاج الطبيعي.",
      q1: "ما المفهوم من المحاضرة الأكثر ارتباطًا بعرض حالة هذا المريض؟",
      q1fb: (c, d) => `${c} هو المحور الأساسي هنا. ${d}`,
      q2: (c) => `اشرح للمريض بلغة بسيطة ما معنى "${c}" ولماذا يهم حالته، استنادًا إلى المحاضرة.`,
      q3: (t) => `يذكر المشرف السريري مصطلح "${t}". أي تعريف يطابق استخدام المحاضرة لهذا المصطلح؟`,
      q3fb: (t, d) => `في هذه المحاضرة يوصف ${t} بأنه: "${d}"`,
      q4: "استنادًا إلى المحاضرة، حدّد أولويات التقييم وخطة العلاج لهذا المريض.",
      openGood: (hits) => `إجابة جيدة. غطّيت نقاطًا مهمة مثل: ${joinList(hits, "ar")}. قارن إجابتك بالإجابة النموذجية أدناه لإكمالها.`,
      openWeak: "إجابتك تفتقد النقاط الأساسية من المحاضرة. اقرأ الإجابة النموذجية أدناه ثم راجع الملخص والمفاهيم الأساسية.",
      male: "رجل", female: "امرأة",
      occupations: ["معلمًا", "ممرضًا", "موظفًا مكتبيًا", "لاعب كرة قدم", "عامل بناء", "طالبًا جامعيًا", "محاسبًا متقاعدًا", "سائق توصيل"],
    },
  };

  function onsetEn() { return pick(["three weeks ago after a sports activity", "gradually over the past two months", "suddenly last week", "six weeks ago and has not improved"]); }
  function onsetAr() { return pick(["قبل ثلاثة أسابيع بعد نشاط رياضي", "تدريجيًا خلال الشهرين الماضيين", "فجأة الأسبوع الماضي", "قبل ستة أسابيع ولم تتحسن"]); }

  /* ---------- text analysis helpers ---------- */

  let seed = 1;
  function rand() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
  function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function hash(str) { let h = 7; for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) % 1000003; return h || 1; }
  function joinList(items, lang) {
    if (!items.length) return "";
    if (items.length === 1) return items[0];
    const sep = lang === "ar" ? " و " : " and ";
    return items.slice(0, -1).join(lang === "ar" ? "، " : ", ") + sep + items[items.length - 1];
  }
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function splitSentences(text) {
    const out = [];
    const seen = new Set();
    text.split(/\n+/).forEach((line) => {
      line.split(/(?<=[.!?])\s+(?=[A-Z"'(])/).forEach((raw) => {
        const s = raw.trim().replace(/\s+/g, " ");
        const key = s.toLowerCase();
        if (s.length < 30 || s.length > 320) return;
        if (!/[a-z]{3}/i.test(s)) return;
        if ((s.match(/[A-Za-z]/g) || []).length / s.length < 0.6) return;
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ text: s, index: out.length });
      });
    });
    return out;
  }

  function words(s) { return s.toLowerCase().match(/[a-z][a-z\-]+/g) || []; }

  function wordFreq(sentences) {
    const f = {};
    sentences.forEach((s) => words(s.text).forEach((w) => { if (!STOP.has(w)) f[w] = (f[w] || 0) + 1; }));
    return f;
  }

  function scoreSentences(sentences, freq) {
    sentences.forEach((s) => {
      const ws = words(s.text).filter((w) => !STOP.has(w));
      const sum = ws.reduce((a, w) => a + (freq[w] || 0), 0);
      s.score = ws.length ? sum / Math.sqrt(ws.length + 4) : 0;
      if (/\d/.test(s.text)) s.score *= 1.1;
    });
  }

  const BAD_TERM_WORDS = /\b(this|it|there|these|those|they|patients?|approximately|about|primary|main|most|common|classic|typical|majority|function|purpose|goal|aim|role|importance|prevalence|incidence|percent|number|first|second|third|phase|step|result|results|example|examples|following|is|are|was|were|be|can|may|should|must|will)\b/i;

  function goodTerm(term) {
    const w = term.trim().split(/\s+/);
    return w.length >= 1 && w.length <= 5 && !/\d/.test(term) && !BAD_TERM_WORDS.test(term) && /[a-z]/.test(term);
  }
  function cleanTerm(term) { return term.replace(/^(the|a|an)\s+/i, "").trim(); }

  function extractDefinitions(sentences) {
    const defs = [];
    const seen = new Set();
    const add = (term, definition, sentence, abbr) => {
      const key = term.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      defs.push({ term, definition, sentence, abbr: !!abbr });
    };
    const re = /^(?:The |A |An )?([A-Za-z][A-Za-z0-9\-]*(?:\s[A-Za-z0-9\-]+){0,4}?)(?:\s\(([A-Z]{2,6})\))?\s(?:is|are)\s(?:defined as\s|the\s|a\s|an\s)?(.{15,})$/;
    const re2 = /^([A-Z][A-Za-z0-9\-\s]{2,50}?)\s?[:–—-]\s(.{40,})$/;
    sentences.forEach((s) => {
      let m = s.text.match(re);
      if (m && goodTerm(m[1])) {
        const term = cleanTerm(m[1]);
        add(cap(term), s.text, s);
        if (m[2]) add(m[2], s.text, s, true);
        return;
      }
      m = s.text.match(re2);
      if (m && goodTerm(m[1]) && m[2].split(/\s+/).length >= 6) add(cap(cleanTerm(m[1])), m[2], s);
    });
    // Abbreviations anywhere: "Magnetic resonance imaging (MRI)"
    sentences.forEach((s) => {
      const re3 = /([A-Z][a-z]+(?:\s[a-z]+){0,4})\s\(([A-Z]{2,6})\)/g;
      let m;
      while ((m = re3.exec(s.text))) {
        if (!seen.has(m[1].toLowerCase()) && !seen.has(m[2].toLowerCase())) add(`${m[1]} (${m[2]})`, s.text, s);
      }
    });
    return defs;
  }

  function extractPhrases(sentences, freq) {
    const bigrams = {};
    const LINK = new Set(["of", "to", "the", "and", "for", "in"]);
    sentences.forEach((s) => {
      const ws = words(s.text);
      for (let i = 0; i < ws.length - 1; i++) {
        if (STOP.has(ws[i])) continue;
        if (!STOP.has(ws[i + 1])) {
          const b = ws[i] + " " + ws[i + 1];
          bigrams[b] = (bigrams[b] || 0) + 1;
        } else if (LINK.has(ws[i + 1]) && ws[i + 2] && !STOP.has(ws[i + 2])) {
          const tri = ws[i] + " " + ws[i + 1] + " " + ws[i + 2];
          bigrams[tri] = (bigrams[tri] || 0) + 1;
        }
      }
    });
    const phrases = Object.entries(bigrams).filter(([, n]) => n >= 2).map(([p, n]) => ({ phrase: p, score: n * 2 }));
    Object.entries(freq).filter(([w, n]) => n >= 3 && w.length > 4).forEach(([w, n]) => phrases.push({ phrase: w, score: n }));
    phrases.sort((a, b) => b.score - a.score);
    // remove unigrams contained in a stronger bigram
    const out = [];
    phrases.forEach((p) => {
      if (out.some((o) => o.phrase.includes(p.phrase) || p.phrase.includes(o.phrase))) return;
      out.push(p);
    });
    return out.slice(0, 12);
  }

  function findSentence(sentences, phrase, exclude) {
    const re = new RegExp("\\b" + esc(phrase) + "\\b", "i");
    const matches = sentences.filter((s) => re.test(s.text) && !(exclude && exclude.has(s.index)));
    matches.sort((a, b) => b.score - a.score);
    return matches[0] || null;
  }

  function displayPhrase(phrase, sentences) {
    // Recover original casing from the lecture text.
    const re = new RegExp("\\b" + esc(phrase) + "\\b", "i");
    for (const s of sentences) { const m = s.text.match(re); if (m) return m[0]; }
    return phrase;
  }

  function analyzeText(lecture) {
    seed = hash(lecture.id || lecture.title || "x");
    const sentences = splitSentences(lecture.text);
    const freq = wordFreq(sentences);
    scoreSentences(sentences, freq);
    const defs = extractDefinitions(sentences);
    const phrases = extractPhrases(sentences, freq);
    const title = lecture.title || "Lecture";

    // Concepts: definitions first (they are explicit), then frequent phrases.
    const concepts = [];
    const used = new Set();
    defs.filter((d) => !d.abbr).forEach((d) => {
      if (concepts.length >= 4) return;
      concepts.push({ title: d.term, detail: d.definition, sentence: d.sentence });
      used.add(d.term.toLowerCase());
    });
    phrases.forEach((p) => {
      if (concepts.length >= 6) return;
      if ([...used].some((u) => u.includes(p.phrase) || p.phrase.includes(u))) return;
      const s = findSentence(sentences, p.phrase);
      const name = displayPhrase(p.phrase, sentences);
      concepts.push({ title: cap(name), detail: s ? s.text : null, sentence: s });
      used.add(p.phrase);
    });

    const summary = sentences.slice().sort((a, b) => b.score - a.score).slice(0, Math.min(7, Math.max(3, Math.round(sentences.length / 5))))
      .sort((a, b) => a.index - b.index);

    return { sentences, freq, defs, phrases, concepts, summary, title };
  }

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- provider methods ---------- */

  async function analyze(lecture, lang) {
    await delay(700 + Math.random() * 500);
    const L = FRAMES[lang] || FRAMES.en;
    const a = analyzeText(lecture);
    const conceptNames = a.concepts.slice(0, 3).map((c) => c.title);

    const explanation = [];
    explanation.push(L.explainIntro(a.title, conceptNames));
    const simple = a.concepts.slice(0, 2).map((c) => c.detail).filter(Boolean);
    if (simple.length) explanation.push(`${L.explainSimple} ${simple.join(" ")}`);
    const main = a.summary.slice(0, 2).map((s) => s.text);
    if (main.length) explanation.push(`${L.explainMain} ${main.join(" ")}`);
    explanation.push(conceptNames.length ? L.explainWhy(conceptNames[0]) : L.explainNoConcept);

    return {
      explanation,
      summary: a.summary.map((s) => s.text),
      concepts: a.concepts.map((c) => ({ title: c.title, detail: c.detail || L.conceptDetailFallback })),
      terms: a.defs.slice(0, 8).map((d) => ({ term: d.term, definition: d.definition })),
    };
  }

  async function quiz(lecture, lang) {
    await delay(700 + Math.random() * 500);
    const L = FRAMES[lang] || FRAMES.en;
    const a = analyzeText(lecture);
    const n = window.APP_CONFIG.quizQuestions || 6;
    const questions = [];
    const usedSentences = new Set();
    const termPool = a.defs.map((d) => d.term).concat(a.concepts.map((c) => c.title))
      .filter((t, i, arr) => arr.findIndex((x) => x.toLowerCase() === t.toLowerCase()) === i);

    function distractors(correct, pool, count) {
      const others = shuffle(pool.filter((p) => p.toLowerCase() !== correct.toLowerCase() && !correct.toLowerCase().includes(p.toLowerCase()) && !p.toLowerCase().includes(correct.toLowerCase())));
      return others.slice(0, count);
    }
    function push(question, correct, wrongs, explanation) {
      if (wrongs.length < 2) return false;
      const options = shuffle([correct].concat(wrongs.slice(0, 3)));
      questions.push({ question, options, answerIndex: options.indexOf(correct), explanation });
      return true;
    }

    // 1) Definition -> term questions
    shuffle(a.defs.filter((d) => !d.abbr)).forEach((d) => {
      if (questions.length >= Math.ceil(n / 2)) return;
      if (usedSentences.has(d.sentence.index)) return;
      const defText = d.definition.replace(new RegExp("\\b" + esc(d.term) + "\\b(\\s\\([A-Z]{2,6}\\))?", "gi"), "____");
      const ok = push(`${L.qDefinition}\n"${defText}"`, d.term, distractors(d.term, termPool, 3), L.expDefinition(d.term, d.definition));
      if (ok) usedSentences.add(d.sentence.index);
    });

    // 2) Numeric cloze questions
    const numeric = a.sentences.filter((s) => /\b\d{1,3}\b/.test(s.text) && !usedSentences.has(s.index)).sort((x, y) => y.score - x.score);
    numeric.forEach((s) => {
      if (questions.length >= n - 2) return;
      const m = s.text.match(/\b(\d{1,3})\b/);
      const val = parseInt(m[1], 10);
      const stem = s.text.replace(m[0], "____");
      const alts = [...new Set([val + Math.max(1, Math.round(val * 0.5)), Math.max(0, val - Math.max(1, Math.round(val * 0.4))), val * 2 + 1, val + 5].filter((v) => v !== val))].map(String);
      if (push(`${L.qNumber}\n"${stem}"`, String(val), alts.slice(0, 3), L.expCloze(s.text))) usedSentences.add(s.index);
    });

    // 3) Term cloze questions from high-scoring sentences
    const clozeSentences = a.sentences.slice().sort((x, y) => y.score - x.score);
    clozeSentences.forEach((s) => {
      if (questions.length >= n - 1) return;
      if (usedSentences.has(s.index)) return;
      const term = termPool.find((t) => new RegExp("\\b" + esc(t) + "\\b", "i").test(s.text) && !s.text.toLowerCase().startsWith(t.toLowerCase()));
      if (!term) return;
      const stem = s.text.replace(new RegExp("\\b" + esc(term) + "\\b(\\s\\([A-Z]{2,6}\\))?", "i"), "____");
      if (push(`${L.qCloze}\n"${stem}"`, term, distractors(term, termPool, 3), L.expCloze(s.text))) usedSentences.add(s.index);
    });

    // 4) Concept recognition (fills remaining slots)
    const lower = lecture.text.toLowerCase();
    const foreign = PT_DISTRACTORS.filter((d) => !lower.includes(d.toLowerCase()));
    shuffle(a.concepts).forEach((c) => {
      if (questions.length >= n) return;
      push(L.qConcept, c.title, shuffle(foreign).slice(0, 3), L.expConcept(c.title));
    });

    return { questions: shuffle(questions).slice(0, n) };
  }

  async function clinicalCase(lecture, lang) {
    await delay(800 + Math.random() * 500);
    const L = FRAMES[lang] || FRAMES.en;
    const a = analyzeText(lecture);
    seed = hash((lecture.id || "") + Date.now().toString());
    const c1 = a.concepts[0] || { title: a.title, detail: a.summary[0] ? a.summary[0].text : "", sentence: null };
    const occIndex = Math.floor(rand() * L.occupations.length);
    const occ = L.occupations[occIndex];
    const ageRange = [[28, 55], [25, 50], [24, 58], [18, 34], [22, 55], [19, 26], [62, 74], [21, 45]][occIndex] || [20, 60];
    const age = ageRange[0] + Math.floor(rand() * (ageRange[1] - ageRange[0]));
    const sex = rand() < 0.5 ? L.male : L.female;
    const findingSentence = (c1.sentence && c1.sentence.text) || (a.summary[0] && a.summary[0].text) || "";

    const presentation = [L.caseP1(age, sex, occ, c1.title), L.caseP2(findingSentence), L.caseP3];
    const questions = [];

    // Q1: concept MCQ
    const otherConcepts = a.concepts.slice(1).map((c) => c.title);
    if (otherConcepts.length >= 2) {
      const options = shuffle([c1.title].concat(shuffle(otherConcepts).slice(0, 3)));
      questions.push({ type: "mcq", question: L.q1, options, answerIndex: options.indexOf(c1.title), feedback: L.q1fb(c1.title, c1.detail || "") });
    }

    // Q2: open explanation
    const related = a.sentences.filter((s) => new RegExp("\\b" + esc(c1.title.split(" ")[0]) + "\\b", "i").test(s.text)).sort((x, y) => y.score - x.score).slice(0, 2).map((s) => s.text);
    const model2 = (related.length ? related : a.summary.slice(0, 2).map((s) => s.text)).join(" ");
    questions.push({ type: "open", question: L.q2(c1.title), modelAnswer: model2, keywords: keywordsFrom(c1.title + " " + model2) });

    // Q3: term -> definition MCQ
    const defs = a.defs.filter((d) => !d.abbr);
    if (defs.length >= 3) {
      const d = pick(defs);
      const wrong = shuffle(defs.filter((x) => x !== d)).slice(0, 3).map((x) => x.definition);
      const options = shuffle([d.definition].concat(wrong));
      questions.push({ type: "mcq", question: L.q3(d.term), options, answerIndex: options.indexOf(d.definition), feedback: L.q3fb(d.term, d.definition) });
    }

    // Q4: open plan
    const actionRe = /\b(assess|assessment|treat|treatment|exercise|phase|test|manage|management|rehabilitation|goal|educat|strength|mobil|stretch|train|program|protocol|precaution|contraindicat)/i;
    const plan = a.sentences.filter((s) => actionRe.test(s.text)).sort((x, y) => y.score - x.score).slice(0, 3).map((s) => s.text);
    const model4 = (plan.length ? plan : a.summary.slice(-2).map((s) => s.text)).join(" ");
    questions.push({ type: "open", question: L.q4, modelAnswer: model4, keywords: keywordsFrom(model4) });

    return { title: L.caseTitle(a.title), presentation, questions };
  }

  function keywordsFrom(text) {
    const seen = new Set();
    return words(text).filter((w) => w.length > 4 && !STOP.has(w) && !seen.has(w) && seen.add(w)).slice(0, 10);
  }

  /** Feedback for open-ended answers (shared with a real provider if it returns keywords). */
  function gradeOpen(answer, question, lang) {
    const L = FRAMES[lang] || FRAMES.en;
    const ans = (answer || "").toLowerCase();
    const hits = (question.keywords || []).filter((k) => ans.includes(k.slice(0, Math.max(4, k.length - 2))));
    return hits.length >= 2 ? L.openGood(hits) : L.openWeak;
  }

  window.AIProviders = window.AIProviders || {};
  window.AIProviders.mock = { analyze, quiz, clinicalCase, gradeOpen };
})();
