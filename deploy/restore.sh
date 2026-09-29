#!/usr/bin/env bash
# Khôi phục từ bản sao lưu do backup.sh tạo.
#
#   ./restore.sh --kiem-tra <file .sql.gz>
#       Thử khôi phục vào một CSDL tạm rồi xoá đi. KHÔNG đụng dữ liệu đang chạy.
#       Nên làm mỗi tháng một lần để chắc bản sao lưu dùng được.
#
#   ./restore.sh <file .sql.gz> [thư mục ảnh đã sao lưu]
#       GHI ĐÈ dữ liệu đang chạy bằng bản sao lưu (hỏi xác nhận trước).
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"

read_env() { grep -E "^$1=" .env 2>/dev/null | tail -n 1 | cut -d= -f2- || true; }
DATA_DIR="$(read_env DATA_DIR)"
DATA_DIR="${DATA_DIR:-/srv/tdbakugan}"

mysql_exec() { docker compose exec -T mysql sh -c "MYSQL_PWD=\"\$MYSQL_ROOT_PASSWORD\" exec mysql -uroot $1"; }

if [ "${1:-}" = "--kiem-tra" ]; then
  db_file="${2:?Cách dùng: ./restore.sh --kiem-tra <file .sql.gz>}"
  [ -f "$db_file" ] || { echo "Không thấy file $db_file"; exit 1; }
  echo "Thử khôi phục $db_file vào CSDL tạm tdbakugan_restore_test…"
  echo "DROP DATABASE IF EXISTS tdbakugan_restore_test; CREATE DATABASE tdbakugan_restore_test;" | mysql_exec ""
  gzip -dc "$db_file" | mysql_exec "tdbakugan_restore_test"
  echo "SELECT
      (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'tdbakugan_restore_test') AS so_bang,
      (SELECT COUNT(*) FROM tdbakugan_restore_test.users) AS tai_khoan,
      (SELECT COUNT(*) FROM tdbakugan_restore_test.orders) AS don_hang,
      (SELECT COUNT(*) FROM tdbakugan_restore_test.items) AS bakugan;" | mysql_exec "--table"
  echo "DROP DATABASE tdbakugan_restore_test;" | mysql_exec ""
  echo "Bản sao lưu đọc được. Đã xoá CSDL tạm."
  exit 0
fi

db_file="${1:?Cách dùng: ./restore.sh <file .sql.gz> [thư mục ảnh]  (hoặc --kiem-tra <file>)}"
uploads_snapshot="${2:-}"
[ -f "$db_file" ] || { echo "Không thấy file $db_file"; exit 1; }
if [ -n "$uploads_snapshot" ] && [ ! -d "$uploads_snapshot" ]; then
  echo "Không thấy thư mục ảnh $uploads_snapshot"
  exit 1
fi

echo "Sẽ GHI ĐÈ dữ liệu đang chạy bằng bản sao lưu:"
echo "  CSDL: $db_file"
if [ -n "$uploads_snapshot" ]; then echo "  Ảnh:  $uploads_snapshot → $DATA_DIR/uploads"; fi
read -r -p 'Gõ KHOI PHUC (chữ in hoa) để tiếp tục: ' answer
[ "$answer" = "KHOI PHUC" ] || { echo "Đã huỷ, không đổi gì."; exit 1; }

docker compose stop api
gzip -dc "$db_file" | mysql_exec "\"\$MYSQL_DATABASE\""
if [ -n "$uploads_snapshot" ]; then
  rsync -a --delete "$uploads_snapshot/" "$DATA_DIR/uploads/"
fi
docker compose start api
echo "Đã khôi phục. Mở https://<tên miền>/api/health để kiểm tra."
