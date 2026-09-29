# Cài TD Bakugan trên mini PC

Hướng dẫn này đưa web TD Bakugan lên mini PC của shop, gồm 3 phần chạy bằng Docker:

- **Caddy**: nhận HTTPS, trả trang web và ảnh.
- **Backend** (Express).
- **MySQL** (dữ liệu).

Làm lần lượt từ trên xuống. Lệnh nào cũng gõ trên mini PC (trực tiếp hoặc qua SSH trong mạng nhà).

> **Giai đoạn hiện tại (1)**: web vẫn chạy **dữ liệu giả lập** như bản trên Vercel. Backend đã có
> CSDL MySQL và trợ lý AI Gemini. Các giai đoạn sau lần lượt nối đăng nhập, feed, đơn hàng…
> Mỗi lần có bản mới chỉ cần làm mục 8 (Cập nhật).

## 1. Chuẩn bị

| Việc | Ghi chú |
| --- | --- |
| Mini PC | Tối thiểu 4 GB RAM, ổ SSD 128 GB trở lên. Cắm dây mạng LAN (ổn định hơn Wi-Fi) |
| Bộ lưu điện (UPS) | Cúp điện đột ngột dễ hỏng dữ liệu. Vào BIOS bật "Restore on AC power loss" để có điện lại là máy tự bật |
| Ổ cứng ngoài / USB | Để chép bản sao lưu mỗi đêm |
| Tên miền | VD `tdbakugan.vn`. Cần cho HTTPS. Chưa có vẫn thử được trong mạng nhà (mục 7) |
| IP công khai | Gọi nhà mạng hỏi: gói cước có **IP công khai** không (nhiều gói dùng CGNAT, mở cổng không tác dụng) và có chặn cổng 80, 443 không. Không được thì xin IP công khai / IP tĩnh |

## 2. Cài Ubuntu Server 24.04 LTS

1. Tải **Ubuntu Server 24.04 LTS** tại ubuntu.com, ghi ra USB bằng balenaEtcher hoặc Rufus.
2. Cài lên mini PC. Lúc cài:
   - Tạo một tài khoản quản trị (VD `tdadmin`) với mật khẩu mạnh.
   - Tích **Install OpenSSH server** để điều khiển từ máy khác trong mạng nhà.
3. Cài xong, đăng nhập rồi cập nhật:

```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y git rsync unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades   # chọn Yes: tự cài bản vá bảo mật
```

## 3. Cài Docker và bật tường lửa

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER      # dùng docker không cần sudo
# Đăng xuất rồi đăng nhập lại cho quyền có hiệu lực, sau đó kiểm tra:
docker compose version

# Tường lửa: chỉ mở SSH (trong mạng nhà), web (80) và HTTPS (443).
sudo ufw allow from 192.168.0.0/16 to any port 22 proto tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable
```

> **Lưu ý**: Docker tự mở cổng của container và đi vòng qua ufw. File `docker-compose.yml` chỉ mở
> cổng 80 và 443; MySQL và backend **không** mở cổng nào ra ngoài.

Nên bật thêm `fail2ban` để chặn dò mật khẩu SSH: `sudo apt install -y fail2ban`.

## 4. Mạng: IP nội bộ cố định, mở cổng, tên miền

1. **IP nội bộ cố định**: vào trang quản lý router (thường là `192.168.1.1`), mục DHCP → "đặt trước địa chỉ"
   (DHCP reservation), gán cho mini PC một IP cố định, VD `192.168.1.50`.
2. **Mở cổng** (Port Forwarding / NAT / Virtual Server) trên router, chỉ 2 cổng:
   - `80` → `192.168.1.50:80`
   - `443` → `192.168.1.50:443`

   **Không** mở cổng nào khác (đặc biệt không mở 22 SSH hay 3306 MySQL ra internet).
3. **Tên miền**: tạo bản ghi **A** trỏ `tdbakugan.vn` (và `www` nếu muốn) về IP công khai của nhà.
   Xem IP công khai bằng lệnh `curl -4 ifconfig.me`.
4. **IP công khai hay đổi?** Bật **DDNS** để tên miền tự trỏ theo IP mới: nhiều router có sẵn mục
   DDNS; hoặc dùng dịch vụ DNS có API (VD Cloudflare DNS, chỉ dùng phần DNS) kèm chương trình nhỏ cập nhật IP.

## 5. Lấy code và cấu hình

```bash
sudo mkdir -p /srv/tdbakugan
sudo chown $USER:$USER /srv/tdbakugan
git clone https://github.com/pochivanilla/bakuganstore.git /srv/tdbakugan/app
cd /srv/tdbakugan/app/deploy

# Thư mục dữ liệu: CSDL, ảnh / video, bản sao lưu. Backend chạy bằng tài khoản uid 1000.
mkdir -p /srv/tdbakugan/mysql /srv/tdbakugan/uploads /srv/tdbakugan/backups
sudo chown 1000:1000 /srv/tdbakugan/uploads

cp .env.example .env
chmod 600 .env        # chỉ tài khoản quản trị đọc được
nano .env
```

Điền trong `.env`:

| Biến | Điền gì |
| --- | --- |
| `SITE_ADDRESS` | Tên miền, VD `tdbakugan.vn`. Thử trong mạng nhà khi chưa có tên miền: `:80` |
| `PUBLIC_ORIGIN` | Địa chỉ khách gõ, VD `https://tdbakugan.vn` (thử trong nhà: `http://192.168.1.50`) |
| `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD` | Hai mật khẩu khác nhau, tạo bằng `openssl rand -base64 32` |
| `GEMINI_API_KEY` | Khoá lấy tại https://aistudio.google.com/apikey (để trống thì bot dùng bộ từ khoá) |
| `BACKUP_EXTERNAL_DIR` | Đường dẫn ổ ngoài đã gắn, VD `/mnt/usb-backup` (xem mục 9) |

> **Giữ bí mật file `.env`**: không gửi qua chat, không chép lên git. Nên cất thêm một bản
> (VD trong trình quản lý mật khẩu), vì mất file này là mất mật khẩu CSDL.

## 6. Chạy lần đầu và kiểm tra

```bash
cd /srv/tdbakugan/app/deploy
docker compose up -d --build     # lần đầu mất 5–10 phút để build
docker compose ps                # cả 3 dịch vụ phải "running", mysql và api "healthy"
```

Kiểm tra:

1. Mở `https://tdbakugan.vn/api/health`. Phải thấy `{"data":{"status":"ok","database":"ok",…}}`.
2. Mở `https://tdbakugan.vn`: web hiện như bản Vercel. Ổ khoá HTTPS do Caddy tự xin, lần đầu có thể mất 1 phút.
3. Đăng nhập tài khoản admin **demo** của bản giả lập → Cài đặt → Trợ lý AI → **Kiểm tra kết nối**:
   phải báo Gemini trả lời được.

Xem log khi có lỗi:

```bash
docker compose logs -f api       # backend
docker compose logs -f web       # Caddy (HTTPS, chứng chỉ)
docker compose logs -f mysql
```

## 7. Thử trong mạng nhà khi chưa có tên miền

Đặt trong `.env`:

```
SITE_ADDRESS=:80
PUBLIC_ORIGIN=http://192.168.1.50
```

rồi `docker compose up -d`. Mở `http://192.168.1.50` từ điện thoại / máy tính cùng mạng.
Khi có tên miền thì đổi lại hai dòng trên và chạy `docker compose up -d` lần nữa.

## 8. Cập nhật bản mới

```bash
cd /srv/tdbakugan/app
git pull
cd deploy
docker compose up -d --build
```

- Backend tự cập nhật CSDL (migration) khi khởi động; dữ liệu, ảnh và chứng chỉ HTTPS giữ nguyên.
- Mỗi giai đoạn có thể thêm biến mới vào `.env.example`. Sau `git pull`, so lại
  `.env.example` với `.env` và thêm biến còn thiếu (tài liệu giai đoạn đó sẽ ghi rõ).

## 9. Sao lưu tự động

`backup.sh` sao lưu CSDL và ảnh / video vào `/srv/tdbakugan/backups`:

- Giữ 14 bản theo ngày và 8 bản theo tuần.
- Chép thêm ra ổ ngoài (`BACKUP_EXTERNAL_DIR`) và lên mạng qua `rclone` (`RCLONE_REMOTE`) nếu có đặt.

Chạy thử một lần bằng tay:

```bash
cd /srv/tdbakugan/app/deploy
./backup.sh
ls -lh /srv/tdbakugan/backups/db/daily
```

**Chạy tự động 2 giờ sáng mỗi ngày**: gõ `crontab -e` rồi thêm dòng:

```
0 2 * * * /srv/tdbakugan/app/deploy/backup.sh >> /srv/tdbakugan/backups/backup.log 2>&1
```

**Ổ cứng ngoài**:

1. Cắm ổ, xem tên bằng `lsblk`, VD `/dev/sdb1`.
2. Gắn cố định vào `/mnt/usb-backup`:
   - `sudo mkdir -p /mnt/usb-backup`
   - Thêm vào `/etc/fstab` dòng `/dev/sdb1 /mnt/usb-backup ext4 defaults,nofail 0 2`
     (nên dùng `UUID=` thay cho `/dev/sdb1`; xem UUID bằng `sudo blkid`).
   - `sudo mount -a`
3. Đặt `BACKUP_EXTERNAL_DIR=/mnt/usb-backup` trong `.env`.

**Một nơi ngoài nhà** (phòng cháy nổ, mất máy):

1. Cài rclone: `sudo apt install -y rclone`.
2. `rclone config` → tạo remote Google Drive tên `gdrive`.
3. Đặt `RCLONE_REMOTE=gdrive:tdbakugan-backup` trong `.env`.

**Kiểm tra bản sao lưu mỗi tháng** (không đụng dữ liệu đang chạy):

```bash
./restore.sh --kiem-tra /srv/tdbakugan/backups/db/daily/<file mới nhất>.sql.gz
```

**Khôi phục thật** (khi mất dữ liệu). Lệnh sẽ hỏi xác nhận trước khi ghi đè:

```bash
./restore.sh /srv/tdbakugan/backups/db/daily/<file>.sql.gz /srv/tdbakugan/backups/uploads/<thư mục cùng ngày>
```

## 10. Theo dõi web còn sống

Tạo tài khoản miễn phí tại UptimeRobot (hoặc dịch vụ tương tự):

- Thêm monitor kiểu HTTP(s) cho `https://tdbakugan.vn/api/health`, 5 phút một lần.
- Chọn báo qua email / Telegram khi web sập.

## 11. Sự cố thường gặp

| Hiện tượng | Cách xử lý |
| --- | --- |
| Không xin được HTTPS (log `web` báo lỗi ACME / challenge) | Tên miền chưa trỏ đúng IP, router chưa mở 80/443, hoặc nhà mạng chặn cổng / dùng CGNAT (mục 1). Kiểm tra từ 4G: mở `http://<IP công khai>` |
| `api` không "healthy" | `docker compose logs api`. Dòng "Biến môi trường chưa đúng" liệt kê biến cần sửa trong `.env` |
| Trợ lý AI báo chưa có khoá | Điền `GEMINI_API_KEY` trong `.env` rồi `docker compose up -d` |
| Cúp điện xong web không lên | Chờ 1–2 phút (MySQL tự phục hồi), rồi `docker compose ps`. Vẫn lỗi thì xem log `mysql` |
| Ổ đầy | `df -h`. Xoá bớt bản sao lưu cũ trong `/srv/tdbakugan/backups`, dọn image cũ: `docker image prune` |

## 12. Những việc KHÔNG làm

- Không mở cổng 3306 (MySQL), 4000 (backend), 22 (SSH) ra internet.
- Không commit hay gửi file `deploy/.env` cho ai. Không dán khoá Gemini vào code.
- Không sửa dữ liệu trực tiếp trong MySQL khi web đang chạy, trừ khi được hướng dẫn cụ thể.
- Không xoá thư mục `/srv/tdbakugan/mysql` hay volume `caddy_data` (mất dữ liệu / chứng chỉ).
