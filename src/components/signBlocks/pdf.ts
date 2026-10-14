// The one place pdf.js is set up. It draws PDF pages onto a canvas, which is what lets signature
// blocks be laid over a page at exact positions.
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfDocument = pdfjs.PDFDocumentProxy;

/** Where a PDF comes from: a file already on the server, or one just chosen and not uploaded yet. */
export type PdfSource = { url: string } | { file: File };

/** Opens a PDF. The caller must `destroy()` the result when done with it. */
export async function openPdf(source: PdfSource): Promise<PdfDocument> {
  if ('file' in source) {
    return pdfjs.getDocument({ data: await source.file.arrayBuffer() }).promise;
  }
  // The download route needs the session cookie
  return pdfjs.getDocument({ url: source.url, withCredentials: true }).promise;
}
