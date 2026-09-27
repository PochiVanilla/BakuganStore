/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_USE_MOCK?: string;
  readonly VITE_WS_URL?: string;
  /** "1" = giả lập độ trễ mạng cho dữ liệu mock (chỉ để xem trạng thái đang tải) */
  readonly VITE_MOCK_LATENCY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
