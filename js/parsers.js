/* Client-side text extraction for PDF (pdf.js) and PPTX (JSZip). */
(function () {
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  function detectType(file) {
    const name = (file.name || "").toLowerCase();
    if (name.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
    if (
      name.endsWith(".pptx") ||
      file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ) return "pptx";
    return null;
  }

  async function parsePdf(arrayBuffer) {
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      let text = "";
      content.items.forEach((item) => {
        if (!item.str) return;
        text += item.str;
        text += item.hasEOL ? "\n" : " ";
      });
      pages.push(text.trim());
    }
    return { text: pages.join("\n\n"), parts: pages, units: pdf.numPages, unitType: "pages" };
  }

  function decodeXml(s) {
    return s
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
      .replace(/&amp;/g, "&");
  }

  function slideXmlToText(xml) {
    // Paragraphs -> line breaks, runs -> concatenated text.
    const paragraphs = xml.split(/<\/a:p>/);
    const lines = paragraphs.map((p) => {
      const runs = [];
      const re = /<a:t[^>]*>([^<]*)<\/a:t>/g;
      let m;
      while ((m = re.exec(p))) runs.push(decodeXml(m[1]));
      return runs.join("").trim();
    }).filter(Boolean);
    return lines.join("\n");
  }

  async function parsePptx(arrayBuffer) {
    const zip = await window.JSZip.loadAsync(arrayBuffer);
    const slideFiles = Object.keys(zip.files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));
    const slides = [];
    for (const name of slideFiles) {
      const xml = await zip.file(name).async("string");
      slides.push(slideXmlToText(xml));
    }
    return { text: slides.join("\n\n"), parts: slides, units: slides.length, unitType: "slides" };
  }

  /**
   * Splits a lecture into its slides/pages. Uses the stored per-unit text when
   * available, otherwise falls back to blank-line separated blocks.
   * Returns [{ index, number, title, text }].
   */
  function segments(lecture) {
    let parts;
    if (Array.isArray(lecture.segments) && lecture.segments.length) {
      parts = lecture.segments.map((s) => ({ number: s.number, text: s.text }));
    } else {
      parts = (lecture.text || "").split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean).map((t, i) => ({ number: i + 1, text: t }));
    }
    return parts.map((p, index) => {
      const firstLine = p.text.split("\n")[0].trim();
      const title = firstLine.length <= 70 ? firstLine : firstLine.slice(0, 60).replace(/\s+\S*$/, "") + "…";
      return { index, number: p.number, title, text: p.text };
    });
  }

  async function parseFile(file) {
    const type = detectType(file);
    if (!type) throw new Error("UNSUPPORTED_TYPE");
    const buf = await file.arrayBuffer();
    const result = type === "pdf" ? await parsePdf(buf) : await parsePptx(buf);
    result.fileType = type;
    result.text = normalize(result.text);
    if (result.text.replace(/\s+/g, "").length < 40) throw new Error("EMPTY_TEXT");
    return result;
  }

  function normalize(text) {
    return text
      .replace(/\r/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function titleFromFilename(name) {
    return (name || "Lecture")
      .replace(/\.(pdf|pptx)$/i, "")
      .replace(/[_\-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  window.Parsers = { parseFile, detectType, titleFromFilename, normalize, segments };
})();
