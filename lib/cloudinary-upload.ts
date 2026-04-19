export function isRemoteImageUrl(uri: string): boolean {
  return /^https?:\/\//i.test(String(uri).trim());
}

type CloudinaryUploadResponse = {
  secure_url?: string;
};

export function isCloudinaryConfigured(): boolean {
  const cloudName = String(process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "").trim();
  const uploadPreset = String(process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "").trim();
  return Boolean(cloudName && uploadPreset);
}

function getCloudinaryConfig(): { cloudName: string; uploadPreset: string } {
  const cloudName = String(process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "").trim();
  const uploadPreset = String(process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "").trim();
  if (!cloudName || !uploadPreset) {
    throw new Error(
      "Cloudinary غير مُضبط. أضف EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME و EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET في .env",
    );
  }
  return { cloudName, uploadPreset };
}

/** إن لم يُضبط Cloudinary يُرجع `null` دون خطأ — للملفات المحلية يُفضّل إبقاء الصورة السابقة أو تجاهل الرفع. */
export async function uploadImageIfConfigured(uri: string): Promise<string | null> {
  const rawUri = String(uri ?? "").trim();
  if (!rawUri) return null;
  if (isRemoteImageUrl(rawUri)) return rawUri;
  if (!isCloudinaryConfigured()) return null;
  return uploadImageAsync(rawUri);
}

/**
 * يرفع صورة إلى Cloudinary ويُرجع secure_url فقط.
 */
export async function uploadImageAsync(uri: string): Promise<string> {
  const rawUri = String(uri ?? "").trim();
  if (!rawUri) throw new Error("مسار الصورة غير صالح");
  if (isRemoteImageUrl(rawUri)) return rawUri;
  if (!isCloudinaryConfigured()) {
    throw new Error(
      "Cloudinary غير مُضبط. أضف EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME و EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET في .env",
    );
  }

  const { cloudName, uploadPreset } = getCloudinaryConfig();
  const form = new FormData();
  form.append("file", {
    uri: rawUri,
    type: "image/jpeg",
    name: `profile-${Date.now()}.jpg`,
  } as any);
  form.append("upload_preset", uploadPreset);
  form.append("folder", "users/profile");

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const err = (await res.json()) as { error?: { message?: string } };
      if (err?.error?.message) message = err.error.message;
    } catch {
      // ignore parse failure
    }
    throw new Error(`فشل رفع الصورة: ${message}`);
  }

  const data = (await res.json()) as CloudinaryUploadResponse;
  const secureUrl = String(data?.secure_url ?? "").trim();
  if (!secureUrl) {
    throw new Error("لم يتم استلام رابط الصورة من Cloudinary");
  }
  return secureUrl;
}
