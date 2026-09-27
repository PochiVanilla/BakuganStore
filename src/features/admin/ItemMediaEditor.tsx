import { useRef, useState, type ChangeEvent } from 'react';
import { Camera, Film, LoaderCircle, Play, Star, X } from 'lucide-react';
import { ITEM_PHOTO_LIMIT } from '@/types';
import { useMediaSrc } from '@/hooks/useMediaSrc';
import { toast } from '@/store/uiStore';
import { RefImage } from '@/components/ui';
import type { Uploader } from './useUploader';

/** Bộ ảnh của một con: tối đa 3 ảnh (ảnh đầu là ảnh chính) + 1 video giới thiệu. */
export interface ItemMedia {
  photos: string[];
  video?: string;
}

const tileClass = 'relative h-12 w-12 shrink-0';
const addTileClass =
  'flex h-12 w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-white/20 text-text-muted transition hover:border-accent-cyan hover:text-accent-cyan';
const removeClass = 'absolute -top-1.5 -right-1.5 rounded-full bg-danger p-0.5 text-white';

function VideoTile({
  video,
  label,
  onRemove,
}: {
  video: string;
  label: string;
  onRemove: () => void;
}) {
  const url = useMediaSrc(video);
  return (
    <span className={tileClass}>
      {url ? (
        <video
          src={url}
          muted
          playsInline
          preload="metadata"
          aria-label={`Video giới thiệu ${label}`}
          className="h-12 w-12 rounded-lg bg-black object-cover"
        />
      ) : (
        <span className="block h-12 w-12 rounded-lg bg-surface-2" />
      )}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-white">
        <Play size={16} className="fill-current drop-shadow" aria-hidden="true" />
      </span>
      <button
        type="button"
        onClick={onRemove}
        className={removeClass}
        aria-label={`Bỏ video của ${label}`}
      >
        <X size={11} />
      </button>
    </span>
  );
}

/**
 * Ô tải 3 ảnh + 1 video cho một con Bakugan (dùng ở trang đăng feed và hộp sửa từng con).
 * `onChange` nhận hàm cập nhật vì file tải xong sau vài giây, lúc đó form có thể đã đổi.
 */
export function ItemMediaEditor({
  media,
  onChange,
  upload,
  label,
}: {
  media: ItemMedia;
  onChange: (update: (current: ItemMedia) => ItemMedia) => void;
  upload: Uploader;
  /** Tên con Bakugan, cho trình đọc màn hình */
  label: string;
}) {
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const [pendingPhotos, setPendingPhotos] = useState(0);
  const [videoPending, setVideoPending] = useState(false);
  const room = ITEM_PHOTO_LIMIT - media.photos.length - pendingPhotos;

  const onPhotos = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;
    if (files.length > room) {
      toast.info(`Mỗi con tối đa ${ITEM_PHOTO_LIMIT} ảnh`, `Chỉ lấy ${Math.max(0, room)} ảnh đầu.`);
    }
    const picked = files.slice(0, Math.max(0, room));
    if (picked.length === 0) return;
    setPendingPhotos((value) => value + picked.length);
    try {
      const refs = await upload(picked, 'image');
      if (refs.length > 0) {
        onChange((current) => ({
          ...current,
          photos: [...current.photos, ...refs].slice(0, ITEM_PHOTO_LIMIT),
        }));
      }
    } finally {
      setPendingPhotos((value) => value - picked.length);
    }
  };

  const onVideo = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setVideoPending(true);
    try {
      const [ref] = await upload([file], 'video');
      if (ref) onChange((current) => ({ ...current, video: ref }));
    } finally {
      setVideoPending(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => void onPhotos(event)}
      />
      <input
        ref={videoInput}
        type="file"
        accept="video/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => void onVideo(event)}
      />

      {media.photos.map((photo, index) => (
        <span key={photo} className={tileClass}>
          <RefImage
            src={photo}
            alt={`${label} — ảnh ${index + 1}`}
            width={48}
            height={48}
            className="h-12 w-12 rounded-lg object-cover"
          />
          {index === 0 ? (
            <span className="absolute inset-x-0 bottom-0 rounded-b-lg bg-gold/90 text-center text-[8px] leading-3 font-bold text-background">
              CHÍNH
            </span>
          ) : (
            <button
              type="button"
              onClick={() =>
                onChange((current) => ({
                  ...current,
                  photos: [photo, ...current.photos.filter((ref) => ref !== photo)],
                }))
              }
              title="Đặt làm ảnh chính"
              aria-label={`Đặt ảnh ${index + 1} làm ảnh chính của ${label}`}
              className="absolute bottom-0.5 left-0.5 rounded bg-background/85 p-0.5 text-text transition hover:text-gold"
            >
              <Star size={10} />
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              onChange((current) => ({
                ...current,
                photos: current.photos.filter((ref) => ref !== photo),
              }))
            }
            className={removeClass}
            aria-label={`Bỏ ảnh ${index + 1} của ${label}`}
          >
            <X size={11} />
          </button>
        </span>
      ))}
      {Array.from({ length: pendingPhotos }, (_, index) => (
        <span
          key={`pending-${index}`}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-white/15 text-text-muted"
          role="status"
          aria-label="Đang xử lý ảnh"
        >
          <LoaderCircle size={16} className="animate-spin" />
        </span>
      ))}
      {room > 0 && (
        <button
          type="button"
          onClick={() => photoInput.current?.click()}
          className={addTileClass}
          aria-label={`Thêm ảnh cho ${label}`}
          title={`Thêm ảnh (tối đa ${ITEM_PHOTO_LIMIT})`}
        >
          <Camera size={15} aria-hidden="true" />
          <span className="text-[9px] font-semibold tabular-nums">
            {media.photos.length + pendingPhotos}/{ITEM_PHOTO_LIMIT}
          </span>
        </button>
      )}

      <span className="mx-0.5 h-8 w-px bg-white/10" aria-hidden="true" />

      {videoPending ? (
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-white/15 text-text-muted"
          role="status"
          aria-label="Đang xử lý video"
        >
          <LoaderCircle size={16} className="animate-spin" />
        </span>
      ) : media.video ? (
        <VideoTile
          video={media.video}
          label={label}
          onRemove={() => onChange((current) => ({ ...current, video: undefined }))}
        />
      ) : (
        <button
          type="button"
          onClick={() => videoInput.current?.click()}
          className={addTileClass}
          aria-label={`Thêm video giới thiệu cho ${label}`}
          title="Video giới thiệu (tối đa 3 phút, 100 MB)"
        >
          <Film size={15} aria-hidden="true" />
          <span className="text-[9px] font-semibold">Video</span>
        </button>
      )}
    </div>
  );
}
