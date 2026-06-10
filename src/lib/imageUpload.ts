// Đọc 1 file ảnh, thu nhỏ về cạnh tối đa `maxSize`px và nén JPEG để giảm dung lượng,
// trả về data URL base64 dùng làm ảnh đại diện sản phẩm (lưu thẳng vào DB như KYC).
export async function fileToCompressedDataUrl(
  file: File,
  maxSize = 900,
  quality = 0.82,
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Vui lòng chọn file ảnh (JPG, PNG, WebP...).");
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Không đọc được file ảnh."));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("File ảnh không hợp lệ."));
    el.src = dataUrl;
  });

  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");
  ctx.drawImage(img, 0, 0, w, h);
  // PNG có thể có nền trong suốt; nén JPEG cho nhẹ, giữ PNG nếu là ảnh nhỏ trong suốt.
  return canvas.toDataURL("image/jpeg", quality);
}
