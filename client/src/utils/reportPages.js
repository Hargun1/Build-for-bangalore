import { resizeImage } from "./image";

export const MAX_PAGES = 4;

/**
 * Turns the chosen files (photos and/or PDFs) into JPEG data URIs, one per page.
 * Lab reports are small print, so pages are kept sharper than meal photos (2000 px).
 * PDFs are rendered in the browser with pdf.js, loaded only when a PDF is picked.
 */
export async function filesToPages(files) {
  const pages = [];
  for (const file of files) {
    if (pages.length >= MAX_PAGES) break;
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      pages.push(...(await pdfToImages(file, MAX_PAGES - pages.length)));
    } else {
      pages.push(await resizeImage(file, 2000, 0.85));
    }
  }
  if (!pages.length) throw new Error("Please choose a photo or PDF of the report.");
  return pages;
}

async function pdfToImages(file, limit) {
  if (file.size > 25 * 1024 * 1024) throw new Error("That PDF is over 25 MB. Please choose a smaller one.");
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  } catch (err) {
    throw new Error(err?.name === "PasswordException" ? "This PDF is password-protected. Please open it and save an unlocked copy, or upload photos." : "Couldn't open this PDF.");
  }
  const out = [];
  for (let n = 1; n <= Math.min(doc.numPages, limit); n++) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(2.5, 2000 / Math.max(base.width, base.height)) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    out.push(canvas.toDataURL("image/jpeg", 0.85));
    page.cleanup();
  }
  await doc.destroy();
  return out;
}
