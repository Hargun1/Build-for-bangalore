/**
 * Shrinks a photo in the browser before upload: longest side 1280 px, JPEG quality 0.82.
 * A 6 MB phone photo becomes ~200-400 KB, which is faster to send and well within
 * what vision models need to recognise food or read a receipt.
 * Returns a data URI ("data:image/jpeg;base64,...").
 */
export async function resizeImage(file, maxSide = 1280, quality = 0.82) {
  if (!file || !file.type?.startsWith("image/")) {
    throw new Error("Please choose an image file (JPG, PNG or WebP).");
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new Error("That image is over 25 MB. Please choose a smaller one.");
  }
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; // transparent PNGs get a white background, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if (bitmap.close) bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

async function loadBitmap(file) {
  if ("createImageBitmap" in window) {
    try {
      // imageOrientation honours EXIF rotation from phone cameras.
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
