/**
 * Client-side document processing for PDF (pdf.js) and PPTX (JSZip).
 *
 * Produces, per page/slide, a structured record that preserves the document's
 * visual structure so nothing is dropped before it reaches the AI layer:
 *   { number, title, text, markdown, bullets: [{level, text}], tables: [[cells]],
 *     notes, imageCount }
 * plus page/slide images (JPEG data URLs) for vision-capable models:
 *   PDF  – every page is rendered to an image (tables, diagrams, charts survive)
 *   PPTX – every embedded picture is extracted (diagrams, flowcharts, figures)
 */
(function () {
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  /**
   * Presentation layout metadata vs. medical substance.
   * Layout labels are structural (section titles, navigation, numbering) and must never be
   * treated as clinical entities, definitions or answer options downstream.
   */
  const LAYOUT_WORDS = "categories|category|overview|introduction|intro|background|objectives?|learning objectives?|aims?|goals?|outline|contents?|table of contents|agenda|summary|conclusions?|references?|reading|further reading|thank you|thanks|questions?|q ?& ?a|discussion|notes?|key points?|take[- ]home( messages?| points?)?|review|recap|definitions?|terminology|general|topics?|content|main points?|end|the end|any questions|welcome|title|subtitle|section|part|chapter|unit|lecture|module|week|session|slide|page|continued|cont\\.?'?d?|cont|next|previous|appendix";
  const LAYOUT_LABEL_RE = new RegExp(`^\\s*(?:(?:${LAYOUT_WORDS})\\s*(?:[:\\-–—]\\s*)?(?:\\d+|[ivx]+|[a-z])?\\s*(?:of\\s+\\d+)?|\\d+\\s*(?:/|of)\\s*\\d+|\\d+)\\s*[.:)]?\\s*$`, "i");
  const LAYOUT_PREFIX_RE = new RegExp(`^\\s*(?:${LAYOUT_WORDS})\\s*(?:\\d+)?\\s*[:\\-–—]\\s*`, "i");

  /** True when a line is a structural/layout label with no medical substance. */
  const AUTHOR_META_RE = /^(?:master|bachelor|doctor|phd|msc|bsc|dr\.?|prof\.?|professor|presented by|prepared by|by:|department of|dept\.? of|faculty of|college of|school of|university|institute|course|instructor|lecturer|academic year|semester|date:|\d{1,2}\/\d{1,2}\/\d{2,4})\b/i;
  function isLayoutLabel(text) {
    const t = String(text || "").trim();
    if (!t) return true;
    if (LAYOUT_LABEL_RE.test(t)) return true;
    if (AUTHOR_META_RE.test(t) && t.split(/\s+/).length <= 8) return true; // course / author / affiliation lines
    // two-word generic headings such as "General Overview", "Course Objectives", "Lecture Outline"
    const words = t.toLowerCase().replace(/[^a-z\s]/g, "").trim().split(/\s+/);
    if (words.length <= 3 && words.every((w) => new RegExp(`^(?:${LAYOUT_WORDS}|course|of|the|and|to)$`, "i").test(w))) return true;
    return false;
  }
  /** Strips a leading layout prefix ("Categories: ...", "Summary - ...") from a content line. */
  function stripLayoutPrefix(text) {
    return String(text || "").replace(LAYOUT_PREFIX_RE, "").trim();
  }

  const LIMITS = {
    maxRenderedPages: 60,   // PDF pages rendered to images
    maxImagesPerSlide: 4,   // PPTX pictures kept per slide
    maxTotalImages: 80,
    imageMaxSide: 1280,     // px, longest side after downscaling
    imageQuality: 0.72,     // JPEG quality
  };

  function detectType(file) {
    const name = (file.name || "").toLowerCase();
    if (name.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
    if (
      name.endsWith(".pptx") ||
      file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ) return "pptx";
    return null;
  }

  /* ---------- image helpers ---------- */

  function canvasToJpeg(canvas) {
    return canvas.toDataURL("image/jpeg", LIMITS.imageQuality);
  }

  /** Downscale a Blob image to a JPEG data URL (longest side <= imageMaxSide). */
  function blobToJpegDataUrl(blob) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, LIMITS.imageMaxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvasToJpeg(canvas));
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  /* ---------- PDF ---------- */

  async function parsePdf(arrayBuffer, onProgress) {
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const slides = [];
    const images = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();

      // Rebuild lines from text items (pdf.js gives positioned runs).
      const lines = [];
      let line = "";
      content.items.forEach((item) => {
        if (!item.str) return;
        line += item.str;
        if (item.hasEOL) { lines.push(line.trim()); line = ""; } else line += " ";
      });
      if (line.trim()) lines.push(line.trim());
      const cleanLines = lines.map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
      const hasTitle = !!(cleanLines[0] && cleanLines[0].length <= 90);
      const title = hasTitle ? cleanLines[0] : `Page ${p}`;
      const bullets = (hasTitle ? cleanLines.slice(1) : cleanLines).map((l) => ({ level: /^[•·\-–—*▪◦]\s/.test(l) ? 1 : 0, text: l.replace(/^[•·\-–—*▪◦]\s*/, "") }));

      // Render the page to an image so tables, diagrams and charts are preserved.
      let imageCount = 0;
      if (p <= LIMITS.maxRenderedPages) {
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(2, LIMITS.imageMaxSide / Math.max(base.width, base.height));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        // "print" intent renders synchronously-scheduled (no requestAnimationFrame), so it
        // completes even when the tab is in the background.
        await page.render({ canvasContext: canvas.getContext("2d"), viewport, intent: "print" }).promise;
        images.push({ slide: p, kind: "page", dataUrl: canvasToJpeg(canvas) });
        imageCount = 1;
      }

      const record = { number: p, title, text: "", bullets, tables: [], notes: "", imageCount };
      finalizeContent(record);
      record.text = [record.title].concat(record.bullets.map((b) => b.text)).join("\n");
      record.markdown = slideMarkdown(record, "Page");
      slides.push(record);
      if (onProgress) onProgress(p, pdf.numPages);
    }
    return { slides, images, units: pdf.numPages, unitType: "pages" };
  }

  /* ---------- PPTX ---------- */

  function decodeXml(s) {
    return s
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
      .replace(/&amp;/g, "&");
  }

  function parseXml(xml) {
    return new DOMParser().parseFromString(xml, "application/xml");
  }

  const A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
  const P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main";
  const R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

  function paragraphsOf(node) {
    const out = [];
    const paras = node.getElementsByTagNameNS(A_NS, "p");
    for (const p of paras) {
      const runs = p.getElementsByTagNameNS(A_NS, "t");
      let text = "";
      for (const t of runs) text += t.textContent;
      text = text.replace(/\s+/g, " ").trim();
      if (!text) continue;
      const pPr = p.getElementsByTagNameNS(A_NS, "pPr")[0];
      const level = pPr && pPr.getAttribute("lvl") ? parseInt(pPr.getAttribute("lvl"), 10) : 0;
      out.push({ level, text });
    }
    return out;
  }

  function slideFromXml(xml, number) {
    const doc = parseXml(xml);
    const spTree = doc.getElementsByTagNameNS(P_NS, "spTree")[0];
    const result = { number, title: "", bullets: [], tables: [], notes: "", imageCount: 0 };
    if (!spTree) return result;
    for (const el of spTree.children) {
      const local = el.localName;
      if (local === "sp") {
        const ph = el.getElementsByTagNameNS(P_NS, "ph")[0];
        const phType = ph ? (ph.getAttribute("type") || "body") : "";
        const paras = paragraphsOf(el);
        if (!paras.length) continue;
        if ((phType === "title" || phType === "ctrTitle") && !result.title) {
          result.title = paras.map((x) => x.text).join(" ");
        } else if (phType === "sldNum" || phType === "ftr" || phType === "dt") {
          // slide number / footer / date placeholders are not content
        } else {
          result.bullets.push(...paras);
        }
      } else if (local === "grpSp") {
        result.bullets.push(...paragraphsOf(el));
      } else if (local === "pic") {
        result.imageCount++;
      } else if (local === "graphicFrame") {
        const tbl = el.getElementsByTagNameNS(A_NS, "tbl")[0];
        if (tbl) {
          const rows = [];
          for (const tr of tbl.getElementsByTagNameNS(A_NS, "tr")) {
            const cells = [];
            for (const tc of tr.getElementsByTagNameNS(A_NS, "tc")) {
              cells.push(paragraphsOf(tc).map((x) => x.text).join(" / "));
            }
            rows.push(cells);
          }
          if (rows.length) result.tables.push(rows);
        } else {
          // SmartArt / charts: text is inside diagram data parts; handled by caller via rels
          const paras = paragraphsOf(el);
          if (paras.length) result.bullets.push(...paras);
        }
      }
    }
    if (!result.title && result.bullets.length && result.bullets[0].text.length <= 90) {
      result.title = result.bullets.shift().text;
    }
    if (!result.title) result.title = `Slide ${number}`;
    finalizeContent(result);
    return result;
  }

  /** Marks layout-only titles and removes layout labels from the content bullets (numbers and substance are kept). */
  function finalizeContent(slide) {
    slide.layoutTitle = isLayoutLabel(slide.title);
    slide.bullets = slide.bullets
      .filter((b) => !isLayoutLabel(b.text))
      .map((b) => ({ level: b.level, text: stripLayoutPrefix(b.text) }))
      .filter((b) => b.text);
  }

  function relsOf(zip, slidePath) {
    const relPath = slidePath.replace(/slides\/(slide\d+\.xml)$/, "slides/_rels/$1.rels");
    const f = zip.file(relPath);
    return f ? f.async("string").then((xml) => {
      const doc = parseXml(xml);
      return [...doc.getElementsByTagName("Relationship")].map((r) => ({
        id: r.getAttribute("Id"), type: r.getAttribute("Type") || "", target: r.getAttribute("Target") || "",
      }));
    }) : Promise.resolve([]);
  }

  function resolvePath(base, target) {
    const parts = base.split("/").slice(0, -1);
    target.split("/").forEach((seg) => { if (seg === "..") parts.pop(); else if (seg !== ".") parts.push(seg); });
    return parts.join("/");
  }

  async function parsePptx(arrayBuffer, onProgress) {
    const zip = await window.JSZip.loadAsync(arrayBuffer);
    // Slide order from presentation.xml
    let order = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));
    try {
      const presXml = await zip.file("ppt/presentation.xml").async("string");
      const presRels = await zip.file("ppt/_rels/presentation.xml.rels").async("string");
      const ids = [...parseXml(presXml).getElementsByTagNameNS(P_NS, "sldId")].map((e) => e.getAttributeNS(R_NS, "id"));
      const rels = [...parseXml(presRels).getElementsByTagName("Relationship")];
      const ordered = ids.map((id) => { const r = rels.find((x) => x.getAttribute("Id") === id); return r ? "ppt/" + r.getAttribute("Target").replace(/^\/?ppt\//, "") : null; }).filter(Boolean);
      if (ordered.length) order = ordered;
    } catch (e) { /* fall back to filename order */ }

    const slides = [];
    const images = [];
    let n = 0;
    for (const path of order) {
      n++;
      const xml = await zip.file(path).async("string");
      const slide = slideFromXml(xml, n);
      const rels = await relsOf(zip, path);

      // SmartArt text (diagram data parts)
      for (const r of rels.filter((x) => /diagramData$/.test(x.type))) {
        const dm = zip.file(resolvePath(path, r.target));
        if (dm) {
          const dxml = await dm.async("string");
          const ddoc = parseXml(dxml);
          const pts = [];
          for (const t of ddoc.getElementsByTagNameNS(A_NS, "t")) { const s = t.textContent.trim(); if (s) pts.push(s); }
          if (pts.length) slide.bullets.push(...pts.map((text) => ({ level: 1, text })));
        }
      }
      // Speaker notes
      const noteRel = rels.find((x) => /notesSlide$/.test(x.type));
      if (noteRel) {
        const nf = zip.file(resolvePath(path, noteRel.target));
        if (nf) {
          const nx = await nf.async("string");
          const paras = paragraphsOf(parseXml(nx).documentElement).map((x) => x.text).filter((t) => !/^\d+$/.test(t));
          slide.notes = paras.join("\n");
        }
      }
      // Embedded pictures (diagrams, tables as images, figures)
      let kept = 0;
      for (const r of rels.filter((x) => /\/image$/.test(x.type))) {
        if (kept >= LIMITS.maxImagesPerSlide || images.length >= LIMITS.maxTotalImages) break;
        const mf = zip.file(resolvePath(path, r.target));
        if (!mf || /\.(emf|wmf|svg)$/i.test(r.target)) continue; // browsers cannot rasterize these
        const blob = await mf.async("blob");
        if (blob.size < 6000) continue; // icons / bullets
        const dataUrl = await blobToJpegDataUrl(blob);
        if (dataUrl) { images.push({ slide: n, kind: "figure", dataUrl }); kept++; }
      }

      slide.text = [slide.title].concat(slide.bullets.map((b) => b.text))
        .concat(slide.tables.flatMap((rows) => rows.map((cells) => cells.join(" | "))))
        .concat(slide.notes ? ["Notes: " + slide.notes] : []).join("\n");
      slide.markdown = slideMarkdown(slide, "Slide");
      slides.push(slide);
      if (onProgress) onProgress(n, order.length);
    }
    return { slides, images, units: slides.length, unitType: "slides" };
  }

  /* ---------- structured output ---------- */

  function slideMarkdown(s, unit) {
    // Layout-only titles are annotated so the model never mistakes them for clinical content.
    const lines = [s.layoutTitle ? `## ${unit} ${s.number} — [layout label, not medical content: ${s.title}]` : `## ${unit} ${s.number}: ${s.title}`];
    s.bullets.forEach((b) => { lines.push(`${"  ".repeat(Math.min(b.level, 4))}- ${b.text}`); });
    s.tables.forEach((rows, i) => {
      const width = Math.max(...rows.map((r) => r.length));
      const norm = rows.map((r) => r.concat(Array(width - r.length).fill("")).map((c) => c.replace(/\|/g, "\\|")));
      lines.push("", `**Table ${i + 1}**`, `| ${norm[0].join(" | ")} |`, `| ${norm[0].map(() => "---").join(" | ")} |`);
      norm.slice(1).forEach((r) => lines.push(`| ${r.join(" | ")} |`));
      lines.push("");
    });
    if (s.notes) lines.push("", `> Notes: ${s.notes.replace(/\n/g, " ")}`);
    return lines.join("\n");
  }

  /** Full-document Markdown built from a stored lecture (used by the AI layer). */
  function toMarkdown(lecture) {
    const segs = segments(lecture);
    return `# ${lecture.title}\n\n` + segs.map((s) => s.markdown || `## ${s.title}\n${s.text}`).join("\n\n");
  }

  async function parseFile(file, onProgress) {
    const type = detectType(file);
    if (!type) throw new Error("UNSUPPORTED_TYPE");
    const buf = await file.arrayBuffer();
    const result = type === "pdf" ? await parsePdf(buf, onProgress) : await parsePptx(buf, onProgress);
    result.fileType = type;
    result.parts = result.slides.map((s) => normalize(s.text));
    result.text = normalize(result.parts.join("\n\n"));
    if (result.text.replace(/\s+/g, "").length < 40) throw new Error("EMPTY_TEXT");
    return result;
  }

  function normalize(text) {
    return (text || "")
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

  /**
   * Splits a lecture into its slides/pages. Uses the stored per-unit records
   * when available, otherwise falls back to blank-line separated blocks.
   * Returns [{ index, number, title, text, markdown, tables, notes }].
   */
  function segments(lecture) {
    let parts;
    if (Array.isArray(lecture.segments) && lecture.segments.length) {
      parts = lecture.segments;
    } else {
      parts = (lecture.text || "").split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean).map((t, i) => ({ number: i + 1, text: t }));
    }
    return parts.map((p, index) => {
      let firstLine = (p.title || p.text.split("\n")[0]).trim().replace(/^[\s•·\-–—*▪◦]+\s*/, "");
      const letters = firstLine.replace(/[^A-Za-z]/g, "");
      if (letters.length >= 6 && letters === letters.toUpperCase()) {
        firstLine = firstLine.toLowerCase().replace(/(^|\s)([a-z])/g, (m, sp, ch) => sp + ch.toUpperCase());
      }
      const title = firstLine.length <= 70 ? firstLine : firstLine.slice(0, 60).replace(/\s+\S*$/, "") + "…";
      const layoutTitle = typeof p.layoutTitle === "boolean" ? p.layoutTitle : isLayoutLabel(title);
      return { index, number: p.number, title, layoutTitle, text: p.text, markdown: p.markdown || "", tables: p.tables || [], notes: p.notes || "" };
    });
  }

  window.Parsers = { parseFile, detectType, titleFromFilename, normalize, segments, toMarkdown, isLayoutLabel, stripLayoutPrefix, LIMITS };
})();
