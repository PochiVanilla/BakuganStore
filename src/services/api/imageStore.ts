import type { ApiResponse } from '@/types';
import { apiClient, USE_MOCK } from './client';

/* ============================================================
   Ảnh và video admin tải lên (ảnh chụp lô hàng, 3 ảnh + 1 video
   giới thiệu của từng con).

   - Có backend: gửi file lên /admin/uploads, nhận về URL.
   - Chế độ mock: ảnh được thu nhỏ, video giữ nguyên, rồi cất trong
     IndexedDB của trình duyệt (localStorage quá nhỏ cho ảnh chụp điện
     thoại). Dữ liệu chỉ lưu mã "idb:<id>"; khi hiển thị thì đổi mã đó
     thành blob URL.
   ============================================================ */

const DB_NAME = 'td-bakugan-images';
const STORE = 'images';
export const IDB_PREFIX = 'idb:';

/** Cạnh dài tối đa sau khi thu nhỏ — đủ nét để khách phóng to xem từng con. */
const MAX_EDGE = 1600;
const QUALITY = 0.82;
/** Ảnh gốc lớn hơn mức này thì từ chối ngay (tránh treo trình duyệt). */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
/** Video giới thiệu: trình duyệt không nén lại được nên giới hạn dung lượng và độ dài. */
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 180;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Không mở được kho ảnh.'));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Lỗi kho ảnh.'));
    });
  } finally {
    db.close();
  }
}

/** Thu nhỏ ảnh chụp điện thoại (thường 4000px, vài MB) xuống cỡ vừa đủ cho web. */
async function downscale(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Trình duyệt không xử lý được ảnh này.');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', QUALITY),
  );
  if (blob && blob.type === 'image/webp') return blob;
  // Safari cũ không xuất được WebP -> dùng JPEG.
  const jpeg = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALITY),
  );
  if (!jpeg) throw new Error('Không nén được ảnh này.');
  return jpeg;
}

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'File này không phải ảnh.';
  if (file.size > MAX_UPLOAD_BYTES) return 'Ảnh quá lớn (tối đa 15 MB).';
  return null;
}

export function validateVideoFile(file: File): string | null {
  if (!file.type.startsWith('video/')) return 'File này không phải video.';
  if (file.size > MAX_VIDEO_BYTES) {
    return 'Video quá lớn (tối đa 100 MB) — cắt ngắn hoặc quay độ phân giải thấp hơn rồi tải lại.';
  }
  return null;
}

async function sendToServer(file: File, kind: 'image' | 'video'): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('kind', kind);
  const { data } = await apiClient.post<ApiResponse<{ url: string }>>('/admin/uploads', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data.url;
}

async function storeBlob(blob: Blob): Promise<string> {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  await withStore('readwrite', (store) => store.put(blob, id));
  return `${IDB_PREFIX}${id}`;
}

/** Tải ảnh lên, trả về mã tham chiếu để lưu cùng feed / con Bakugan. */
export async function uploadImage(file: File): Promise<string> {
  const problem = validateImageFile(file);
  if (problem) throw new Error(problem);
  if (!USE_MOCK) return sendToServer(file, 'image');
  return storeBlob(await downscale(file));
}

/**
 * Đọc thời lượng để chắc trình duyệt mở được video này. Định dạng lạ thì báo lỗi ngay,
 * đỡ việc khách bấm vào mới thấy video không chạy. Không đọc được thời lượng thì trả NaN.
 */
function probeVideo(file: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const finish = (): void => {
      window.clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    };
    const timer = window.setTimeout(() => {
      finish();
      resolve(Number.NaN);
    }, 10_000);
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => {
      const { duration } = video;
      finish();
      resolve(duration);
    };
    video.onerror = () => {
      finish();
      reject(
        new Error(
          'Trình duyệt không mở được video này — hãy xuất lại dạng MP4 (H.264) rồi tải lên.',
        ),
      );
    };
    video.src = url;
  });
}

/** Tải video giới thiệu lên (giữ nguyên file), trả về mã tham chiếu. */
export async function uploadVideo(file: File): Promise<string> {
  const problem = validateVideoFile(file);
  if (problem) throw new Error(problem);
  const duration = await probeVideo(file);
  if (Number.isFinite(duration) && duration > MAX_VIDEO_SECONDS) {
    throw new Error('Video dài quá 3 phút — cắt ngắn lại cho khách xem nhanh nhé.');
  }
  if (!USE_MOCK) return sendToServer(file, 'video');
  return storeBlob(file);
}

const urlCache = new Map<string, string>();

/** Đổi mã "idb:" (ảnh hoặc video) thành URL hiển thị được; mã khác (URL, đường dẫn) giữ nguyên. */
export async function resolveImageRef(ref: string): Promise<string | null> {
  if (!ref.startsWith(IDB_PREFIX)) return ref;
  const cached = urlCache.get(ref);
  if (cached) return cached;
  try {
    const blob = await withStore<Blob | undefined>('readonly', (store) =>
      store.get(ref.slice(IDB_PREFIX.length)),
    );
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    urlCache.set(ref, url);
    return url;
  } catch {
    return null;
  }
}

/** Xoá ảnh / video không còn dùng (feed bị xoá, ảnh bị thay). Lỗi thì bỏ qua. */
export async function deleteImageRefs(refs: readonly string[]): Promise<void> {
  const ids = refs.filter((ref) => ref.startsWith(IDB_PREFIX));
  await Promise.all(
    ids.map(async (ref) => {
      try {
        await withStore('readwrite', (store) => store.delete(ref.slice(IDB_PREFIX.length)));
        const url = urlCache.get(ref);
        if (url) URL.revokeObjectURL(url);
        urlCache.delete(ref);
      } catch {
        // bỏ qua
      }
    }),
  );
}
