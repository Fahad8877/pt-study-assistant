/* Simple i18n: dictionary lookup + RTL handling. */
(function () {
  const dict = {
    en: {
      "app.name": "PT Study Assistant",
      "nav.dashboard": "Dashboard",
      "nav.upload": "Upload",
      "nav.lectures": "My Lectures",
      "nav.quiz": "Quiz",
      "nav.case": "Clinical Case",

      "dash.title": "Dashboard",
      "dash.subtitle": "Study your Physical Therapy lectures with an AI assistant.",
      "dash.continue": "Continue Studying",
      "dash.continue.empty": "No lectures yet. Upload your first lecture to get started.",
      "dash.continue.btn": "Continue",
      "dash.lastOpened": "Last opened",
      "dash.upload": "Upload Lecture",
      "dash.upload.desc": "Add a PDF or PowerPoint lecture.",
      "dash.lectures": "My Lectures",
      "dash.lectures.desc": "Browse everything you have uploaded.",
      "dash.quiz": "Quiz",
      "dash.quiz.desc": "Test yourself on a lecture.",
      "dash.case": "Clinical Case",
      "dash.case.desc": "Apply the lecture to a patient scenario.",

      "upload.title": "Upload Lecture",
      "upload.subtitle": "Upload a PDF or PowerPoint file. The assistant will read it and prepare study material.",
      "upload.drop": "Drag & drop your lecture here",
      "upload.browse": "or click to browse files",
      "upload.hint": "Supported formats: PDF (.pdf) and PowerPoint (.pptx)",
      "upload.sample": "Try a sample lecture",
      "upload.reading": "Reading file…",
      "upload.analyzing": "Analyzing lecture content…",
      "upload.error.type": "Unsupported file type. Please upload a .pdf or .pptx file.",
      "upload.error.empty": "No readable text was found in this file. Scanned images are not supported yet.",
      "upload.error.generic": "Something went wrong while reading the file.",
      "upload.success": "Lecture uploaded and analyzed.",

      "lectures.title": "My Lectures",
      "lectures.empty": "You have not uploaded any lectures yet.",
      "lectures.open": "Open",
      "lectures.delete": "Delete",
      "lectures.confirmDelete": "Delete this lecture and its study material?",
      "lectures.pages": "pages",
      "lectures.slides": "slides",
      "lectures.words": "words",

      "lecture.tab.explain": "Simple Explanation",
      "lecture.tab.summary": "Summary",
      "lecture.tab.concepts": "Key Concepts",
      "lecture.tab.terms": "Terms & Definitions",
      "lecture.tab.content": "Lecture Content",
      "lecture.startQuiz": "Start Quiz",
      "lecture.startCase": "Clinical Case",
      "lecture.reanalyze": "Re-analyze",
      "lecture.notFound": "Lecture not found.",
      "lecture.analyzing": "Preparing study material…",
      "lecture.summaryIntro": "The most important points from this lecture:",
      "lecture.conceptsIntro": "Concepts you should be able to explain after studying this lecture:",
      "lecture.termsIntro": "Important terms mentioned in this lecture:",
      "lecture.contentNote": "Text extracted from the uploaded file.",

      "quiz.title": "Quiz",
      "quiz.subtitle": "Multiple-choice questions based only on the selected lecture.",
      "quiz.choose": "Choose a lecture to start a quiz:",
      "quiz.noLectures": "Upload a lecture first to generate a quiz.",
      "quiz.generating": "Generating quiz…",
      "quiz.question": "Question",
      "quiz.of": "of",
      "quiz.check": "Check answer",
      "quiz.next": "Next question",
      "quiz.finish": "See results",
      "quiz.correct": "Correct!",
      "quiz.incorrect": "Not quite.",
      "quiz.correctAnswer": "Correct answer:",
      "quiz.explanation": "Explanation",
      "quiz.result": "Your score",
      "quiz.retry": "Try again",
      "quiz.backToLecture": "Back to lecture",
      "quiz.goCase": "Try a clinical case",
      "quiz.great": "Excellent work! You know this lecture well.",
      "quiz.good": "Good job. Review the questions you missed.",
      "quiz.weak": "Keep studying. Go back to the summary and key concepts, then try again.",

      "case.title": "Clinical Case",
      "case.subtitle": "A simple patient scenario based on the selected lecture.",
      "case.choose": "Choose a lecture to generate a clinical case:",
      "case.noLectures": "Upload a lecture first to generate a clinical case.",
      "case.generating": "Preparing clinical case…",
      "case.patient": "Patient Presentation",
      "case.questionsTitle": "Your Assessment",
      "case.submit": "Submit answer",
      "case.next": "Next question",
      "case.finish": "Finish case",
      "case.feedback": "Feedback",
      "case.modelAnswer": "Model answer",
      "case.yourAnswer": "Your answer",
      "case.answerPlaceholder": "Write your answer here…",
      "case.done": "Case completed",
      "case.doneText": "You have worked through this case. Review the feedback above, then revisit the lecture summary if anything was unclear.",
      "case.newCase": "New case",
      "case.backToLecture": "Back to lecture",
      "case.openEmpty": "Please write an answer before submitting.",

      "common.back": "Back",
      "common.loading": "Loading…",
      "common.cancel": "Cancel",
      "common.confirm": "Confirm",
      "common.uploaded": "Uploaded",
      "common.select": "Select",
      "common.mockNote": "Demo mode: responses are generated locally from the lecture text. Connect a real AI API in js/config.js.",
    },

    ar: {
      "app.name": "مساعد دراسة العلاج الطبيعي",
      "nav.dashboard": "الرئيسية",
      "nav.upload": "رفع محاضرة",
      "nav.lectures": "محاضراتي",
      "nav.quiz": "اختبار",
      "nav.case": "حالة سريرية",

      "dash.title": "الرئيسية",
      "dash.subtitle": "ادرس محاضرات العلاج الطبيعي بمساعدة الذكاء الاصطناعي.",
      "dash.continue": "متابعة الدراسة",
      "dash.continue.empty": "لا توجد محاضرات بعد. ارفع محاضرتك الأولى للبدء.",
      "dash.continue.btn": "متابعة",
      "dash.lastOpened": "آخر فتح",
      "dash.upload": "رفع محاضرة",
      "dash.upload.desc": "أضف محاضرة بصيغة PDF أو PowerPoint.",
      "dash.lectures": "محاضراتي",
      "dash.lectures.desc": "تصفح كل ما قمت برفعه.",
      "dash.quiz": "اختبار",
      "dash.quiz.desc": "اختبر نفسك في محاضرة.",
      "dash.case": "حالة سريرية",
      "dash.case.desc": "طبّق المحاضرة على حالة مريض.",

      "upload.title": "رفع محاضرة",
      "upload.subtitle": "ارفع ملف PDF أو PowerPoint. سيقرأ المساعد الملف ويجهّز مواد الدراسة.",
      "upload.drop": "اسحب المحاضرة وأفلتها هنا",
      "upload.browse": "أو اضغط لاختيار ملف",
      "upload.hint": "الصيغ المدعومة: PDF (.pdf) و PowerPoint (.pptx)",
      "upload.sample": "جرّب محاضرة تجريبية",
      "upload.reading": "جارٍ قراءة الملف…",
      "upload.analyzing": "جارٍ تحليل محتوى المحاضرة…",
      "upload.error.type": "نوع الملف غير مدعوم. يرجى رفع ملف ‎.pdf أو ‎.pptx.",
      "upload.error.empty": "لم يتم العثور على نص قابل للقراءة في هذا الملف. الصور الممسوحة ضوئيًا غير مدعومة حاليًا.",
      "upload.error.generic": "حدث خطأ أثناء قراءة الملف.",
      "upload.success": "تم رفع المحاضرة وتحليلها.",

      "lectures.title": "محاضراتي",
      "lectures.empty": "لم تقم برفع أي محاضرات بعد.",
      "lectures.open": "فتح",
      "lectures.delete": "حذف",
      "lectures.confirmDelete": "هل تريد حذف هذه المحاضرة ومواد الدراسة الخاصة بها؟",
      "lectures.pages": "صفحة",
      "lectures.slides": "شريحة",
      "lectures.words": "كلمة",

      "lecture.tab.explain": "شرح مبسّط",
      "lecture.tab.summary": "ملخص",
      "lecture.tab.concepts": "المفاهيم الأساسية",
      "lecture.tab.terms": "المصطلحات والتعريفات",
      "lecture.tab.content": "محتوى المحاضرة",
      "lecture.startQuiz": "ابدأ الاختبار",
      "lecture.startCase": "حالة سريرية",
      "lecture.reanalyze": "إعادة التحليل",
      "lecture.notFound": "المحاضرة غير موجودة.",
      "lecture.analyzing": "جارٍ تجهيز مواد الدراسة…",
      "lecture.summaryIntro": "أهم النقاط في هذه المحاضرة:",
      "lecture.conceptsIntro": "المفاهيم التي يجب أن تكون قادرًا على شرحها بعد دراسة هذه المحاضرة:",
      "lecture.termsIntro": "مصطلحات مهمة وردت في هذه المحاضرة:",
      "lecture.contentNote": "النص المستخرج من الملف المرفوع.",

      "quiz.title": "اختبار",
      "quiz.subtitle": "أسئلة اختيار من متعدد مبنية فقط على المحاضرة المختارة.",
      "quiz.choose": "اختر محاضرة لبدء الاختبار:",
      "quiz.noLectures": "ارفع محاضرة أولًا لإنشاء اختبار.",
      "quiz.generating": "جارٍ إنشاء الاختبار…",
      "quiz.question": "السؤال",
      "quiz.of": "من",
      "quiz.check": "تحقق من الإجابة",
      "quiz.next": "السؤال التالي",
      "quiz.finish": "عرض النتيجة",
      "quiz.correct": "إجابة صحيحة!",
      "quiz.incorrect": "ليست صحيحة.",
      "quiz.correctAnswer": "الإجابة الصحيحة:",
      "quiz.explanation": "التوضيح",
      "quiz.result": "نتيجتك",
      "quiz.retry": "أعد المحاولة",
      "quiz.backToLecture": "العودة إلى المحاضرة",
      "quiz.goCase": "جرّب حالة سريرية",
      "quiz.great": "ممتاز! أنت تتقن هذه المحاضرة.",
      "quiz.good": "عمل جيد. راجع الأسئلة التي أخطأت فيها.",
      "quiz.weak": "واصل الدراسة. عد إلى الملخص والمفاهيم الأساسية ثم حاول مجددًا.",

      "case.title": "حالة سريرية",
      "case.subtitle": "سيناريو مريض مبسّط مبني على المحاضرة المختارة.",
      "case.choose": "اختر محاضرة لإنشاء حالة سريرية:",
      "case.noLectures": "ارفع محاضرة أولًا لإنشاء حالة سريرية.",
      "case.generating": "جارٍ تجهيز الحالة السريرية…",
      "case.patient": "عرض الحالة",
      "case.questionsTitle": "تقييمك",
      "case.submit": "إرسال الإجابة",
      "case.next": "السؤال التالي",
      "case.finish": "إنهاء الحالة",
      "case.feedback": "التغذية الراجعة",
      "case.modelAnswer": "الإجابة النموذجية",
      "case.yourAnswer": "إجابتك",
      "case.answerPlaceholder": "اكتب إجابتك هنا…",
      "case.done": "اكتملت الحالة",
      "case.doneText": "لقد أنهيت هذه الحالة. راجع التغذية الراجعة أعلاه، ثم عد إلى ملخص المحاضرة إذا كان هناك شيء غير واضح.",
      "case.newCase": "حالة جديدة",
      "case.backToLecture": "العودة إلى المحاضرة",
      "case.openEmpty": "يرجى كتابة إجابة قبل الإرسال.",

      "common.back": "رجوع",
      "common.loading": "جارٍ التحميل…",
      "common.cancel": "إلغاء",
      "common.confirm": "تأكيد",
      "common.uploaded": "تم الرفع",
      "common.select": "اختيار",
      "common.mockNote": "وضع العرض التجريبي: يتم توليد الردود محليًا من نص المحاضرة. يمكنك ربط واجهة ذكاء اصطناعي حقيقية من ملف js/config.js.",
    },
  };

  let current = "en";
  try {
    const saved = localStorage.getItem("pt.lang");
    if (saved === "ar" || saved === "en") current = saved;
  } catch (e) { /* ignore */ }

  function t(key) {
    return (dict[current] && dict[current][key]) || dict.en[key] || key;
  }

  function apply() {
    document.documentElement.lang = current;
    document.documentElement.dir = current === "ar" ? "rtl" : "ltr";
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-lang]").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-lang") === current);
    });
    document.title = t("app.name");
  }

  function setLang(lang) {
    current = lang === "ar" ? "ar" : "en";
    try { localStorage.setItem("pt.lang", current); } catch (e) { /* ignore */ }
    apply();
    document.dispatchEvent(new CustomEvent("langchange", { detail: current }));
  }

  window.I18N = { t, apply, setLang, get lang() { return current; } };
})();
