import json
import re
import time
import uuid
import boto3
from datetime import datetime

# Khởi tạo client kết nối DynamoDB
dynamodb = boto3.resource('dynamodb', region_name='ap-southeast-1')

# Regex cho Suricata (fasl.log cấu trúc tương tự snort.alert.log) Alert
SNORT_PATTERN = re.compile(r"^([\d/:-]+(?:\.\d+)?)\s+\[\*\*\]\s+\[\d+:\d+:\d+\]\s+(.*?)\s+\[\*\*\]\s+\[Classification:\s+(.*?)\]\s+\[Priority:\s+(\d+)\]\s+\{(.*?)\}\s+(.*?)\s+->\s+(.*)$")

class LogIngestionController:
    # Đã sửa lại __init__ để nhận trực tiếp token, secret thay vì headers do qua SQS bị mất header
    def __init__(self, token, secret, payload):
        self.token = token
        self.secret = secret
        self.payload = payload
        self.device_id = None

    def authenticateMachine(self):
        """Xác thực thiết bị qua DynamoDB bảng RegisteredDevices"""
        if not self.token or not self.secret:
            return False

        table = dynamodb.Table('RegisteredDevices')
        try:
            response = table.get_item(Key={'device_id': self.token})
            item = response.get('Item')
            if item and item.get('device_secret') == self.secret and item.get('status') == 'ACTIVE':
                self.device_id = self.token
                return True
        except Exception as e:
            print(f"Lỗi truy vấn Auth: {e}")
            
        return False

    def calculateTTL(self, days_to_live=30):
        """Tính toán TTL để AWS tự động xóa log cũ"""
        return int(time.time()) + (days_to_live * 86400)

    def processAndRouteLogs(self):
        """Phân luồng, bóc tách Regex và ghi dữ liệu xuống 3 bảng tương ứng"""
        logs = self.payload.get('logs', [])
        if not logs:
            return
            
        expire_time = self.calculateTTL(days_to_live=30)
        
        # 3 mảng chứa các request ghi dữ liệu cho 3 bảng
        sys_puts = []
        fw_puts = []
        alert_puts = []

        # Duyệt qua từng log trong lô logs gửi từ agent
        for log in logs:
            data_type = log.get('data_type')
            timestamp = log.get('timestamp')
            raw_msg = log.get('raw_message', '')
            daemon_name = log.get('daemon_name', 'unknown')
            
            # xử lý log hệ thống cơ bản (auth và syslog)
            if data_type == 'SYS':
                sys_puts.append({
                    'PutRequest': {
                        'Item': {
                            'device_id': self.device_id,        # Partition key
                            'timestamp': timestamp,             # Sort key
                            'daemon_name': daemon_name,         # Thuộc tính GSI 1
                            'log_type': 'SYS',                  # Thuộc tính GSI 2, dùng cho realtime fetch
                            'raw_message': raw_msg,
                            'expire_time': expire_time
                        }
                    }
                })
                
            # Xử lý log tường lửa UFW (FirewallLogs)
            elif data_type == 'UFW':
                # Dùng re.search để quét và trích xuất từng nhóm giá trị trong chuỗi log thô
                # Cú pháp: tìm chuỗi khớp, nếu có thì lấy group(1), nếu không có thì gán "UNKNOWN" / "N/A"

                # mẫu lấy từ máy ubuntu: "2026-03-31T16:45:36.636071+07:00 pc1-VMware-Virtual-Platform kernel: 
                # [UFW BLOCK] IN=ens33 OUT= MAC=00:0c:29:b7:c4:ca:00:0c:29:98:7c:70:08:00 SRC=10.1.0.7 DST=10.1.0.16 
                # LEN=44 TOS=0x00 PREC=0x00 TTL=57 ID=28399 PROTO=TCP SPT=61105 DPT=80 WINDOW=1024 RES=0x00 SYN URGP=0"


                # Bắt hành vi (BLOCK, ALLOW, AUDIT) nằm trong [UFW ...]
                action_match = re.search(r"\[UFW\s+([A-Z]+)\]", raw_msg)
                action = action_match.group(1) if action_match else "UNKNOWN"
                
                # Bắt IP nguồn (SRC=...)
                src_match = re.search(r"SRC=([a-fA-F0-9\.:]+)", raw_msg)
                src_ip = src_match.group(1) if src_match else "N/A"
                
                # Bắt IP đích (DST=...)
                dst_match = re.search(r"DST=([a-fA-F0-9\.:]+)", raw_msg)
                dst_ip = dst_match.group(1) if dst_match else "N/A"
                
                # Bắt port nguồn (SPT=...) 
                spt_match = re.search(r"SPT=(\d+)", raw_msg)
                src_port = spt_match.group(1) if spt_match else "N/A"
                
                # Bắt port đích (DPT=...)
                dpt_match = re.search(r"DPT=(\d+)", raw_msg)
                dst_port = dpt_match.group(1) if dpt_match else "N/A"
                
                # Bắt giao thức (PROTO=...)
                proto_match = re.search(r"PROTO=([A-Za-z0-9]+)", raw_msg)
                protocol = proto_match.group(1) if proto_match else "N/A"

                fw_puts.append({
                    'PutRequest': {
                        'Item': {
                            'device_id': self.device_id,        # Partition key
                            'timestamp': timestamp,             # Sort key
                            'action': action,
                            'src_ip': src_ip,                   # Thuộc tính GSI 1
                            'dst_ip': dst_ip,
                            'src_port': src_port,
                            'dst_port': dst_port,
                            'protocol': protocol,
                            'raw_message': raw_msg,             # Log raw gốc để tra cứu chi tiết khi cần 
                            'expire_time': expire_time,
                            'log_type': 'UFW'                   # Thuộc tính GSI 2, dùng cho realtime fetch
                        }
                    }
                })
                
            # Xử lý log cảnh báo từ suricata (SecurityAlerts)
            elif data_type == 'ALERT':
                match = SNORT_PATTERN.search(raw_msg)
                
                attack_type = "UNKNOWN_ATTACK"
                severity_level = "LOW"
                
                if match:
                    # Bóc loại tấn công từ regex group 2
                    attack_type = match.group(2).strip()
                    # Bóc mức độ ưu tiên từ regex group 4 [Priority:...] và quy đổi sang Level
                    priority = int(match.group(4))
                    severity_level = "CRITICAL" if priority == 1 else "HIGH" if priority == 2 else "MEDIUM"

                alert_puts.append({
                    'PutRequest': {
                        'Item': {
                            'alert_id': str(uuid.uuid4()),      # Sinh ID ngẫu nhiên làm Partition key
                            'timestamp': timestamp,             # Sort key
                            'device_id': self.device_id,
                            'attack_type': attack_type,         # Thuộc tính GSI 2
                            'severity_level': severity_level,
                            'alert_status': 'NEW',              # Thuộc tính GSI 1
                            'raw_message_ref': raw_msg,
                            'expire_time': expire_time,
                            'log_type': 'ALERT'                   # Thuộc tính GSI 3, dùng cho realtime fetch
                        }
                    }
                })

        # Đóng gói toàn bộ request theo định dạng của BatchWriteItem
        request_items = {}
        
        # Chỉ đẩy vào mảng request_items nếu có dữ liệu
        if sys_puts:
            request_items['SystemLogs'] = sys_puts
        if fw_puts:
            request_items['FirewallLogs'] = fw_puts
        if alert_puts:
            request_items['SecurityAlerts'] = alert_puts

        # Thực thi ghi xuống DB
        if request_items:
            try:
                # BatchWriteItem (lệnh dynamoDB) ghi tối đa 25 items 1 lần
                # Agent đã khóa BATCH_SIZE = 25 nên mảng request_items sẽ luôn <= 25
                dynamodb.meta.client.batch_write_item(RequestItems=request_items)
            except Exception as e:
                # Quăng lỗi để Lambda chết -> SQS đẩy vào DLQ
                raise Exception(f"Lỗi BatchWriteItem: {e}")



# HÀM ENTRY POINT CHO AWS LAMBDA ĐÃ ĐƯỢC CẬP NHẬT ĐỂ DÙNG SQS TRIGGER
# =====================================================

def lambda_handler(event, context):
    # SQS luôn gửi dữ liệu trong mảng 'Records'
    for record in event.get('Records', []):
        try:
            # 1. Parse nội dung JSON từ SQS
            sqs_body = json.loads(record['body'])
            
            # 2. Lấy dữ liệu (Dựa vào Mapping Template mới bọc Header vào Body)
            token = sqs_body.get('machine_token')
            secret = sqs_body.get('machine_secret')
            payload = sqs_body.get('data', {})
            
            controller = LogIngestionController(token, secret, payload)
            
            # 3. Xác thực thiết bị 
            if not controller.authenticateMachine():
                # IN RA CẢNH BÁO CHO ADMIN VÀ BỎ QUA (DROP MESSAGE)
                print(f"Thiết bị {token} không hợp lệ hoặc đã bị khóa. Bỏ qua lô log này.")
                continue # Nhảy sang xử lý lô tiếp theo, KHÔNG raise Exception, SQS tự xóa
                
            # 4. Ghi DB
            controller.processAndRouteLogs()
            
        except json.JSONDecodeError:
            print("Lỗi: Định dạng JSON từ SQS bị hỏng.")
            raise Exception("Invalid JSON Payload")
            
        except Exception as e:
            print(f"Lỗi xử lý Record SQS: {str(e)}")
            # Ném lỗi ra ngoài cho AWS biết quá trình này thất bại
            raise e 
            
    # Khi dùng SQS, việc return 200 không có ý nghĩa với Agent nữa, 
    # nó chỉ báo cho CloudWatch là hàm đã chạy thành công.
    return "Processed SQS Batch Successfully"