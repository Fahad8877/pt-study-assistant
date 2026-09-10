/* Main application: hash router + views. */
(function () {
  const t = (k) => window.I18N.t(k);
  const view = document.getElementById("view");

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function nl2br(s) { return esc(s).replace(/\n/g, "<br>"); }
  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 2600);
  }
  function formatDate(ts) {
    try { return new Date(ts).toLocaleDateString(window.I18N.lang === "ar" ? "ar" : "en", { year: "numeric", month: "short", day: "numeric" }); }
    catch (e) { return ""; }
  }
  function navigate(hash) { location.hash = hash; }
  function letter(i) { return window.I18N.lang === "ar" ? ["أ", "ب", "ج", "د"][i] : ["A", "B", "C", "D"][i]; }
  function mockNote() { return window.AI.isMock() ? `<p class="note">${esc(t("common.mockNote"))}</p>` : ""; }
  function lectureMeta(l) {
    const unit = l.unitType === "slides" ? t("lectures.slides") : t("lectures.pages");
    return `${l.units} ${unit} · ${l.wordCount} ${t("lectures.words")} · ${formatDate(l.createdAt)}`;
  }
  function spinner(msg) { return `<div class="progress"><div class="spinner"></div><span>${esc(msg)}</span></div>`; }

  const ICONS = {
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    lectures: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    quiz: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    case: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
  };

  /* ---------- analysis (cached per language) ---------- */
  async function ensureAnalysis(lecture) {
    const lang = window.I18N.lang;
    if (lecture.analysis && lecture.analysis.sections && lecture.analysisLang === lang) return lecture.analysis;
    const analysis = await window.AI.analyze(lecture);
    lecture.analysis = analysis;
    lecture.analysisLang = lang;
    window.Store.upsert(lecture);
    return analysis;
  }

  /* ---------- views ---------- */
  function icon(name) { return `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`; }
  function greeting() {
    const h = new Date().getHours();
    return t(h < 12 ? "dash.morning" : h < 18 ? "dash.afternoon" : "dash.evening");
  }

  function renderDashboard() {
    const lectures = window.Store.all();
    const last = window.Store.get(window.Store.getLastId()) || lectures[0];
    const heroMain = last
      ? `<div class="hero-main">
           <span class="tag">${esc(t("dash.continue"))}</span>
           <h2>${esc(last.title)}</h2>
           <p class="meta">${esc(t("dash.lastAccessed"))} · ${esc(formatDate(last.updatedAt))} · ${last.units} ${esc(last.unitType === "slides" ? t("lectures.slides") : t("lectures.pages"))}</p>
           <a class="btn btn-primary btn-arrow" href="#/lecture/${last.id}">${esc(t("dash.continueLearning"))}</a>
           <svg class="hero-art" aria-hidden="true"><use href="#i-anatomy"/></svg>
         </div>`
      : `<div class="hero-main">
           <span class="tag">${esc(t("dash.continue"))}</span>
           <p class="meta" style="margin-top:.2rem">${esc(t("dash.continue.empty"))}</p>
           <a class="btn btn-primary btn-arrow" href="#/upload">${esc(t("dash.upload"))}</a>
           <svg class="hero-art" aria-hidden="true"><use href="#i-anatomy"/></svg>
         </div>`;

    const quick = [
      ["upload", "#/upload", "dash.upload", "dash.upload.desc"],
      ["book", "#/lectures", "dash.lectures", "dash.lectures.desc"],
      ["quiz", "#/quiz", "dash.quiz", "dash.quiz.desc"],
      ["case", "#/case", "dash.case", "dash.case.desc"],
    ].map(([ic, href, title, desc]) => `
      <a class="card qa-card" href="${href}">
        <div class="icon-box">${icon(ic)}</div>
        <h3>${esc(t(title))}</h3>
        <p>${esc(t(desc))}</p>
      </a>`).join("");

    const recent = lectures.slice(0, 3).map((l) => `
      <div class="list-row">
        <div class="icon-box ${l.fileType === "pptx" ? "pptx" : ""}">${icon("file")}</div>
        <div class="info"><h3>${esc(l.title)}</h3><div class="small">${esc(t("dash.lastAccessed"))} · ${esc(formatDate(l.updatedAt))}</div></div>
        <a class="btn ${last && l.id === last.id ? "btn-primary" : "btn-secondary"} btn-arrow" href="#/lecture/${l.id}">${esc(last && l.id === last.id ? t("dash.continue.btn") : t("dash.start"))}</a>
      </div>`).join("");

    view.innerHTML = `
      <div class="greeting"><h1>${esc(greeting())}</h1><p>${esc(t("dash.subtitle"))}</p></div>
      <div class="hero">
        ${heroMain}
        <div class="card hero-side">
          <div class="icon-box">${icon("spark")}</div>
          <div><blockquote>“${esc(t("dash.tip"))}”</blockquote><cite>${esc(t("dash.tipSource"))}</cite></div>
        </div>
      </div>
      <div class="section">
        <div class="section-head"><div><h2>${esc(t("dash.quick"))}</h2><p>${esc(t("dash.quickSub"))}</p></div></div>
        <div class="qa-grid">${quick}</div>
      </div>
      <div class="section">
        <div class="section-head"><div><h2>${esc(t("dash.recent"))}</h2><p>${esc(t("dash.recentSub"))}</p></div><a href="#/lectures" class="link-arrow">${esc(t("dash.viewAll"))}</a></div>
        <div class="card list-card">${recent || `<div class="empty">${esc(t("lectures.empty"))}</div>`}</div>
      </div>
      ${mockNote()}`;
  }

  function renderUpload() {
    view.innerHTML = `
      <div class="page-header"><h1>${esc(t("upload.title"))}</h1><p>${esc(t("upload.subtitle"))}</p></div>
      <label class="dropzone" id="dropzone">
        <div class="icon-box">${icon("upload")}</div>
        <strong>${esc(t("upload.drop"))}</strong>
        <span class="muted">${esc(t("upload.browse"))}</span>
        <span class="muted small">${esc(t("upload.hint"))}</span>
        <input type="file" id="file-input" accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation" />
      </label>
      <div id="upload-status"></div>
      <div class="btn-row"><button class="btn btn-secondary" id="sample-btn">${esc(t("upload.sample"))}</button></div>
      ${mockNote()}`;

    const dz = document.getElementById("dropzone");
    const input = document.getElementById("file-input");
    input.addEventListener("change", () => { if (input.files[0]) handleFile(input.files[0]); });
    ["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("drag"); }));
    ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("drag"); }));
    dz.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) handleFile(f); });
    document.getElementById("sample-btn").addEventListener("click", () => {
      const s = window.SAMPLE_LECTURE;
      createLecture({ title: s.title, fileName: s.fileName, fileType: s.fileType, units: s.units, unitType: s.unitType, text: s.text });
    });
  }

  async function handleFile(file) {
    const status = document.getElementById("upload-status");
    if (!window.Parsers.detectType(file)) { status.innerHTML = `<div class="alert alert-error">${esc(t("upload.error.type"))}</div>`; return; }
    status.innerHTML = spinner(t("upload.reading"));
    try {
      const parsed = await window.Parsers.parseFile(file);
      await createLecture({
        title: window.Parsers.titleFromFilename(file.name),
        fileName: file.name, fileType: parsed.fileType, units: parsed.units, unitType: parsed.unitType, text: parsed.text, parts: parsed.parts,
      });
    } catch (err) {
      console.error(err);
      const key = err.message === "UNSUPPORTED_TYPE" ? "upload.error.type" : err.message === "EMPTY_TEXT" ? "upload.error.empty" : "upload.error.generic";
      status.innerHTML = `<div class="alert alert-error">${esc(t(key))}</div>`;
    }
  }

  async function createLecture(data) {
    const status = document.getElementById("upload-status");
    if (status) status.innerHTML = spinner(t("upload.analyzing"));
    const text = data.text.slice(0, window.APP_CONFIG.maxStoredChars);
    // Keep each slide/page separately so quizzes can be scoped to specific slides.
    const segments = Array.isArray(data.parts)
      ? data.parts.map((p, i) => ({ number: i + 1, text: window.Parsers.normalize(p || "") })).filter((s) => s.text)
      : undefined;
    const lecture = {
      id: window.Store.newId(),
      title: data.title, fileName: data.fileName, fileType: data.fileType,
      units: data.units, unitType: data.unitType, text, segments,
      wordCount: (text.match(/\S+/g) || []).length,
      createdAt: Date.now(),
    };
    window.Store.upsert(lecture);
    window.Store.setLastId(lecture.id);
    try {
      await ensureAnalysis(lecture);
      toast(t("upload.success"));
      navigate(`#/lecture/${lecture.id}`);
    } catch (err) {
      console.error(err);
      if (status) status.innerHTML = `<div class="alert alert-error">${esc(t("upload.error.generic"))}</div>`;
    }
  }

  function renderLectures() {
    const lectures = window.Store.all();
    const items = lectures.length ? `<div class="card list-card">${lectures.map((l) => `
      <div class="list-row">
        <div class="icon-box ${l.fileType === "pptx" ? "pptx" : ""}">${icon("file")}</div>
        <div class="info"><h3>${esc(l.title)}</h3><div class="small">${esc(l.fileName)} · ${esc(lectureMeta(l))}</div></div>
        <div class="actions">
          <a class="btn btn-secondary btn-arrow" href="#/lecture/${l.id}">${esc(t("lectures.open"))}</a>
          <button class="btn btn-danger" data-del="${l.id}">${esc(t("lectures.delete"))}</button>
        </div>
      </div>`).join("")}</div>`
      : `<div class="card"><div class="empty">${esc(t("lectures.empty"))}</div><div class="btn-row" style="justify-content:center;margin-top:0"><a class="btn btn-primary btn-arrow" href="#/upload">${esc(t("dash.upload"))}</a></div></div>`;

    view.innerHTML = `<div class="page-header"><h1>${esc(t("lectures.title"))}</h1><p>${esc(t("dash.recentSub"))}</p></div>${items}`;
    view.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
      if (confirm(t("lectures.confirmDelete"))) { window.Store.remove(b.getAttribute("data-del")); renderLectures(); }
    }));
  }

  /* ---------- lecture: whole-document expert synthesis ---------- */
  async function ensureCases(lecture) {
    const lang = window.I18N.lang;
    if (Array.isArray(lecture.cases) && lecture.cases.length && lecture.casesLang === lang) return lecture.cases;
    const cases = [];
    for (let i = 0; i < 2; i++) cases.push(await window.AI.clinicalCase(lecture));
    lecture.cases = cases;
    lecture.casesLang = lang;
    window.Store.upsert(lecture);
    return cases;
  }

  async function renderLecture(id) {
    const lecture = window.Store.get(id);
    if (!lecture) { view.innerHTML = `<div class="card"><p>${esc(t("lecture.notFound"))}</p><a class="btn btn-secondary" href="#/lectures">${esc(t("common.back"))}</a></div>`; return; }
    window.Store.setLastId(id);

    const segs = window.Parsers.segments(lecture);
    view.innerHTML = `
      <div class="page-header">
        <a href="#/lectures" class="crumb">${esc(t("nav.lectures"))}</a>
        <h1>${esc(lecture.title)}</h1>
        <p class="meta-row">
          <span>${icon("slides")} ${segs.length} ${esc(lecture.unitType === "pages" ? t("lectures.pages") : t("lectures.slides"))}</span>
          <span>${icon("calendar")} ${esc(formatDate(lecture.createdAt))}</span>
          <span>${icon("file")} ${esc(lecture.fileName)}</span>
        </p>
        <div class="btn-row">
          <a class="btn btn-primary btn-arrow" href="#/quiz/${lecture.id}">${esc(t("lecture.startAssessment"))}</a>
          <a class="btn btn-secondary" href="#/case/${lecture.id}">${esc(t("lecture.startCase"))}</a>
          <button class="btn btn-ghost" id="reanalyze">${esc(t("lecture.reanalyze"))}</button>
        </div>
      </div>
      <nav class="subnav" aria-label="Sections">
        <button type="button" data-jump="sec-summary"><span class="step">1</span>${esc(t("lecture.sec.summary"))}</button>
        <button type="button" data-jump="sec-cases"><span class="step">2</span>${esc(t("lecture.sec.cases"))}</button>
        <button type="button" data-jump="sec-assessment"><span class="step">3</span>${esc(t("lecture.sec.assessment"))}</button>
      </nav>
      <div id="lecture-body"><div class="card">${spinner(t("lecture.analyzing"))}</div></div>`;

    document.getElementById("reanalyze").addEventListener("click", async () => {
      lecture.analysis = null;
      lecture.cases = null;
      document.getElementById("lecture-body").innerHTML = `<div class="card">${spinner(t("lecture.analyzing"))}</div>`;
      await renderLectureBody(lecture);
    });
    view.querySelectorAll("[data-jump]").forEach((b) => b.addEventListener("click", () => {
      const el = document.getElementById(b.getAttribute("data-jump"));
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    await renderLectureBody(lecture);
  }

  async function renderLectureBody(lecture) {
    const box = document.getElementById("lecture-body");
    const lang = window.I18N.lang;
    const token = renderToken;
    let a, cases;
    try {
      a = await ensureAnalysis(lecture);
      cases = await ensureCases(lecture);
    } catch (err) {
      console.error(err);
      box.innerHTML = `<div class="card"><div class="alert alert-error">${esc(t("upload.error.generic"))}</div></div>`;
      return;
    }
    if (!box.isConnected || lang !== window.I18N.lang || token !== renderToken) return; // view replaced meanwhile

    const sections = (a.sections || []).map((s) => `
      <section class="synth">
        <h3>${esc(s.title)}</h3>
        <p class="lead" dir="auto">${esc(s.lead)}</p>
        ${(s.paragraphs || []).map((p) => `<p dir="auto">${esc(p)}</p>`).join("")}
      </section>`).join("");
    const pearls = (a.pearls || a.summary || []).length
      ? `<section class="synth"><h3>${esc(t("lecture.pearls"))}</h3><ul>${(a.pearls || a.summary).map((p) => `<li dir="auto">${esc(p)}</li>`).join("")}</ul></section>` : "";
    const terms = (a.terms || []).length
      ? `<section class="synth"><h3>${esc(t("lecture.terminology"))}</h3><dl class="term-list">${a.terms.map((x) => `<div dir="auto"><dt>${esc(x.term)}</dt><dd>${esc(x.definition)}</dd></div>`).join("")}</dl></section>` : "";

    const vignettes = cases.map((c, i) => `
      <article class="vignette">
        <h3>${esc(t("lecture.case"))} ${i + 1}</h3>
        ${(c.presentation || []).map((p) => `<p dir="auto">${esc(p)}</p>`).join("")}
        <h4>${esc(t("lecture.reasoning"))}</h4>
        <ul>${(c.questions || []).filter((q) => q.type === "open" && q.modelAnswer).map((q) => `<li dir="auto"><strong>${esc(q.question)}</strong><br>${esc(q.modelAnswer)}</li>`).join("")}</ul>
      </article>`).join("");

    const estimate = window.APP_CONFIG.quizCountFor(window.Parsers.segments(lecture).length);

    box.innerHTML = `
      <section class="card section-card" id="sec-summary">
        <div class="section-title"><span class="step">1</span><h2>${esc(t("lecture.sec.summary"))}</h2></div>
        <p>${esc(t("lecture.sec.summaryDesc"))}</p>
        ${sections}${pearls}${terms}
      </section>
      <section class="card section-card" id="sec-cases">
        <div class="section-title"><span class="step">2</span><h2>${esc(t("lecture.sec.cases"))}</h2></div>
        <p>${esc(t("lecture.sec.casesDesc"))}</p>
        ${vignettes}
        <div class="btn-row"><a class="btn btn-secondary btn-arrow" href="#/case/${lecture.id}">${esc(t("lecture.workCase"))}</a></div>
      </section>
      <section class="card section-card" id="sec-assessment">
        <div class="section-title"><span class="step">3</span><h2>${esc(t("lecture.sec.assessment"))}</h2></div>
        <p>${esc(t("lecture.sec.assessmentDesc"))}</p>
        <ul class="expect">
          <li>${icon("quiz")}<span>${esc(t("quiz.expect1"))}</span></li>
          <li>${icon("case")}<span>${esc(t("quiz.expect2"))}</span></li>
          <li>${icon("check")}<span>${esc(t("quiz.expect3"))}</span></li>
          <li>${icon("file")}<span>${esc(t("quiz.expect4"))}</span></li>
        </ul>
        <p class="muted small" style="margin-top:1rem">${esc(fill("lecture.assessmentEstimate", { n: estimate }))}</p>
        <div class="btn-row"><a class="btn btn-primary btn-arrow" href="#/quiz/${lecture.id}">${esc(t("lecture.startAssessment"))}</a></div>
      </section>
      <details class="source">
        <summary>${esc(t("lecture.sourceText"))}</summary>
        <div class="lecture-content" dir="auto">${nl2br(lecture.text)}</div>
      </details>`;
  }

  function renderPicker(titleKey, subtitleKey, chooseKey, emptyKey, base) {
    const lectures = window.Store.all();
    const list = lectures.length
      ? `<p class="muted">${esc(t(chooseKey))}</p><div class="picker">${lectures.map((l) => `<button data-pick="${l.id}"><span><strong>${esc(l.title)}</strong><br><span class="muted small">${esc(lectureMeta(l))}</span></span><span class="btn btn-ghost">${esc(t("common.select"))}</span></button>`).join("")}</div>`
      : `<p class="muted" style="margin:0">${esc(t(emptyKey))}</p><div class="btn-row"><a class="btn btn-primary" href="#/upload">${esc(t("dash.upload"))}</a></div>`;
    view.innerHTML = `<div class="page-header"><h1>${esc(t(titleKey))}</h1><p>${esc(t(subtitleKey))}</p></div><div class="card">${list}</div>`;
    view.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => navigate(`${base}/${b.getAttribute("data-pick")}`)));
  }

  /* ---------- quiz ---------- */
  let quiz = null;            // active quiz: { lectureId, lang, scope, questions, index, selected, checked, score }
  const quizSetup = {};       // remembered scope choice per lecture: { mode: "all"|"some", slides: number[] }

  function unitLabel(lecture, plural) {
    const slides = lecture.unitType !== "pages";
    if (plural) return t(slides ? "quiz.slidesUnit" : "quiz.pagesUnit");
    return t(slides ? "quiz.slide" : "quiz.page");
  }
  function fill(key, vars) {
    return Object.keys(vars).reduce((s, k) => s.replace(new RegExp("\\{" + k + "\\}", "g"), vars[k]), t(key));
  }

  async function renderQuiz(id) {
    if (!id) return renderPicker("quiz.title", "quiz.subtitle", "quiz.choose", "quiz.noLectures", "#/quiz");
    const lecture = window.Store.get(id);
    if (!lecture) return renderPicker("quiz.title", "quiz.subtitle", "quiz.choose", "quiz.noLectures", "#/quiz");
    window.Store.setLastId(id);

    if (quiz && quiz.lectureId === id && quiz.questions) {
      if (quiz.lang === window.I18N.lang) return drawQuiz(lecture);
      return startQuiz(lecture, quiz.scope); // language changed: regenerate with the same scope
    }
    renderQuizSetup(lecture);
  }

  function quizHeader(lecture) {
    return `<div class="page-header"><h1>${esc(t("quiz.title"))}</h1><p>${esc(lecture.title)}</p></div>`;
  }

  function renderQuizSetup(lecture) {
    const segs = window.Parsers.segments(lecture);
    const setup = quizSetup[lecture.id] || (quizSetup[lecture.id] = { mode: "all", slides: segs.map((s) => s.index) });
    const cfg = window.APP_CONFIG;

    const slideItems = segs.map((s) => `
      <label class="slide-pick ${setup.slides.includes(s.index) ? "checked" : ""}">
        <input type="checkbox" data-seg="${s.index}" ${setup.slides.includes(s.index) ? "checked" : ""} />
        <span dir="auto"><strong>${esc(unitLabel(lecture))} ${s.number}</strong> · ${esc(s.title)}</span>
      </label>`).join("");

    view.innerHTML = `
      <div class="page-header"><h1>${esc(t("quiz.title"))}</h1><p>${esc(lecture.title)}</p><p class="small" style="margin-top:.25rem">${esc(t("quiz.subtitle"))}</p></div>
      <div class="card">
        <div class="scope-head">
          <div><h2>${esc(t("quiz.scopeTitle"))}</h2><p class="muted">${esc(t("quiz.scopeHint"))}</p></div>
          <div class="estimate" id="estimate"></div>
        </div>
        <div class="options scope-options">
          <button type="button" class="option ${setup.mode === "all" ? "selected" : ""}" data-scope="all">
            <span class="letter">${setup.mode === "all" ? "●" : "○"}</span>
            <span><strong>${esc(t("quiz.scopeAll"))}</strong><span class="muted small">${esc(t("quiz.scopeAllDesc"))} (${segs.length} ${esc(unitLabel(lecture, true))})</span></span>
          </button>
          <button type="button" class="option ${setup.mode === "some" ? "selected" : ""}" data-scope="some">
            <span class="letter">${setup.mode === "some" ? "●" : "○"}</span>
            <span><strong>${esc(t("quiz.scopeSome"))}</strong><span class="muted small">${esc(t("quiz.scopeSomeDesc"))}</span></span>
          </button>
        </div>
        <div id="slide-picker" ${setup.mode === "some" ? "" : "hidden"}>
          <div class="slide-list-head">
            <span class="muted small" id="selected-count"></span>
            <span>
              <button type="button" class="btn btn-ghost" id="select-all">${esc(t("quiz.selectAll"))}</button>
              <button type="button" class="btn btn-ghost" id="select-none">${esc(t("quiz.clearAll"))}</button>
            </span>
          </div>
          <div class="slide-list">${slideItems}</div>
        </div>
        <p class="muted small" id="count-preview" style="margin-top:1rem"></p>
        <div id="quiz-status"></div>
        <div class="btn-row">
          <button type="button" class="btn btn-primary" id="start-quiz">${esc(t("quiz.start"))}</button>
          <a class="btn btn-ghost" href="#/lecture/${lecture.id}">${esc(t("quiz.backToLecture"))}</a>
        </div>
      </div>
      <div class="card">
        <h3>${esc(t("quiz.expectTitle"))}</h3>
        <ul class="expect">
          <li>${icon("quiz")}<span>${esc(t("quiz.expect1"))}</span></li>
          <li>${icon("case")}<span>${esc(t("quiz.expect2"))}</span></li>
          <li>${icon("check")}<span>${esc(t("quiz.expect3"))}</span></li>
          <li>${icon("file")}<span>${esc(t("quiz.expect4"))}</span></li>
        </ul>
      </div>
      <p class="tagline">${esc(t("quiz.tagline"))}</p>`;

    const picker = document.getElementById("slide-picker");
    const preview = document.getElementById("count-preview");
    const selectedCount = document.getElementById("selected-count");
    const startBtn = document.getElementById("start-quiz");

    function chosen() { return setup.mode === "all" ? segs.map((s) => s.index) : setup.slides; }
    function refresh() {
      const n = chosen().length;
      preview.textContent = n ? "" : t("quiz.noSlides");
      preview.hidden = n > 0;
      document.getElementById("estimate").innerHTML = n
        ? `${esc(t("quiz.estimate"))} <strong>~${cfg.quizCountFor(n)} ${esc(t("quiz.questionsUnit"))}</strong>${esc(t("quiz.estimateBasis"))}`
        : "";
      selectedCount.textContent = fill("quiz.selectedCount", { n: setup.slides.length, m: segs.length });
      startBtn.disabled = n === 0;
      view.querySelectorAll(".slide-pick").forEach((l) => l.classList.toggle("checked", l.querySelector("input").checked));
    }

    view.querySelectorAll("[data-scope]").forEach((b) => b.addEventListener("click", () => {
      setup.mode = b.getAttribute("data-scope");
      view.querySelectorAll("[data-scope]").forEach((x) => {
        const active = x === b;
        x.classList.toggle("selected", active);
        x.querySelector(".letter").textContent = active ? "●" : "○";
      });
      picker.hidden = setup.mode !== "some";
      refresh();
    }));
    view.querySelectorAll("[data-seg]").forEach((cb) => cb.addEventListener("change", () => {
      setup.slides = [...view.querySelectorAll("[data-seg]:checked")].map((x) => +x.getAttribute("data-seg"));
      refresh();
    }));
    document.getElementById("select-all").addEventListener("click", () => {
      view.querySelectorAll("[data-seg]").forEach((cb) => { cb.checked = true; });
      setup.slides = segs.map((s) => s.index);
      refresh();
    });
    document.getElementById("select-none").addEventListener("click", () => {
      view.querySelectorAll("[data-seg]").forEach((cb) => { cb.checked = false; });
      setup.slides = [];
      refresh();
    });
    startBtn.addEventListener("click", () => {
      const slides = chosen();
      if (!slides.length) { toast(t("quiz.noSlides")); return; }
      startQuiz(lecture, { mode: setup.mode, slides: slides.slice(), total: segs.length });
    });
    refresh();
  }

  async function startQuiz(lecture, scope) {
    const token = ++renderToken;
    const lang = window.I18N.lang;
    const all = scope.mode === "all" || scope.slides.length >= scope.total;
    view.innerHTML = `${quizHeader(lecture)}<div class="card">${spinner(t("quiz.generating"))}</div>`;
    let data;
    try {
      data = await window.AI.quiz(lecture, { slideIndexes: all ? null : scope.slides, count: window.APP_CONFIG.quizCountFor(scope.slides.length) });
    } catch (err) {
      console.error(err);
      data = { questions: [] };
    }
    if (token !== renderToken) return; // user navigated or switched language meanwhile
    if (!data.questions || !data.questions.length) {
      quiz = null;
      renderQuizSetup(lecture);
      document.getElementById("quiz-status").innerHTML = `<div class="alert alert-error">${esc(t("quiz.notEnough"))}</div>`;
      return;
    }
    quiz = { lectureId: lecture.id, lang, scope, questions: data.questions, index: 0, selected: null, checked: false, score: 0 };
    drawQuiz(lecture);
  }

  function drawQuiz(lecture) {
    const q = quiz.questions[quiz.index];
    const total = quiz.questions.length;
    if (!q || quiz.index >= total) return drawQuizResult(lecture);

    const pct = Math.round((quiz.index / total) * 100);
    const options = q.options.map((o, i) => {
      let cls = "option";
      if (quiz.checked) { if (i === q.answerIndex) cls += " correct"; else if (i === quiz.selected) cls += " wrong"; }
      else if (i === quiz.selected) cls += " selected";
      return `<button class="${cls}" data-opt="${i}" ${quiz.checked ? "disabled" : ""}><span class="letter">${letter(i)}</span><span dir="auto">${esc(o)}</span></button>`;
    }).join("");
    const isCorrect = quiz.checked && quiz.selected === q.answerIndex;
    const others = (q.whyOthers || []).map((w, i) => (i === q.answerIndex || !w) ? "" : `<li dir="auto"><strong>${letter(i)}.</strong> ${esc(w)}</li>`).join("");
    const feedback = quiz.checked ? `
      <div class="feedback ${isCorrect ? "ok" : "bad"}">
        <strong>${esc(isCorrect ? t("quiz.correct") : t("quiz.incorrect"))}</strong>
        ${isCorrect ? "" : `<div>${esc(t("quiz.correctAnswer"))} <b dir="auto">${esc(q.options[q.answerIndex])}</b></div>`}
        <div class="small" style="margin-top:.4rem" dir="auto"><em>${esc(t("quiz.explanation"))}:</em> ${esc(q.explanation)}</div>
        ${others ? `<div class="small" style="margin-top:.6rem"><em>${esc(t("quiz.whyOthers"))}:</em><ul class="why-others">${others}</ul></div>` : ""}
      </div>` : "";
    const last = quiz.index === total - 1;

    view.innerHTML = `
      ${quizHeader(lecture)}
      <div class="card">
        <div class="progress-bar"><span style="width:${pct}%"></span></div>
        <div class="question-count">${esc(t("quiz.question"))} ${quiz.index + 1} ${esc(t("quiz.of"))} ${total}</div>
        ${q.scenario ? `<div class="scenario" dir="auto">${esc(q.scenario)}</div>` : ""}
        <div class="question-text" dir="auto">${esc(q.question)}</div>
        <div class="options">${options}</div>
        ${feedback}
        <div class="btn-row">
          ${quiz.checked
            ? `<button class="btn btn-primary" id="next">${esc(last ? t("quiz.finish") : t("quiz.next"))}</button>`
            : `<button class="btn btn-primary" id="check" ${quiz.selected == null ? "disabled" : ""}>${esc(t("quiz.check"))}</button>`}
          <a class="btn btn-ghost" href="#/lecture/${lecture.id}">${esc(t("quiz.backToLecture"))}</a>
        </div>
      </div>`;

    view.querySelectorAll("[data-opt]").forEach((b) => b.addEventListener("click", () => { quiz.selected = +b.getAttribute("data-opt"); drawQuiz(lecture); }));
    const check = document.getElementById("check");
    if (check) check.addEventListener("click", () => { quiz.checked = true; if (quiz.selected === q.answerIndex) quiz.score++; drawQuiz(lecture); });
    const next = document.getElementById("next");
    if (next) next.addEventListener("click", () => { quiz.index++; quiz.selected = null; quiz.checked = false; drawQuiz(lecture); window.scrollTo(0, 0); });
  }

  function drawQuizResult(lecture) {
    const total = quiz.questions.length;
    const ratio = total ? quiz.score / total : 0;
    const msg = ratio >= 0.8 ? t("quiz.great") : ratio >= 0.5 ? t("quiz.good") : t("quiz.weak");
    view.innerHTML = `
      ${quizHeader(lecture)}
      <div class="card score">
        <div class="muted">${esc(t("quiz.result"))}</div>
        <div class="big">${quiz.score} / ${total}</div>
        <p>${esc(msg)}</p>
        <div class="btn-row" style="justify-content:center">
          <button class="btn btn-primary" id="retry">${esc(t("quiz.retry"))}</button>
          <button class="btn btn-secondary" id="change-scope">${esc(t("quiz.changeScope"))}</button>
          <a class="btn btn-secondary" href="#/case/${lecture.id}">${esc(t("quiz.goCase"))}</a>
          <a class="btn btn-ghost" href="#/lecture/${lecture.id}">${esc(t("quiz.backToLecture"))}</a>
        </div>
      </div>`;
    document.getElementById("retry").addEventListener("click", () => startQuiz(lecture, quiz.scope));
    document.getElementById("change-scope").addEventListener("click", () => { quiz = null; renderQuizSetup(lecture); });
  }

  /* ---------- clinical case ---------- */
  let cs = null;
  async function renderCase(id) {
    if (!id) return renderPicker("case.title", "case.subtitle", "case.choose", "case.noLectures", "#/case");
    const lecture = window.Store.get(id);
    if (!lecture) return renderPicker("case.title", "case.subtitle", "case.choose", "case.noLectures", "#/case");
    window.Store.setLastId(id);

    if (!cs || cs.lectureId !== id || cs.lang !== window.I18N.lang) {
      const token = ++renderToken;
      const lang = window.I18N.lang;
      view.innerHTML = `<div class="page-header"><h1>${esc(t("case.title"))}</h1><p>${esc(lecture.title)}</p></div><div class="card">${spinner(t("case.generating"))}</div>`;
      const data = await window.AI.clinicalCase(lecture);
      if (token !== renderToken) return; // user navigated or switched language meanwhile
      cs = { lectureId: id, lang, data, index: 0, selected: null, answer: "", submitted: false };
    }
    drawCase(lecture);
  }

  function drawCase(lecture) {
    const d = cs.data;
    const q = d.questions[cs.index];
    const total = d.questions.length;
    const presentation = `
      <div class="card case-presentation">
        <h2>${esc(t("case.patient"))}</h2>
        ${d.presentation.map((p) => `<p dir="auto">${esc(p)}</p>`).join("")}
      </div>`;

    let body;
    if (!q) {
      body = `<div class="card score">
        <h2>${esc(t("case.done"))}</h2><p class="muted">${esc(t("case.doneText"))}</p>
        <div class="btn-row" style="justify-content:center">
          <button class="btn btn-primary" id="new-case">${esc(t("case.newCase"))}</button>
          <a class="btn btn-ghost" href="#/lecture/${lecture.id}">${esc(t("case.backToLecture"))}</a>
        </div></div>`;
    } else if (q.type === "mcq") {
      const options = q.options.map((o, i) => {
        let cls = "option";
        if (cs.submitted) { if (i === q.answerIndex) cls += " correct"; else if (i === cs.selected) cls += " wrong"; }
        else if (i === cs.selected) cls += " selected";
        return `<button class="${cls}" data-opt="${i}" ${cs.submitted ? "disabled" : ""}><span class="letter">${letter(i)}</span><span dir="auto">${esc(o)}</span></button>`;
      }).join("");
      const ok = cs.submitted && cs.selected === q.answerIndex;
      body = `<div class="card">
        <div class="question-count">${esc(t("case.questionsTitle"))} · ${cs.index + 1} / ${total}</div>
        <div class="question-text" dir="auto">${esc(q.question)}</div>
        <div class="options">${options}</div>
        ${cs.submitted ? `<div class="feedback ${ok ? "ok" : "bad"}"><strong>${esc(ok ? t("quiz.correct") : t("quiz.incorrect"))}</strong><div dir="auto">${esc(q.feedback)}</div></div>` : ""}
        ${caseButtons(lecture, total)}
      </div>`;
    } else {
      const feedbackText = cs.submitted ? window.AIProviders.mock.gradeOpen(cs.answer, q, window.I18N.lang) : "";
      body = `<div class="card">
        <div class="question-count">${esc(t("case.questionsTitle"))} · ${cs.index + 1} / ${total}</div>
        <div class="question-text" dir="auto">${esc(q.question)}</div>
        ${cs.submitted
          ? `<p class="muted small">${esc(t("case.yourAnswer"))}</p><p dir="auto">${nl2br(cs.answer)}</p>
             <div class="feedback"><strong>${esc(t("case.feedback"))}</strong><div dir="auto">${esc(feedbackText)}</div>
             <div style="margin-top:.6rem"><strong>${esc(t("case.modelAnswer"))}</strong><div dir="auto">${esc(q.modelAnswer)}</div></div></div>`
          : `<textarea class="answer" id="answer" placeholder="${esc(t("case.answerPlaceholder"))}">${esc(cs.answer)}</textarea>`}
        ${caseButtons(lecture, total)}
      </div>`;
    }

    view.innerHTML = `<div class="page-header"><h1>${esc(t("case.title"))}</h1><p>${esc(lecture.title)}</p></div>${presentation}${body}`;

    view.querySelectorAll("[data-opt]").forEach((b) => b.addEventListener("click", () => { cs.selected = +b.getAttribute("data-opt"); drawCase(lecture); }));
    const submit = document.getElementById("submit");
    if (submit) submit.addEventListener("click", () => {
      if (q.type === "open") {
        const val = document.getElementById("answer").value.trim();
        if (!val) { toast(t("case.openEmpty")); return; }
        cs.answer = val;
      } else if (cs.selected == null) return;
      cs.submitted = true;
      drawCase(lecture);
    });
    const next = document.getElementById("next");
    if (next) next.addEventListener("click", () => { cs.index++; cs.selected = null; cs.answer = ""; cs.submitted = false; drawCase(lecture); });
    const nc = document.getElementById("new-case");
    if (nc) nc.addEventListener("click", () => { cs = null; renderCase(lecture.id); });
  }

  function caseButtons(lecture, total) {
    const last = cs.index === total - 1;
    return `<div class="btn-row">
      ${cs.submitted
        ? `<button class="btn btn-primary" id="next">${esc(last ? t("case.finish") : t("case.next"))}</button>`
        : `<button class="btn btn-primary" id="submit">${esc(t("case.submit"))}</button>`}
      <a class="btn btn-ghost" href="#/lecture/${lecture.id}">${esc(t("case.backToLecture"))}</a>
    </div>`;
  }

  /* ---------- router ---------- */
  let renderToken = 0; // invalidates in-flight async renders on navigation / language change
  function route() {
    renderToken++;
    const hash = location.hash || "#/";
    const parts = hash.replace(/^#\/?/, "").split("/");
    const page = parts[0] || "dashboard";
    const id = parts[1];
    window.scrollTo(0, 0);

    document.querySelectorAll("[data-route]").forEach((a) => {
      const r = a.getAttribute("data-route");
      a.classList.toggle("active", r === page || (page === "lecture" && r === "lectures"));
    });

    switch (page) {
      case "upload": return renderUpload();
      case "lectures": return renderLectures();
      case "lecture": return renderLecture(id);
      case "quiz": return renderQuiz(id);
      case "case": return renderCase(id);
      default: return renderDashboard();
    }
  }

  /* ---------- init ---------- */
  document.querySelectorAll("[data-lang]").forEach((b) => b.addEventListener("click", () => window.I18N.setLang(b.getAttribute("data-lang"))));
  document.addEventListener("langchange", route);
  window.addEventListener("hashchange", route);
  window.I18N.apply();
  route();
})();
