import { useState } from 'react';
import {
  uploadImage,
  uploadVideo,
  validateImageFile,
  validateVideoFile,
} from '@/services/api/imageStore';
import { getApiErrorMessage } from '@/services/api/client';
import { toast } from '@/store/uiStore';

export type MediaKind = 'image' | 'video';

/** Tải file lên kho ảnh / video; đếm số file đang xử lý để khoá nút Lưu trong lúc chờ. */
export function useUploader() {
  const [busy, setBusy] = useState(0);
  const upload = async (files: readonly File[], kind: MediaKind = 'image'): Promise<string[]> => {
    const refs: string[] = [];
    for (const file of files) {
      const problem = kind === 'video' ? validateVideoFile(file) : validateImageFile(file);
      if (problem) {
        toast.error(`Bỏ qua ${file.name}`, problem);
        continue;
      }
      setBusy((value) => value + 1);
      try {
        refs.push(await (kind === 'video' ? uploadVideo(file) : uploadImage(file)));
      } catch (error) {
        toast.error(`Không tải được ${file.name}`, getApiErrorMessage(error));
      } finally {
        setBusy((value) => value - 1);
      }
    }
    return refs;
  };
  return { upload, isUploading: busy > 0 };
}

export type Uploader = ReturnType<typeof useUploader>['upload'];
