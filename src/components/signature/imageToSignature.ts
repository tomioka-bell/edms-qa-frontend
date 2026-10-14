// Turns a photo or scan of a signature into the kind of image the backend stores: a PNG no larger
// than the limits, cropped to the ink, with the paper made transparent.

const MAX_WIDTH = 1600;
const MAX_HEIGHT = 800;
const PADDING = 12;
// A pixel this light or lighter counts as paper; this dark or darker counts as full ink
const PAPER_LUMINANCE = 225;
const INK_LUMINANCE = 120;

export interface SignatureImage {
  blob: Blob;
  /** For showing the result before it is saved; revoke when done */
  previewUrl: string;
}

function load(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be opened as a picture.'));
    };
    image.src = url;
  });
}

/**
 * Reads a picture file and returns the signature in it as a transparent PNG.
 * With `removePaper`, light pixels become transparent and the picture is cropped to what is left;
 * without it, the picture is only resized.
 */
export async function imageToSignature(file: File, removePaper: boolean): Promise<SignatureImage> {
  const image = await load(file);
  const scale = Math.min(1, MAX_WIDTH / image.naturalWidth, MAX_HEIGHT / image.naturalHeight);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const work = document.createElement('canvas');
  work.width = width;
  work.height = height;
  const ctx = work.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('This browser cannot process pictures.');
  ctx.drawImage(image, 0, 0, width, height);

  let crop = { x: 0, y: 0, width, height };
  if (removePaper) {
    const pixels = ctx.getImageData(0, 0, width, height);
    const data = pixels.data;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        // Paper disappears, ink stays solid, and the soft edge between them fades, so strokes keep smooth edges
        const ink = Math.min(1, Math.max(0, (PAPER_LUMINANCE - luminance) / (PAPER_LUMINANCE - INK_LUMINANCE)));
        const alpha = Math.round(data[i + 3] * ink);
        data[i + 3] = alpha;
        if (alpha > 24) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) throw new Error('No signature was found in that picture. Try a clearer photo with dark ink on white paper.');
    ctx.putImageData(pixels, 0, 0);
    const x = Math.max(0, minX - PADDING);
    const y = Math.max(0, minY - PADDING);
    crop = { x, y, width: Math.min(width, maxX + PADDING + 1) - x, height: Math.min(height, maxY + PADDING + 1) - y };
  }

  const out = document.createElement('canvas');
  out.width = crop.width;
  out.height = crop.height;
  out.getContext('2d')?.drawImage(work, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('The picture could not be prepared.');
  return { blob, previewUrl: URL.createObjectURL(blob) };
}
