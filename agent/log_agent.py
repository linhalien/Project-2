import os
import time
import threading
import queue
import requests
import re
import signal
import subprocess
from datetime import datetime, timezone, timedelta
TZ_VN = timezone(timedelta(hours=7))


# CẤU HÌNH ĐỊNH DANH & ENDPOINT
# =========================================================
DEVICE_ID = "AGENT_MACHINE_001"
DEVICE_SECRET = "super_secret_key_2026"
API_URL = "https://2uxz2wq2zh.execute-api.ap-southeast-1.amazonaws.com/prod/ingest"

FILE_AUTH = "/var/log/auth.log"
FILE_SYSLOG = "/var/log/syslog"
FILE_UFW = "/var/log/ufw.log"
FILE_SNORT = "/var/log/snort/snort.alert.fast"


# CẤU HÌNH BATCHING & QUEUE
# =========================================================
BATCH_SIZE = 25  
BATCH_TIMEOUT = 5 

# Hàng đợi tối đa 10000 dòng. Khi đạt mốc này, lệnh log_queue.put() sẽ chặn đứng (block) luồng đọc, chống tràn RAM
log_queue = queue.Queue(maxsize=10000)

# Cờ hiệu (Flag) dùng để thông báo cho tất cả các luồng biết khi có lệnh tắt hệ thống (Ctrl+C hoặc systemctl stop)
shutdown_flag = False

# Regex so khớp cấu trúc log hệ thống Ubuntu để bóc tách thời gian và tên tiến trình
SYS_LOG_PATTERN = re.compile(r"^([\d\-T:\.\+]+)\s+(\S+)\s+([^:]+):\s+(.*)$")


# CÁC HÀM XỬ LÝ
# =========================================================

def send_desktop_notification(title, message):
    """Hàm gọi lệnh hệ điều hành để popup thông báo lên màn hình Desktop (GUI)"""
    try:
        # Gọi tiến trình phụ (subprocess) chạy lệnh notify-send 
        # Cần khai báo đúng DISPLAY và DBUS để popup có thể xuyên từ tiến trình ngầm (systemd) lên màn hình
        subprocess.run([
            'sudo', '-u', 'pc1',
            'DISPLAY=:0', 
            'DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus',
            'notify-send', '-u', 'critical', title, message
        ], check=False)
    except Exception:
        pass # Nếu không có GUI hoặc lỗi, bỏ qua tránh làm sập script

def handle_shutdown_signal(signum, frame):
    """Hàm được gọi tự động khi hệ điều hành gửi tín hiệu tắt (SIGTERM/SIGINT)"""
    global shutdown_flag
    print("\n[!] Nhận lệnh tắt hệ thống. Dừng đọc file, chuẩn bị thoát...")
    # Bật cờ tắt máy, các vòng lặp while kiểm tra cờ này sẽ tự động dừng lại
    shutdown_flag = True

def parse_system_log(raw_text, default_daemon):
    """Hàm phân tích cú pháp 1 dòng log thô thành các trường dữ liệu rời rạc"""
    match = SYS_LOG_PATTERN.match(raw_text)
    if match:
        # Nếu regex khớp, lấy nguyên timestamp gốc (+07:00)
        return match.group(1), match.group(3).strip()
    
    # Nếu dòng log dị dạng, tự sinh thời gian hiện tại theo chuẩn múi giờ +07:00
    current_time = datetime.now(TZ_VN).strftime('%Y-%m-%dT%H:%M:%S+07:00')
    return current_time, default_daemon

def tail_file_python(file_path, data_type, default_daemon):
    """
    Luồng ĐỌC (Reader): 
    Nhiệm vụ DUY NHẤT là đọc file, ném log + offset byte vào queue
    KHÔNG GHI FILE .POS ĐỂ TRÁNH MẤT DATA KHI CRASH (VIỆC GHI FILE .POS CHỈ DO LUỒNG GỬI THỰC HIỆN SAU KHI ĐƯỢC AWS XÁC NHẬN ĐÃ NHẬN LOG)
    """
    global shutdown_flag
    pos_file = file_path + ".pos"
    
    # Biến nội bộ lưu tọa độ (offset) pointer trên file hiện tại
    last_pos = 0 
    
    # Khôi phục trí nhớ: Đọc file .pos (nếu có) để biết tọa độ an toàn cuối cùng đã được gửi thành công
    if os.path.exists(pos_file):
        with open(pos_file, 'r') as pf:
            try:
                last_pos = int(pf.read().strip())
            except ValueError:
                pass

    while not shutdown_flag:
        try:
            # Kiểm tra Log Rotation: Nếu kích thước file thực tế < tọa độ đã lưu
            # => nghĩa là hệ thống vừa xóa file log cũ, tạo file mới => reset tọa độ về 0
            if os.path.exists(file_path):
                if last_pos > os.path.getsize(file_path):
                    last_pos = 0

            with open(file_path, 'r') as f:
                # Đặt pointer thẳng tới tọa độ an toàn
                f.seek(last_pos)
                
                while not shutdown_flag:
                    # Đọc 1 dòng từ tọa độ hiện tại
                    line = f.readline()
                    
                    if not line:
                        # Đã chạm đáy file (hết log) => ngủ 0.5s để chờ log mới sinh ra
                        time.sleep(0.5)
                        
                        # Kiểm tra xem trong lúc ngủ, file có bị hệ thống xóa không
                        if last_pos > os.path.getsize(file_path):
                            break # Phá vòng lặp trong, quay ra vòng lặp ngoài để mở lại file từ đầu
                            
                        continue # Tiếp tục hóng dòng mới

                    # --- Xử lý dòng log mới ---
                    raw_text = line.strip()
                    if not raw_text:
                        continue

                    # Bóc tách dữ liệu tùy theo loại log (RAW hệ thống hoặc ALERT của Snort)
                    if data_type in ["SYS", "UFW"]:
                        timestamp, daemon_name = parse_system_log(raw_text, default_daemon)
                    else:
                        # Ép timestamp sinh mới về chuẩn +07:00 thay vì UTC
                        timestamp = datetime.now(TZ_VN).strftime('%Y-%m-%dT%H:%M:%S+07:00')
                        daemon_name = default_daemon

                    # Lấy tọa độ byte mới sau khi đọc xong dòng này
                    current_byte_offset = f.tell()

                    # Đóng gói dữ liệu, thêm file_path và byte_offset để luồng gửi (sender) cập nhật .pos
                    log_entry = {
                        "data_type": data_type,
                        "timestamp": timestamp,
                        "daemon_name": daemon_name,
                        "raw_message": raw_text,
                        "file_path": file_path,          # Bằng chứng nguồn gốc
                        "byte_offset": current_byte_offset # Tọa độ sau khi đọc xong dòng này
                    }
                    
                    # Ném vào queue để luồng gửi (sender) xử lý 
                    # Nếu queue đã đầy 10000 log, lệnh này sẽ block luồng đọc cho đến khi có chỗ trống, tránh tràn RAM
                    log_queue.put(log_entry)
                    
                    # Cập nhật biến tọa độ nội bộ để vòng lặp đọc tiếp dòng sau
                    last_pos = current_byte_offset
                    
        except FileNotFoundError:
            # File chưa được sinh ra, ngủ 5s rồi thử tìm lại
            print(f"[!] Lỗi luồng đọc {file_path}: {str(e)}") # Thêm dòng này
            time.sleep(5)
        except Exception:
            time.sleep(5)

def batch_and_send():
    """
    Luồng gỬI (sender) & Cập nhật .pos (ACK):
    Rút log từ queue -> Gửi AWS => nếu thành công mới tự tay ghi đè file .pos.
    """
    global shutdown_flag
    last_success_time = time.time()
    network_down_notified = False

    # Chạy liên tục kể cả khi có lệnh tắt (shutdown_flag), vẫn cố chạy nốt cho đến khi queue rỗng để vớt vát data
    while not shutdown_flag or not log_queue.empty():
        batch = []
        start_time = time.time()
        
        # Gom đủ 25 log (BATCH_SIZE) HOẶC hết 5 giây (BATCH_TIMEOUT) thì chốt batch
        while len(batch) < BATCH_SIZE and (time.time() - start_time) < BATCH_TIMEOUT:
            try:
                # Rút 1 log ra khỏi queue (chờ tối đa 1s, nếu không có thì báo lỗi queue.Empty)
                log = log_queue.get(timeout=1)
                batch.append(log)
            except queue.Empty:
                # Nếu queue trống mà lại có lệnh tắt máy thì thoát việc gom lô luôn
                if shutdown_flag: 
                    break 
                continue

        # Nếu gom được ít nhất 1 log
        if batch:
            print(f"\n[*] Đã gom lô {len(batch)} logs. Hàng đợi còn {log_queue.qsize()} logs. Đang đẩy lên AWS...") # THÊM DÒNG NÀY ĐỂ THẤY NÓ HOẠT ĐỘNG
            pos_updates = {}   # Dictionary tạm để lưu tọa độ byte mới nhất của các file trong lô này (dùng chung cho cả 3 loại log)
            clean_batch = []   # Mảng chứa dữ liệu sạch (chỉ gửi những gì AWS cần)

            for log_item in batch:
                # Tạo payload sạch, loại bỏ thông tin nội bộ máy trạm (file_path, byte_offset)
                clean_log = {
                    "data_type": log_item["data_type"],
                    "timestamp": log_item["timestamp"],
                    "daemon_name": log_item["daemon_name"],
                    "raw_message": log_item["raw_message"]
                }
                clean_batch.append(clean_log)
                
                # Cập nhật tọa độ lớn nhất của file tương ứng, dictionary tự động ghi đè để lấy giá trị cuối cùng của line cuối cùng được đọc
                # Nếu trong batch này có đủ 3 loại log thì dictionary sẽ lưu tọa độ mới nhất của cả 3 file .pos (3 cặp file_path: byte_offset)
                pos_updates[log_item["file_path"]] = log_item["byte_offset"]

            payload = { "logs": clean_batch }
            headers = {
                "Content-Type": "application/json",
                "Machine-Token": DEVICE_ID,
                "Machine-Secret": DEVICE_SECRET
            }
            
            success = False
            
            # Lặp vô hạn cho đến khi lô log này đi lọt
            while not success:
                try:
                    # Gửi lên AWS API Gateway
                    response = requests.post(API_URL, json=payload, headers=headers, timeout=10)
                    
                    if response.status_code >= 500:
                        # Lỗi máy chủ AWS (sập, quá tải,...) => ném Exception để nhảy xuống khối except bên dưới (Retry)
                        print(f"[!] AWS 5xx Error ({response.status_code}). Thử gửi lại lô log này...")
                        raise requests.exceptions.RequestException(f"AWS 5xx Error ({response.status_code})")
                        
                    elif response.status_code == 401 or response.status_code == 403:
                        # Bị từ chối do IP (403) hoặc token (401) -> ép success = True để hủy lô log này, tránh lặp vô hạn, kẹt hệ thống
                        print(f"[!] Lỗi xác thực (HTTP {response.status_code}). Kiểm tra lại token hoặc IP. Bỏ qua lô log này.")
                        success = True 
                    else:
                        # THÀNH CÔNG (HTTP 200)
                        success = True
                        print(f"[+] Gửi lô log thành công ({len(batch)} log). Cập nhật .pos...")
                        last_success_time = time.time()
                        
                        # Xóa thông báo lỗi mạng nếu trước đó đã bật
                        if network_down_notified:
                            send_desktop_notification("LOG AGENT", "Đã kết nối lại AWS thành công.")
                            network_down_notified = False
                            
                        
                        # cơ chế ACK
                        # ==========================================================
                        # Chỉ khi đến được đây (gửi thành công), luồng gửi mới mở 3 file .pos ra và ghi đè tọa độ mới nhất
                        # Nếu bị sập nguồn trước khi chạy dòng này, .pos vẫn giữ tọa độ cũ -> Không mất data
                        for filepath, max_offset in pos_updates.items(): 
                            try:
                                with open(filepath + ".pos", 'w') as pf:
                                    pf.write(str(max_offset))
                            except Exception:
                                pass # Bỏ qua lỗi I/O để luồng gửi đi tiếp
                        
                except requests.exceptions.RequestException as e:
                    # Xử lý khi lỗi mạng hoặc Exception từ 5xx
                    print(f"[!] BỊ KẸT: Lỗi kết nối mạng hoặc không tìm thấy API: {e}") # THÊM DÒNG NÀY ĐỂ XEM LỖI GÌ
                    downtime = time.time() - last_success_time
                    
                    # Popup thông báo nếu lỗi mạng hơn 300s (5 phút)
                    if downtime > 300 and not network_down_notified: 
                        send_desktop_notification("LỖI KẾT NỐI", "Mất kết nối tới AWS Cloud hơn 5 phút. Logs đang bị kẹt.")
                        network_down_notified = True
                    
                    # Nếu đang tắt máy mà bị lỗi mạng -> phá luôn vòng lặp retry để thoát 
                    # (offset gửi thành công cuối cùng vẫn được giữ nguyên, không mất data)
                    if shutdown_flag:
                        break
                        
                    # Ngủ 5 giây rồi vòng lên thử gửi lại lô log này
                    time.sleep(5)

if __name__ == "__main__":
    # Đăng ký hàm handle_shutdown_signal để bắt các lệnh kill tiến trình từ hệ điều hành
    signal.signal(signal.SIGTERM, handle_shutdown_signal)
    signal.signal(signal.SIGINT, handle_shutdown_signal)

    # Khởi tạo 3 luồng đọc chạy song song
    t_auth = threading.Thread(target=tail_file_python, args=(FILE_AUTH, "SYS", "auth"), daemon=True)
    t_sys = threading.Thread(target=tail_file_python, args=(FILE_SYSLOG, "SYS", "syslog"), daemon=True)
    t_ufw = threading.Thread(target=tail_file_python, args=(FILE_UFW, "UFW", "kernel"), daemon=True)
    t_snort = threading.Thread(target=tail_file_python, args=(FILE_SNORT, "ALERT", "snort"), daemon=True)
    
    # Khởi tạo 1 luồng gửi (Sender)
    t_sender = threading.Thread(target=batch_and_send, daemon=True)

    # Chạy tất cả các luồng
    t_auth.start()
    t_sys.start()
    t_ufw.start()
    t_snort.start()
    t_sender.start()

    # Luồng chính (Main thread) bị nhốt vào vòng lặp này để giữ cho script không bị tắt ngay 
    # (không có while này thì sau "t_sender.start()", luồng chính sẽ chạy tiếp xuống dưới, kết thúc chương trình, tất cả luồng con sẽ bị tắt theo)
    # Khi nhấn Ctrl+C, cờ shutdown_flag dựng lên, vòng lặp này và các luồng đọc sẽ tự động dừng lại, 
    # luồng gửi sẽ cố gắng vớt vát nốt data còn trong queue rồi mới tắt hẳn
    while not shutdown_flag:
        time.sleep(1)
        
    # Cho luồng gửi tối đa 5 giây để gửi nốt lô log cuối cùng đang cầm trên tay trước khi tắt hẳn chương trình
    t_sender.join(timeout=5)