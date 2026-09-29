#!/usr/bin/env bash
# Sao lưu TD Bakugan: CSDL + ảnh / video.
# Chạy tay:  ./backup.sh        Chạy mỗi đêm: xem mục "Sao lưu" trong HUONG-DAN.md
#
# - CSDL: mysqldump --single-transaction (web vẫn chạy bình thường khi sao lưu), nén gzip.
# - Ảnh / video: bản chụp theo ngày bằng hard link — file không đổi thì không tốn thêm chỗ.
# - Giữ 14 bản theo ngày + 8 bản theo tuần (Chủ nhật).
# - Chép thêm ra ổ ngoài (BACKUP_EXTERNAL_DIR) và nơi ngoài nhà qua rclone (RCLONE_REMOTE).
set -euo pipefail
export LC_ALL=C
cd "$(dirname "$(readlink -f "$0")")"

# Chỉ đọc vài biến cần dùng từ .env, không in giá trị ra màn hình.
read_env() { grep -E "^$1=" .env 2>/dev/null | tail -n 1 | cut -d= -f2- || true; }
DATA_DIR="$(read_env DATA_DIR)"
DATA_DIR="${DATA_DIR:-/srv/tdbakugan}"
BACKUP_EXTERNAL_DIR="$(read_env BACKUP_EXTERNAL_DIR)"
RCLONE_REMOTE="$(read_env RCLONE_REMOTE)"
BACKUP_DIR="$DATA_DIR/backups"
KEEP_DAILY=14
KEEP_WEEKLY=8

log() { printf '%s %s\n' "$(date '+%F %T')" "$*"; }
for tool in docker gzip rsync; do
  if ! command -v "$tool" > /dev/null; then
    log "LỖI: máy chưa có lệnh $tool (cài: sudo apt install -y $tool)"
    exit 1
  fi
done
stamp="$(date +%Y-%m-%d_%H%M)"
mkdir -p "$BACKUP_DIR/db/daily" "$BACKUP_DIR/db/weekly" "$BACKUP_DIR/uploads"

# 1. CSDL
db_file="$BACKUP_DIR/db/daily/tdbakugan_$stamp.sql.gz"
log "Sao lưu CSDL → $db_file"
docker compose exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --quick --routines --triggers --events --no-tablespaces --set-gtid-purged=OFF "$MYSQL_DATABASE"' \
  | gzip -9 > "$db_file.part"
if ! gzip -dc "$db_file.part" | tail -n 1 | grep -q 'Dump completed'; then
  rm -f "$db_file.part"
  log "LỖI: bản sao lưu CSDL không trọn vẹn — dừng lại."
  exit 1
fi
mv "$db_file.part" "$db_file"
if [ "$(date +%u)" = "7" ]; then
  cp "$db_file" "$BACKUP_DIR/db/weekly/"
fi

# 2. Ảnh / video
latest_uploads=""
if [ -d "$DATA_DIR/uploads" ]; then
  previous="$(ls -1d "$BACKUP_DIR"/uploads/20* 2>/dev/null | sort | tail -n 1 || true)"
  latest_uploads="$BACKUP_DIR/uploads/$stamp"
  log "Sao lưu ảnh / video → $latest_uploads"
  if [ -n "$previous" ]; then
    rsync -a --link-dest="$previous" "$DATA_DIR/uploads/" "$latest_uploads/"
  else
    rsync -a "$DATA_DIR/uploads/" "$latest_uploads/"
  fi
fi

# 3. Xoá bản cũ quá số lượng giữ lại (tên theo ngày giờ nên xếp chữ cũng là xếp theo thời gian)
prune() {
  local keep="$1"
  shift
  local entries=("$@")
  local extra=$((${#entries[@]} - keep))
  if [ "$extra" -gt 0 ]; then
    rm -rf -- "${entries[@]:0:extra}"
  fi
}
shopt -s nullglob
prune "$KEEP_DAILY" "$BACKUP_DIR"/db/daily/tdbakugan_*.sql.gz
prune "$KEEP_WEEKLY" "$BACKUP_DIR"/db/weekly/tdbakugan_*.sql.gz
prune "$KEEP_DAILY" "$BACKUP_DIR"/uploads/20*
shopt -u nullglob

# 4. Ổ cứng ngoài / USB
if [ -n "$BACKUP_EXTERNAL_DIR" ]; then
  if [ -d "$BACKUP_EXTERNAL_DIR" ] && [ -w "$BACKUP_EXTERNAL_DIR" ]; then
    log "Chép ra ổ ngoài → $BACKUP_EXTERNAL_DIR/tdbakugan-backups"
    rsync -aH --delete "$BACKUP_DIR/" "$BACKUP_EXTERNAL_DIR/tdbakugan-backups/"
  else
    log "CẢNH BÁO: không ghi được vào $BACKUP_EXTERNAL_DIR (ổ ngoài chưa gắn?)"
  fi
fi

# 5. Nơi ngoài nhà (Google Drive… qua rclone): CSDL + bản ảnh mới nhất
if [ -n "$RCLONE_REMOTE" ]; then
  if command -v rclone > /dev/null; then
    log "Đồng bộ lên $RCLONE_REMOTE"
    rclone sync "$BACKUP_DIR/db" "$RCLONE_REMOTE/db"
    if [ -n "$latest_uploads" ]; then
      rclone sync "$latest_uploads" "$RCLONE_REMOTE/uploads"
    fi
  else
    log "CẢNH BÁO: đã đặt RCLONE_REMOTE nhưng máy chưa cài rclone"
  fi
fi

log "Sao lưu xong."
