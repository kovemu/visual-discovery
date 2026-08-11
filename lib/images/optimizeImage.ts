export async function optimizeImage(file: File): Promise<File> {
  const MAX_SIZE = 1920;
  const QUALITY = 0.82;

  const image = await createImageBitmap(file);

  let width = image.width;
  let height = image.height;

  if (width > MAX_SIZE || height > MAX_SIZE) {
    const ratio = Math.min(
      MAX_SIZE / width,
      MAX_SIZE / height,
    );

    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    image.close();
    throw new Error("Could not process image.");
  }

  context.drawImage(image, 0, 0, width, height);

  image.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error("Image conversion failed."));
        }
      },
      "image/webp",
      QUALITY,
    );
  });

  const originalName = file.name.replace(/\.[^/.]+$/, "");

  return new File(
    [blob],
    `${originalName}.webp`,
    {
      type: "image/webp",
    },
  );
}