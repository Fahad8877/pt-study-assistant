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
    "learning describe identify outline perform interpret summary categories category overview introduction contents " +
    "agenda conclusion references chapter unit section topic topics page").split(/\s+/));

  const FRAMES = {
    en: {
      sectionTitle: { overview: "Clinical overview", mechanisms: "Pathophysiology and mechanisms", assessment: "Assessment and interpretation", management: "Management and progression" },
      leadOverview: (title, c) => c.length ? `${title} is best understood through ${joinList(c)}; these define the clinical picture and every decision that follows.` : `${title} defines a clinical picture that shapes every assessment and treatment decision that follows.`,
      leadMechanisms: (c) => `The presentation follows directly from the underlying mechanism; understanding why ${c} behaves as it does is what separates protocol-following from clinical reasoning.`,
      leadAssessment: "Examination findings only carry weight when they are interpreted against the mechanism; the following points determine how findings should be read.",
      leadManagement: "Management is staged and criteria-based: each decision is justified by the stage of healing, the patient's demands and a measurable milestone before progression.",
      conceptDetailFallback: "A recurring clinical entity throughout this material; be prepared to explain it in your own words.",
      termFallback: (t) => `A key clinical term. It appears in the context: "${t}"`,
      caseTitle: (title) => `Clinical case: ${title}`,
      caseP1: (age, sex, occ, c) => `A ${age}-year-old ${sex} who works as ${occ} is referred to the physical therapy clinic with a presentation consistent with ${c}. The patient reports that the problem started ${onsetEn()} and is now limiting daily activities and work.`,
      caseP2: (s) => `Initial examination findings: ${s}`,
      caseP3: "The patient asks you to explain what is happening and what the physical therapy plan will involve.",
      q1: "Given the history and examination findings, which of the following best accounts for this patient's presentation?",
      q1fb: (c, d) => `${c} is the central issue here. ${d}`,
      q2: (c) => `Explain to the patient, in plain language, what ${c} means and why it matters for their recovery.`,
      q3: (t) => `The supervising clinician refers to "${t}" when discussing this patient. Which of the following correctly defines it?`,
      q3fb: (t, d) => `${t}: ${d}`,
      q4: "Outline the priorities of your assessment and treatment plan for this patient, with the clinical reasoning behind each priority.",
      openGood: (hits) => `Good answer. You covered important points such as: ${joinList(hits)}. Compare your answer with the model answer below to complete it.`,
      openWeak: "Your answer is missing key points. Read the model answer below, then revisit the summary and key points before trying again.",
      male: "man", female: "woman",
      occupations: ["a teacher", "a nurse", "an office worker", "a football player", "a construction worker", "a university student", "a retired accountant", "a delivery driver"],
    },
    ar: {
      sectionTitle: { overview: "نظرة سريرية عامة", mechanisms: "الفسيولوجيا المرضية والآليات", assessment: "التقييم والتفسير", management: "العلاج والتدرج" },
      leadOverview: (title, c) => c.length ? `يُفهم ${title} على أفضل وجه من خلال ${joinList(c, "ar")}؛ فهذه تحدد الصورة السريرية وكل قرار يليها.` : `يحدد ${title} صورة سريرية تشكّل كل قرار تقييم وعلاج يليها.`,
      leadMechanisms: (c) => `ينبع عرض الحالة مباشرة من الآلية الكامنة؛ وفهم سبب سلوك ${c} بهذه الطريقة هو ما يميّز التفكير السريري عن مجرد اتباع البروتوكول.`,
      leadAssessment: "لا تكتسب نتائج الفحص قيمتها إلا عند تفسيرها في ضوء الآلية؛ والنقاط التالية تحدد كيفية قراءة هذه النتائج.",
      leadManagement: "العلاج متدرج ومبني على معايير: كل قرار تبرره مرحلة الشفاء ومتطلبات المريض ومعلم قابل للقياس قبل التقدم.",
      conceptDetailFallback: "كيان سريري متكرر في هذه المادة؛ كن مستعدًا لشرحه بأسلوبك.",
      termFallback: (t) => `مصطلح سريري أساسي. ورد في السياق التالي: "${t}"`,
      caseTitle: (title) => `حالة سريرية: ${title}`,
      caseP1: (age, sex, occ, c) => `${sex} يبلغ من العمر ${age} عامًا، يعمل ${occ}، تمت إحالته إلى عيادة العلاج الطبيعي بعرض حالة يتوافق مع ${c}. يذكر المريض أن المشكلة بدأت ${onsetAr()} وأصبحت تحدّ من الأنشطة اليومية والعمل.`,
      caseP2: (s) => `نتائج الفحص الأولي: ${s}`,
      caseP3: "يطلب منك المريض أن تشرح له ما يحدث وما الذي ستتضمنه خطة العلاج الطبيعي.",
      q1: "في ضوء التاريخ المرضي ونتائج الفحص، أيٌّ مما يلي يفسّر عرض حالة هذا المريض على أفضل وجه؟",
      q1fb: (c, d) => `${c} هو المحور الأساسي هنا. ${d}`,
      q2: (c) => `اشرح للمريض بلغة بسيطة ما معنى ${c} ولماذا يهم تعافيه.`,
      q3: (t) => `يشير المشرف السريري إلى "${t}" عند مناقشة هذا المريض. أيٌّ مما يلي يعرّفه بشكل صحيح؟`,
      q3fb: (t, d) => `${t}: ${d}`,
      q4: "حدّد أولويات التقييم وخطة العلاج لهذا المريض مع التعليل السريري لكل أولوية.",
      openGood: (hits) => `إجابة جيدة. غطّيت نقاطًا مهمة مثل: ${joinList(hits, "ar")}. قارن إجابتك بالإجابة النموذجية أدناه لإكمالها.`,
      openWeak: "إجابتك تفتقد النقاط الأساسية. اقرأ الإجابة النموذجية أدناه ثم راجع الملخص والنقاط الأساسية قبل المحاولة مجددًا.",
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
      seg.text.split(/\n+/).forEach((rawLine) => {
        // Bullet markers and ALL-CAPS lines are common in real slide decks.
        let line = rawLine.replace(/^[\s•·\-–—*▪◦o]+\s*/, "").trim();
        if (window.Parsers.isLayoutLabel(line)) return;          // "Categories", "Slide 3", "Overview"
        line = window.Parsers.stripLayoutPrefix(line);           // "Categories: X" -> "X"
        const letters = line.replace(/[^A-Za-z]/g, "");
        if (letters.length >= 6 && letters === letters.toUpperCase()) line = cap(line.toLowerCase());
        line.split(/(?<=[.!?])\s+(?=[A-Z"'(])/).forEach((raw) => {
          const s = raw.trim().replace(/\s+/g, " ");
          const key = s.toLowerCase();
          if (s.length < 22 || s.length > 400) return;
          if (s.split(/\s+/).length < 4) return;
          if (!/[a-z]{3}/i.test(s)) return;
          if ((s.match(/[A-Za-z]/g) || []).length / s.length < 0.55) return;
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
    if (window.Parsers.isLayoutLabel(term)) return false; // "Categories", "Overview", "Slide 3" are layout, not medicine
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
    const re2 = /^([A-Z][A-Za-z0-9\-\s]{2,50}?)\s?[:–—-]\s(.{25,})$/;
    sentences.forEach((s) => {
      let m = s.text.match(re);
      if (m && goodTerm(m[1])) {
        const term = cleanTerm(m[1]);
        add(cap(term), s.text, s);
        if (m[2]) add(m[2], s.text, s, true);
        return;
      }
      m = s.text.match(re2);
      if (m && goodTerm(m[1]) && m[2].split(/\s+/).length >= 4) add(cap(cleanTerm(m[1])), m[2], s);
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
    // Sentences from the whole lecture are kept (they make good distractors);
    // only in-scope sentences may become correct answers.
    const chosenSet = new Set(chosen);
    const sentences = splitSentences(segments, segments.map((_, i) => i));
    sentences.forEach((s) => { s.inScope = chosenSet.has(s.seg); });
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

    return { sentences, freq, defs, phrases, concepts, summary, title, segments };
  }

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- provider methods ---------- */

  /* ---------- whole-document expert synthesis ----------
   * Every sentence of the document is classified into one of four clinical
   * lenses and woven into short paragraphs with an expert framing line:
   *   overview   – definitions, epidemiology, scope
   *   mechanisms – pathophysiology, biomechanics, causal relationships
   *   assessment – examination, tests, measures and their interpretation
   *   management – interventions, precautions, staged progression
   */
  const DECIDE_RE = /\b(should|avoid|avoided|recommend|recommended|preferred|contraindicat|precaution|phase|stage|progress|return to|exercise|exercises|training|program|programme|protocol|position|positioning|mobili[sz]|stretch|strengthen|splint|orthosis|brace|sling|treat|treatment|manage|management|therap|intervention|educat|goal|discharge|refer)/i;
  const MECH_RE = /\b(because|due to|caused by|cause[sd]?|leads? to|results? in|mechanism|patho|lesion|damage|injur|inhibit|reflex|innervat|neur|receptor|inflamm|degenerat|load|force|strain|shear|tension|compress|instab|weakness|tone|spastic|flaccid|oedema|edema|swelling|bleed|hemarthrosis|risk)/i;
  const ASSESS_RE = /\b(test|tests|assess|examin|measure|scale|score|sign|symptom|present|report|history|diagnos|imaging|mri|x-ray|ultrasound|sensitiv|specific|positive|negative|observ|grade|index|criteria|criterion|screen|findings?)/i;

  function classify(text) {
    if (DECIDE_RE.test(text)) return "management";
    if (MECH_RE.test(text)) return "mechanisms";
    if (ASSESS_RE.test(text)) return "assessment";
    return "overview";
  }
  function paragraphs(sentences, perParagraph) {
    const out = [];
    for (let i = 0; i < sentences.length; i += perParagraph) {
      out.push(sentences.slice(i, i + perParagraph).map((s) => /[.!?]$/.test(s) ? s : s + ".").join(" "));
    }
    return out;
  }

  async function analyze(lecture, lang) {
    await delay(900 + Math.random() * 600);
    const L = FRAMES[lang] || FRAMES.en;
    const a = analyzeText(lecture);
    const conceptNames = a.concepts.slice(0, 3).map((c) => c.title);

    // Whole-document classification (all slides together), keeping document order.
    const usable = a.sentences.filter((s) => !OBJECTIVE_RE.test(s.text) && s.text.toLowerCase() !== String(a.title || "").toLowerCase());
    const buckets = { overview: [], mechanisms: [], assessment: [], management: [] };
    usable.forEach((s) => buckets[classify(s.text)].push(s));
    const top = (list, n) => list.slice().sort((x, y) => y.score - x.score).slice(0, n).sort((x, y) => x.index - y.index).map((s) => s.text);

    const sections = [];
    const push = (key, lead, list, n) => {
      const picked = top(list, n);
      if (picked.length) sections.push({ key, title: L.sectionTitle[key], lead, paragraphs: paragraphs(picked, 3) });
    };
    push("overview", L.leadOverview(a.title, conceptNames), buckets.overview, 6);
    push("mechanisms", L.leadMechanisms(conceptNames[0] || a.title), buckets.mechanisms, 8);
    push("assessment", L.leadAssessment, buckets.assessment, 8);
    push("management", L.leadManagement, buckets.management, 9);

    const explanation = sections.map((s) => `${s.lead} ${s.paragraphs[0]}`);

    return {
      sections,
      pearls: a.summary.map((s) => s.text),
      explanation,
      summary: a.summary.map((s) => s.text),
      concepts: a.concepts.map((c) => ({ title: c.title, detail: c.detail || L.conceptDetailFallback })),
      terms: a.defs.slice(0, 10).map((d) => ({ term: d.term, definition: d.definition })),
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
      qWhy: (x) => `Which underlying rationale best explains why ${x}?`,
      qEffect: (x) => `What is the expected consequence when ${x}?`,
      qDecision: "During management planning for a patient with this condition, which of the following decisions is clinically appropriate?",
      qMatch: "Which of the following correctly pairs a clinical entity with its defining characteristic?",
      qThreshold: (v, unit) => `The measured value is ${v} ${unit}. Applying the stated criterion, what is the correct interpretation?`.replace(/\s+\./, "."),
      qSequence: (phase, focus) => `A patient has achieved the goals of ${phase} (${focus}). What should the next phase of rehabilitation prioritize?`,
      qStatement: "Which of the following statements is correct?",
      qStatementAbout: (subject) => `Which statement regarding ${subject} is correct?`,
      qBelongs: (h) => `Which of the following is a recognized feature of ${h}?`,
      qHeading: (p) => `"${p}" is a characteristic feature of which of the following?`,
      qTerm: (desc) => `A clinical note documents the following finding: "${desc}". Which term correctly describes it?`,
      expCorrect: (s) => `Correct. ${s}`,
      expSequence: (phase, s) => `Correct. ${s}`,
      expMatch: (term, desc) => `Correct. ${term}: ${desc}.`,
      expThreshold: (v, unit, n, met) => `${met ? "The criterion is met" : "The criterion is not met"}: the measured value (${v} ${unit}) is ${met ? "on the required side of" : "outside"} the threshold of ${n} ${unit}.`.replace(/\s+\)/g, ")").replace(/\s+\./g, "."),
      whyAltered: (orig) => `This reverses the established relationship. The correct principle is: ${orig}`,
      whyOtherReason: (x) => `This rationale applies to a different situation (${x}), not to the one asked about.`,
      whyMismatch: (term, desc) => `${term} is actually ${desc}.`,
      whyPhase: (phase) => `This is the priority of ${phase}, not of the phase that follows.`,
      whyThresholdVerdict: (v, n, unit) => `The verdict is wrong: compare ${v} ${unit} with the threshold of ${n} ${unit}.`.replace(/\s+\./g, "."),
      whyThresholdDirection: (phrase) => `The direction of the criterion is misapplied; the requirement is "${phrase}".`,
      whyThresholdNumber: (n, unit) => `The threshold is ${n} ${unit}, not this value.`.replace(/\s+,/g, ","),
      whyOtherTerm: (term, desc) => `${term} describes a different finding: ${desc}.`,
      expBelongs: (h, s) => `Correct. ${s} — a feature of ${h}.`,
      whyBelongs: (h) => `This is a feature of ${h}, not of the entity asked about.`,
      whyHeading: (h, p) => `${h} is characterized by other features, for example: ${p}.`,
      optMet: (op, n, unit) => `Criterion met: the requirement is ${op} ${n} ${unit}`.trim(),
      optNotMet: (op, n, unit) => `Criterion not met: the requirement is ${op} ${n} ${unit}`.trim(),
      atLeast: "at least", atMost: "at most",
      phaseWord: (label) => label,
    },
    ar: {
      qWhy: (x) => `ما التعليل الأساسي الذي يفسّر لماذا ${x}؟`,
      qEffect: (x) => `ما النتيجة المتوقعة عندما ${x}؟`,
      qDecision: "أثناء التخطيط لعلاج مريض بهذه الحالة، أيٌّ من القرارات التالية مناسب سريريًا؟",
      qMatch: "أيٌّ مما يلي يربط الكيان السريري بخاصيته المميزة بشكل صحيح؟",
      qThreshold: (v, unit) => `القيمة المقاسة هي ${v} ${unit}. بتطبيق المعيار المذكور، ما التفسير الصحيح؟`,
      qSequence: (phase, focus) => `حقق مريض أهداف ${phase} (${focus}). ما الذي يجب أن تعطيه المرحلة التالية من التأهيل الأولوية؟`,
      qStatement: "أيٌّ من العبارات التالية صحيحة؟",
      qStatementAbout: (subject) => `أي عبارة بخصوص ${subject} صحيحة؟`,
      qBelongs: (h) => `أيٌّ مما يلي يُعد سمة معروفة لـ ${h}؟`,
      qHeading: (p) => `"${p}" سمة مميزة لأيٍّ مما يلي؟`,
      qTerm: (desc) => `يوثّق تقرير سريري النتيجة التالية: "${desc}". ما المصطلح الذي يصفها بشكل صحيح؟`,
      expCorrect: (s) => `إجابة صحيحة. ${s}`,
      expSequence: (phase, s) => `إجابة صحيحة. ${s}`,
      expMatch: (term, desc) => `إجابة صحيحة. ${term}: ${desc}.`,
      expThreshold: (v, unit, n, met) => `${met ? "المعيار متحقق" : "المعيار غير متحقق"}: القيمة المقاسة (${v} ${unit}) ${met ? "تقع في الجانب المطلوب من" : "تقع خارج"} الحد البالغ ${n} ${unit}.`,
      whyAltered: (orig) => `هذا يعكس العلاقة الثابتة. المبدأ الصحيح هو: ${orig}`,
      whyOtherReason: (x) => `هذا التعليل ينطبق على موقف مختلف (${x}) وليس على الموقف المطروح.`,
      whyMismatch: (term, desc) => `${term} هو في الواقع ${desc}.`,
      whyPhase: (phase) => `هذه أولوية ${phase} وليست أولوية المرحلة التالية.`,
      whyThresholdVerdict: (v, n, unit) => `الحكم خاطئ: قارن ${v} ${unit} بالحد البالغ ${n} ${unit}.`,
      whyThresholdDirection: (phrase) => `اتجاه المعيار مطبَّق بشكل خاطئ؛ المتطلب هو "${phrase}".`,
      whyThresholdNumber: (n, unit) => `الحد هو ${n} ${unit} وليس هذه القيمة.`,
      whyOtherTerm: (term, desc) => `${term} يصف نتيجة مختلفة: ${desc}.`,
      expBelongs: (h, s) => `إجابة صحيحة. ${s} — سمة من سمات ${h}.`,
      whyBelongs: (h) => `هذه سمة من سمات ${h} وليست للكيان المسؤول عنه.`,
      whyHeading: (h, p) => `${h} يتميز بسمات أخرى، مثل: ${p}.`,
      optMet: (op, n, unit) => `المعيار متحقق: المتطلب هو ${op} ${n} ${unit}`.trim(),
      optNotMet: (op, n, unit) => `المعيار غير متحقق: المتطلب هو ${op} ${n} ${unit}`.trim(),
      atLeast: "على الأقل", atMost: "على الأكثر",
      phaseWord: (label) => label,
    },
  };

  const NUM_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
  const ANTONYM_PAIRS = [
    ["should be avoided", "is recommended"], ["should not", "should"], ["not recommended", "recommended"], ["non-contact", "contact"],
    ["lower blood pressure", "raise blood pressure"], ["most common", "least common"], ["longer life expectancy", "shorter life expectancy"],
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
      if (new RegExp("\\b" + esc(to) + "\\b", "i").test(text)) continue; // both words present: swap would be nonsense
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
    if (window.Parsers.isLayoutLabel(subj)) return null;
    return subj.length >= 4 && subj.length <= 70 && subj.split(/\s+/).length <= 10 ? lowerFirst(subj) : null;
  }

  function buildQuizCandidates(a, L) {
    const cands = [];
    const facts = a.sentences.filter((s) => FACT_RE.test(s.text) && !OBJECTIVE_RE.test(s.text));
    const fragments = a.sentences.filter((s) => !OBJECTIVE_RE.test(s.text));
    const add = (tpl, s, question, scenario, correct, wrongs, explanation) => {
      if (s.inScope === false) return; // correct answers must come from the selected slides
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
      shuffle(defs.filter((d) => d.s.inScope !== false)).slice(0, 3).forEach((d) => {
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

    // belongs / heading: fallback for bullet-style slides (short points under a slide heading)
    const segTitle = (i) => (a.segments[i] && a.segments[i].title) || "";
    const bySegFrag = {};
    fragments.forEach((s) => {
      const title = segTitle(s.seg);
      const seg = a.segments[s.seg];
      // Layout-only headings ("Categories", "Overview", "Objectives", "Slide 3") are never clinical entities.
      if (!title || title.length > 70 || (seg && seg.layoutTitle) || window.Parsers.isLayoutLabel(title) || s.text.toLowerCase() === title.toLowerCase()) return;
      if (s.seg === 0) return; // title slide: course / author / affiliation lines are not clinical content
      (bySegFrag[s.seg] = bySegFrag[s.seg] || []).push(s);
    });
    const fragSegs = Object.keys(bySegFrag).map(Number);
    if (fragSegs.length >= 4) {
      fragSegs.forEach((segIdx) => {
        const own = bySegFrag[segIdx];
        const otherSegs = fragSegs.filter((o) => o !== segIdx && segTitle(o).toLowerCase() !== segTitle(segIdx).toLowerCase());
        if (otherSegs.length < 3) return;
        own.slice(0, 2).forEach((s) => {
          const wrongs = shuffle(otherSegs).slice(0, 3).map((o) => ({ text: stripEnd(pick(bySegFrag[o]).text), why: L.whyBelongs(segTitle(o)) }));
          add("belongs", s, L.qBelongs(segTitle(segIdx)), "", stripEnd(s.text), wrongs, L.expBelongs(segTitle(segIdx), s.text));
        });
        const last = own[own.length - 1];
        const headingWrongs = shuffle(otherSegs).slice(0, 3).map((o) => ({ text: segTitle(o), why: L.whyHeading(segTitle(o), pick(bySegFrag[o]).text) }));
        add("heading", last, L.qHeading(stripEnd(last.text)), "", segTitle(segIdx), headingWrongs, L.expBelongs(segTitle(segIdx), last.text));
      });
    }

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

  const TEMPLATE_PRIORITY = { why: 0, effect: 0, sequence: 0, decision: 1, match: 1, threshold: 2, statement: 3, belongs: 4, heading: 4, term: 5 };

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
    // Examination findings: prefer sentences about signs, symptoms, tests or measures over anatomy/definitions.
    const FINDING_RE = /\b(patients?|reports?|present|describe|pain|swelling|instab|weakness|limited|difficult|positive|negative|test|sign|score|scale|grade|degrees|percent|history|onset)\b/i;
    const findingPool = a.sentences.filter((s) => FINDING_RE.test(s.text) && s !== c1.sentence).sort((x, y) => y.score - x.score);
    const conceptWord = (c1.title || "").split(" ")[0].toLowerCase();
    const relatedFinding = findingPool.find((s) => conceptWord.length > 3 && s.text.toLowerCase().includes(conceptWord));
    const findingSentence = (relatedFinding || findingPool[0] || c1.sentence || a.summary[0] || { text: "" }).text;

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
