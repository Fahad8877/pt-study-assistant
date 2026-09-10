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

  /** Splits the chosen segments (slides/pages) into sentences tagged with their segment index. */
  function splitSentences(segments, chosen) {
    const out = [];
    const seen = new Set();
    chosen.forEach((segIndex) => {
      const seg = segments[segIndex];
      if (!seg) return;
      seg.text.split(/\n+/).forEach((line) => {
        line.split(/(?<=[.!?])\s+(?=[A-Z"'(])/).forEach((raw) => {
          const s = raw.trim().replace(/\s+/g, " ");
          const key = s.toLowerCase();
          if (s.length < 30 || s.length > 320) return;
          if (!/[a-z]{3}/i.test(s)) return;
          if ((s.match(/[A-Za-z]/g) || []).length / s.length < 0.6) return;
          if (seen.has(key)) return;
          seen.add(key);
          out.push({ text: s, index: out.length, seg: segIndex });
        });
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

  function analyzeText(lecture, segIndexes) {
    seed = hash(lecture.id || lecture.title || "x");
    const segments = window.Parsers.segments(lecture);
    const chosen = Array.isArray(segIndexes) && segIndexes.length ? segIndexes.filter((i) => segments[i]) : segments.map((_, i) => i);
    const sentences = splitSentences(segments, chosen);
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

  /* ---------- quiz generation (clinical reasoning oriented) ----------
   * Questions are built from relationships found in the selected slides:
   *   why      – mechanism / rationale ("... because ...")
   *   effect   – consequence ("... leads to / results in ...")
   *   sequence – progression through phases or stages
   *   decision – clinical decision-making (should / avoid / recommended ...)
   *   match    – distinguishing related concepts (correct vs mismatched pairs)
   *   threshold– interpreting a measured value against a criterion
   *   statement– identifying the correct statement among altered ones
   *   term     – labelling a described finding (used only when little else exists)
   * Distractors are always derived from the same slides (other reasons, other
   * phases, mismatched pairs, or statements with a key concept reversed).
   */
  const QUIZ_FRAMES = {
    en: {
      qWhy: (x) => `According to the lecture, why ${x}?`,
      qEffect: (x) => `According to the lecture, what follows from this: "${x}"?`,
      qDecision: "You are planning management for a patient with the condition discussed in this lecture. Which of the following decisions is consistent with the lecture?",
      qMatch: "Which of the following correctly pairs a concept with its description, as presented in the lecture?",
      qThreshold: (v, unit) => `A patient is assessed against the criterion described above. The measured value is ${v} ${unit}. What is the correct interpretation?`.replace(/\s+\./, "."),
      qSequence: (phase, focus) => `A patient has completed ${phase}, which the lecture describes as: "${focus}". What should the next phase focus on?`,
      qStatement: "Which of the following statements is correct according to the lecture?",
      qStatementAbout: (subject) => `Which statement about ${subject} is correct according to the lecture?`,
      qTerm: (desc) => `A clinical note describes the following finding: "${desc}". Which term from the lecture correctly labels it?`,
      expCorrect: (s) => `Correct. The lecture states: "${s}"`,
      expWhy: (x, y) => `Correct. The lecture explains that ${x} because ${y}.`,
      expSequence: (phase, s) => `Correct. The lecture describes ${phase} as: "${s}"`,
      expMatch: (term, desc) => `Correct. The lecture describes ${term} as: "${desc}"`,
      expThreshold: (v, unit, n, met) => `${met ? "The criterion is met" : "The criterion is not met"}: the measured value (${v} ${unit}) is ${met ? "on the right side of" : "outside"} the threshold of ${n} ${unit} given in the lecture.`.replace(/\s+\)/g, ")").replace(/\s+\./g, "."),
      whyAltered: (orig) => `This reverses what the lecture says: "${orig}"`,
      whyOtherReason: (x) => `This is the rationale the lecture gives for a different point: "${x}"`,
      whyMismatch: (term, desc) => `${term} is actually described as: "${desc}"`,
      whyPhase: (phase) => `This is the focus of ${phase}, not of the next phase.`,
      whyThresholdVerdict: (v, n, unit) => `The verdict is wrong: compare ${v} ${unit} with the threshold of ${n} ${unit}.`.replace(/\s+\./g, "."),
      whyThresholdDirection: (phrase) => `The direction of the criterion is wrong; the lecture says "${phrase}".`,
      whyThresholdNumber: (n, unit) => `The threshold in the lecture is ${n} ${unit}, not this value.`.replace(/\s+,/g, ","),
      whyOtherTerm: (term, desc) => `${term} refers to a different finding: "${desc}"`,
      optMet: (op, n, unit) => `The criterion is met, because the lecture requires ${op} ${n} ${unit}`.trim(),
      optNotMet: (op, n, unit) => `The criterion is not met, because the lecture requires ${op} ${n} ${unit}`.trim(),
      atLeast: "at least", atMost: "at most",
      phaseWord: (label) => label,
    },
    ar: {
      qWhy: (x) => `وفقًا للمحاضرة، لماذا ${x}؟`,
      qEffect: (x) => `وفقًا للمحاضرة، ما الذي يترتب على ما يلي: "${x}"؟`,
      qDecision: "أنت تخطط لعلاج مريض يعاني من الحالة التي تناولتها هذه المحاضرة. أيٌّ من القرارات التالية يتوافق مع المحاضرة؟",
      qMatch: "أيٌّ مما يلي يربط المفهوم بوصفه الصحيح كما ورد في المحاضرة؟",
      qThreshold: (v, unit) => `تم تقييم مريض وفق المعيار الموضح أعلاه. القيمة المقاسة هي ${v} ${unit}. ما التفسير الصحيح؟`,
      qSequence: (phase, focus) => `أكمل مريض ${phase}، والتي تصفها المحاضرة بأنها: "${focus}". على ماذا يجب أن تركز المرحلة التالية؟`,
      qStatement: "أيٌّ من العبارات التالية صحيحة وفقًا للمحاضرة؟",
      qStatementAbout: (subject) => `أي عبارة بخصوص ${subject} صحيحة وفقًا للمحاضرة؟`,
      qTerm: (desc) => `يصف تقرير سريري النتيجة التالية: "${desc}". ما المصطلح من المحاضرة الذي يصفها بشكل صحيح؟`,
      expCorrect: (s) => `إجابة صحيحة. تذكر المحاضرة: "${s}"`,
      expWhy: (x, y) => `إجابة صحيحة. توضح المحاضرة أن ${x} لأن ${y}.`,
      expSequence: (phase, s) => `إجابة صحيحة. تصف المحاضرة ${phase} بأنها: "${s}"`,
      expMatch: (term, desc) => `إجابة صحيحة. تصف المحاضرة ${term} بأنه: "${desc}"`,
      expThreshold: (v, unit, n, met) => `${met ? "المعيار متحقق" : "المعيار غير متحقق"}: القيمة المقاسة (${v} ${unit}) ${met ? "تقع ضمن" : "تقع خارج"} الحد البالغ ${n} ${unit} المذكور في المحاضرة.`,
      whyAltered: (orig) => `هذا يعكس ما تقوله المحاضرة: "${orig}"`,
      whyOtherReason: (x) => `هذا هو التعليل الذي تقدمه المحاضرة لنقطة مختلفة: "${x}"`,
      whyMismatch: (term, desc) => `${term} يوصف في الواقع بأنه: "${desc}"`,
      whyPhase: (phase) => `هذا هو تركيز ${phase} وليس المرحلة التالية.`,
      whyThresholdVerdict: (v, n, unit) => `الحكم خاطئ: قارن ${v} ${unit} بالحد البالغ ${n} ${unit}.`,
      whyThresholdDirection: (phrase) => `اتجاه المعيار خاطئ؛ تقول المحاضرة "${phrase}".`,
      whyThresholdNumber: (n, unit) => `الحد المذكور في المحاضرة هو ${n} ${unit} وليس هذه القيمة.`,
      whyOtherTerm: (term, desc) => `${term} يشير إلى نتيجة مختلفة: "${desc}"`,
      optMet: (op, n, unit) => `المعيار متحقق، لأن المحاضرة تشترط ${op} ${n} ${unit}`.trim(),
      optNotMet: (op, n, unit) => `المعيار غير متحقق، لأن المحاضرة تشترط ${op} ${n} ${unit}`.trim(),
      atLeast: "على الأقل", atMost: "على الأكثر",
      phaseWord: (label) => label,
    },
  };

  const NUM_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
  const ANTONYM_PAIRS = [
    ["should be avoided", "is recommended"], ["should not", "should"], ["not recommended", "recommended"], ["non-contact", "contact"],
    ["at least", "at most"], ["intra-articular", "extra-articular"], ["closed kinetic chain", "open kinetic chain"],
    ["anterior", "posterior"], ["medial", "lateral"], ["internal", "external"], ["flexion", "extension"], ["increase", "decrease"],
    ["increases", "decreases"], ["increased", "decreased"], ["more", "less"], ["higher", "lower"], ["greater", "smaller"],
    ["before", "after"], ["early", "late"], ["proximal", "distal"], ["superior", "inferior"], ["maximum", "minimum"],
    ["concentric", "eccentric"], ["sensitive", "specific"], ["acute", "chronic"], ["above", "below"], ["most", "least"],
    ["preferred", "avoided"], ["contraindicated", "indicated"], ["ipsilateral", "contralateral"], ["passive", "active"],
    ["static", "dynamic"], ["inward", "outward"], ["resist", "allow"], ["prevents", "causes"], ["reduce", "increase"],
    ["reduces", "increases"], ["improves", "worsens"], ["weakness", "strength"], ["limited", "excessive"], ["inhibition", "facilitation"],
    ["first", "last"], ["primary", "secondary"], ["highly", "poorly"], ["appropriate", "inappropriate"], ["stability", "instability"],
  ];
  const ANTONYMS = ANTONYM_PAIRS.concat(ANTONYM_PAIRS.map(([a, b]) => [b, a])).sort((x, y) => y[0].length - x[0].length);
  const OBJECTIVE_RE = /^(describe|identify|perform|outline|explain|list|discuss|understand|define|recognize|recognise|compare|apply|learning objectives?|objectives?)\b/i;
  const FACT_RE = /\b(is|are|was|were|has|have|should|can|may|must|require[sd]?|provide[sd]?|include[sd]?|focus(?:es)?|occur[s]?|develop[s]?|report|describe[sd]?|reproduce[sd]?|assess(?:es)?|performed|recommended|preferred|prevent[s]?|resist[s]?|limit[s]?|run[s]?|introduce[sd]?|compare[sd]?|used|avoided|appropriate|places|produce[s]?|decreases|increases)\b/i;
  const CAUSE_RE = /\b(because|partly due to|due to|since|as a result of|caused by|so that|in order to)\b/i;
  const EFFECT_RE = /\b(leads to|results in|resulting in|which allows|allowing)\b/i;
  const DECISION_RE = /\b(should|should not|avoid|avoided|recommended|not recommended|preferred|appropriate|contraindicated|indicated|must|required|requires|is used|are used|generally)\b/i;
  const THRESH_RE = /\b(at least|a minimum of|minimum of|more than|greater than|above|over|not before|at most|less than|below|within|no more than|a maximum of|maximum of)\s+(?:the\s+)?(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(percent|%|degrees|months|weeks|days|hours|years|repetitions|seconds|minutes|kg|cm|mm|times)?/i;
  const PHASE_RE = /\b(phase|stage|step|week|grade|level)\s+(one|two|three|four|five|six|\d)\b/i;

  function lowerFirst(s) { return /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
  function stripEnd(s) { return s.replace(/[.\s]+$/, ""); }
  function shorten(s, max) { return s.length <= max ? s : s.slice(0, max).replace(/\s+\S*$/, "") + "…"; }

  /** All distinct plausible-but-wrong versions of a statement, each reversing one key concept or number. */
  function alterAll(text) {
    const out = [];
    const seen = new Set([text.toLowerCase()]);
    for (const [from, to] of ANTONYMS) {
      const re = new RegExp("\\b" + esc(from) + "\\b", "i");
      const m = text.match(re);
      if (!m) continue;
      const rep = /^[A-Z]/.test(m[0]) ? cap(to) : to;
      const altered = text.replace(re, rep);
      if (seen.has(altered.toLowerCase())) continue;
      seen.add(altered.toLowerCase());
      out.push({ text: altered, from: m[0], to: rep });
    }
    const nm = text.match(/\b(\d{1,3})\b(\s*(?:percent|%))?/);
    if (nm) {
      const v = parseInt(nm[1], 10);
      const isPercent = !!nm[2];
      let nv;
      if (v < 10) nv = v + 2;
      else if (isPercent || rand() < 0.5) nv = Math.max(1, Math.round(v * 0.6));
      else nv = Math.round(v * 1.5);
      const altered = text.replace(new RegExp("\\b" + nm[1] + "\\b"), String(nv));
      if (!seen.has(altered.toLowerCase())) out.push({ text: altered, from: nm[1], to: String(nv) });
    }
    return out;
  }
  /** One plausible but wrong version of a statement (first available alteration). */
  function alterStatement(text) { return alterAll(text)[0] || null; }
  /** The subject of a statement (text before its main verb), if it is short enough to name. */
  function subjectOf(text) {
    const m = text.match(FACT_RE);
    if (!m || m.index < 4) return null;
    const subj = text.slice(0, m.index).trim().replace(/[,;:]$/, "");
    if (/\d/.test(subj) || /^(approximately|about|most|many|some|several|patients?|it|this|these|those|there)\b/i.test(subj)) return null;
    return subj.length >= 4 && subj.length <= 70 && subj.split(/\s+/).length <= 10 ? lowerFirst(subj) : null;
  }

  function buildQuizCandidates(a, L) {
    const cands = [];
    const facts = a.sentences.filter((s) => /[.!?]$/.test(s.text) && FACT_RE.test(s.text) && !OBJECTIVE_RE.test(s.text));
    const add = (tpl, s, question, scenario, correct, wrongs, explanation) => {
      const uniq = [];
      wrongs.forEach((w) => { if (w && w.text && w.text.toLowerCase() !== correct.toLowerCase() && !uniq.some((u) => u.text.toLowerCase() === w.text.toLowerCase())) uniq.push(w); });
      if (uniq.length < 3) return;
      cands.push({ tpl, seg: s.seg, sIdx: s.index, question, scenario: scenario || "", correct, wrongs: uniq.slice(0, 3), explanation });
    };
    /** Wrong statements derived from other facts (each reversed on one key concept). */
    const alteredFrom = (excludeIdx, count, prefer) => {
      const out = [];
      const pool = prefer ? prefer.concat(facts.filter((f) => !prefer.includes(f))) : shuffle(facts);
      pool.forEach((s) => {
        if (out.length >= count || excludeIdx.has(s.index)) return;
        const alt = alterStatement(s.text);
        if (alt) out.push({ text: stripEnd(alt.text), why: L.whyAltered(s.text), src: s.index });
      });
      return out;
    };

    // why / effect: rationale and consequences
    const reasons = [];
    const effects = [];
    facts.forEach((s) => {
      let m = s.text.match(CAUSE_RE);
      if (m && m.index >= 15) {
        const x = stripEnd(s.text.slice(0, m.index)).replace(/[,;]\s*$/, "");
        const y = stripEnd(s.text.slice(m.index + m[0].length)).trim();
        if (x.length >= 10 && y.length >= 10) reasons.push({ s, x, y });
        return;
      }
      m = s.text.match(EFFECT_RE);
      if (m && m.index >= 15) {
        const x = stripEnd(s.text.slice(0, m.index)).replace(/[,;]\s*$/, "");
        const y = stripEnd(s.text.slice(m.index + m[0].length)).trim();
        if (x.length >= 10 && y.length >= 10) effects.push({ s, x, y });
      }
    });
    const clausePool = reasons.concat(effects);
    reasons.forEach((r) => {
      let wrongs = shuffle(clausePool.filter((o) => o !== r)).slice(0, 3).map((o) => ({ text: o.y, why: L.whyOtherReason(o.x) }));
      const alt = alterStatement(r.y);
      if (alt) wrongs = [{ text: alt.text, why: L.whyAltered(r.s.text) }].concat(wrongs);
      add("why", r.s, L.qWhy(lowerFirst(r.x)), "", r.y, wrongs, L.expCorrect(r.s.text));
    });
    effects.forEach((e) => {
      let wrongs = shuffle(clausePool.filter((o) => o !== e)).slice(0, 3).map((o) => ({ text: o.y, why: L.whyOtherReason(o.x) }));
      const alt = alterStatement(e.y);
      if (alt) wrongs = [{ text: alt.text, why: L.whyAltered(e.s.text) }].concat(wrongs);
      add("effect", e.s, L.qEffect(e.x), "", e.y, wrongs, L.expCorrect(e.s.text));
    });

    // sequence: progression through phases / stages
    const phases = [];
    facts.forEach((s) => {
      const m = s.text.match(PHASE_RE);
      if (!m) return;
      const n = NUM_WORDS[m[2].toLowerCase()] || parseInt(m[2], 10);
      if (phases.some((p) => p.n === n)) return;
      const rest = s.text.slice(m.index + m[0].length);
      const fm = rest.match(/\b(focuses on|focus on|introduces|involves|includes|emphasizes|emphasises|consists of|is the|requires|aims to|targets)\s+/i);
      const focus = stripEnd(fm ? rest.slice(fm.index + fm[0].length) : rest.replace(/^[,\s]*(the\s+[^,]+,\s*)?/, ""));
      if (focus.length >= 10) phases.push({ s, n, label: m[0], focus });
    });
    phases.sort((p, q) => p.n - q.n);
    phases.forEach((p, i) => {
      const next = phases[i + 1];
      if (!next || next.n !== p.n + 1) return;
      let wrongs = phases.filter((o) => o !== next).map((o) => ({ text: o.focus, why: L.whyPhase(o.label) }));
      const alt = alterStatement(next.focus);
      if (alt) wrongs.push({ text: alt.text, why: L.whyAltered(next.s.text) });
      add("sequence", next.s, L.qSequence(p.label, p.focus), "", next.focus, shuffle(wrongs), L.expSequence(next.label, next.s.text));
    });

    // decision: clinical decision-making
    const decisions = facts.filter((s) => DECISION_RE.test(s.text));
    decisions.forEach((s) => {
      const own = alterAll(s.text).slice(0, 1).map((v) => ({ text: stripEnd(v.text), why: L.whyAltered(s.text) }));
      const wrongs = own.concat(alteredFrom(new Set([s.index]), 3 - own.length, shuffle(decisions)));
      add("decision", s, L.qDecision, "", stripEnd(s.text), wrongs, L.expCorrect(s.text));
    });

    // match: distinguishing related concepts
    const defs = a.defs.filter((d) => !d.abbr).map((d) => {
      const m = d.definition.match(/\b(?:is|are)\s+(?:defined as\s+)?(.+)$/i);
      return m ? { term: d.term, desc: stripEnd(m[1]), s: d.sentence } : null;
    }).filter(Boolean);
    if (defs.length >= 4) {
      shuffle(defs).slice(0, 3).forEach((d) => {
        const others = shuffle(defs.filter((o) => o !== d)).slice(0, 3);
        if (others.length < 3) return;
        // mismatch: each other term gets a different other term's description
        const wrongs = others.map((o, i) => {
          const wrongDesc = others[(i + 1) % others.length];
          return { text: `${o.term} — ${shorten(wrongDesc.desc, 220)}`, why: L.whyMismatch(o.term, o.desc) };
        });
        add("match", d.s, L.qMatch, "", `${d.term} — ${shorten(d.desc, 220)}`, wrongs, L.expMatch(d.term, d.desc));
      });
    }

    // threshold: interpreting a measured value against a criterion
    facts.forEach((s) => {
      const m = s.text.match(THRESH_RE);
      if (!m) return;
      const phrase = m[1].toLowerCase();
      const n = NUM_WORDS[m[2].toLowerCase()] || parseFloat(m[2]);
      if (!n) return;
      const unit = m[3] ? (m[3] === "%" ? "percent" : m[3]) : "";
      const atLeast = /at least|minimum|more than|greater than|above|over|not before/.test(phrase);
      const step = Math.max(1, Math.round(n * 0.2));
      const met = rand() < 0.5;
      const v = atLeast ? (met ? n + step : n - step) : (met ? n - step : n + step);
      const op = atLeast ? L.atLeast : L.atMost;
      const opWrong = atLeast ? L.atMost : L.atLeast;
      const correct = met ? L.optMet(op, n, unit) : L.optNotMet(op, n, unit);
      const wrongs = [
        { text: met ? L.optNotMet(op, n, unit) : L.optMet(op, n, unit), why: L.whyThresholdVerdict(v, n, unit) },
        { text: met ? L.optNotMet(opWrong, n, unit) : L.optMet(opWrong, n, unit), why: L.whyThresholdDirection(m[0]) },
        { text: met ? L.optMet(op, n + step * 2, unit) : L.optNotMet(op, Math.max(1, n - step * 2), unit), why: L.whyThresholdNumber(n, unit) },
      ];
      add("threshold", s, L.qThreshold(v, unit), s.text, correct, wrongs, L.expThreshold(v, unit, n, met));
    });

    // statement: identify the correct statement among near-identical variants
    // (variants of the same statement first, so the correct one cannot be spotted by wording alone)
    facts.forEach((s) => {
      if (reasons.some((r) => r.s === s) || phases.some((p) => p.s === s)) return;
      const own = shuffle(alterAll(s.text)).slice(0, 2).map((v) => ({ text: stripEnd(v.text), why: L.whyAltered(s.text) }));
      const wrongs = own.concat(alteredFrom(new Set([s.index]), 3 - own.length));
      const subject = own.length >= 1 ? subjectOf(s.text) : null;
      add("statement", s, subject ? L.qStatementAbout(subject) : L.qStatement, "", stripEnd(s.text), wrongs, L.expCorrect(s.text));
    });

    // term: label a described finding (low priority filler)
    if (defs.length >= 4) {
      defs.forEach((d) => {
        const desc = d.desc.replace(new RegExp("\\b" + esc(d.term) + "\\b", "gi"), "this");
        const wrongs = shuffle(defs.filter((o) => o !== d)).slice(0, 3).map((o) => ({ text: o.term, why: L.whyOtherTerm(o.term, o.desc) }));
        add("term", d.s, L.qTerm(desc), "", d.term, wrongs, L.expMatch(d.term, d.desc));
      });
    }
    return cands;
  }

  const TEMPLATE_PRIORITY = { why: 0, effect: 0, sequence: 0, decision: 1, match: 1, threshold: 2, statement: 3, term: 5 };

  /** Picks questions round-robin across the selected slides, favouring reasoning templates and variety. */
  function selectQuestions(cands, target) {
    const bySeg = {};
    cands.forEach((c) => { (bySeg[c.seg] = bySeg[c.seg] || []).push(c); });
    const segs = Object.keys(bySeg).map(Number).sort((x, y) => x - y);
    const usedSentence = new Set();
    const usedCorrect = new Set();
    const usedTpl = {};
    const picked = [];
    for (let round = 0; round < 50 && picked.length < target; round++) {
      let progressed = false;
      for (const seg of segs) {
        if (picked.length >= target) break;
        const pool = bySeg[seg].filter((c) => !c.done && !usedSentence.has(c.sIdx) && !usedCorrect.has(c.correct.toLowerCase()));
        if (!pool.length) continue;
        pool.sort((x, y) => (TEMPLATE_PRIORITY[x.tpl] + (usedTpl[x.tpl] || 0) * 0.6) - (TEMPLATE_PRIORITY[y.tpl] + (usedTpl[y.tpl] || 0) * 0.6));
        const c = pool[0];
        c.done = true;
        usedSentence.add(c.sIdx);
        usedCorrect.add(c.correct.toLowerCase());
        usedTpl[c.tpl] = (usedTpl[c.tpl] || 0) + 1;
        picked.push(c);
        progressed = true;
      }
      if (!progressed) break;
    }
    return picked;
  }

  /**
   * opts.slideIndexes – indexes of the selected slides (null/empty = all)
   * opts.count        – desired number of questions (capped by available content)
   */
  async function quiz(lecture, lang, opts) {
    await delay(900 + Math.random() * 600);
    const L = QUIZ_FRAMES[lang] || QUIZ_FRAMES.en;
    const o = opts || {};
    const a = analyzeText(lecture, o.slideIndexes);
    seed = hash((lecture.id || "") + (o.slideIndexes || []).join(",") + Date.now().toString());
    const cfg = window.APP_CONFIG;
    const target = Math.max(cfg.quizMinQuestions || 3, Math.min(cfg.quizMaxQuestions || 12, o.count || cfg.quizCountFor(a.sentences.length ? (o.slideIndexes || window.Parsers.segments(lecture)).length : 0)));
    const picked = selectQuestions(buildQuizCandidates(a, L), target);
    const questions = picked.map((c) => {
      const items = shuffle([{ text: c.correct, why: "" }].concat(c.wrongs));
      return {
        type: c.tpl,
        slide: c.seg,
        scenario: c.scenario,
        question: c.question,
        options: items.map((i) => i.text),
        answerIndex: items.findIndex((i) => i.text === c.correct),
        explanation: c.explanation,
        whyOthers: items.map((i) => i.why),
      };
    });
    return { questions };
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
