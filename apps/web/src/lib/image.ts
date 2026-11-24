// Client-side image prep: dimensions + a small WebP thumbnail. The gallery loads only thumbs
// (typically 20-60 KB vs multi-MB originals); the full image loads in the lightbox.

const THUMB_MAX = 640;

export interface PreparedImage {
  width: number;
  height: number;
  thumb: Blob;
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, THUMB_MAX / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));

  let thumb: Blob;
  if (typeof OffscreenCanvas !== "undefined") {
    const c = new OffscreenCanvas(w, h);
    c.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    thumb = await c.convertToBlob({ type: "image/webp", quality: 0.8 });
  } else {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    thumb = await new Promise<Blob>((res, rej) =>
      c.toBlob((b) => (b ? res(b) : rej(new Error("thumbnail failed"))), "image/webp", 0.8),
    );
  }
  const out = { width: bmp.width, height: bmp.height, thumb };
  bmp.close();
  return out;
}
