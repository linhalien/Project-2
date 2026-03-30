import json
import re
import time
import uuid
import boto3
from datetime import datetime

# Khởi tạo client kết nối DynamoDB
dynamodb = boto3.resource('dynamodb', region_name='ap-southeast-1') # Sửa lại region nếu cần

# Regex so khớp Snort Alert (Thin Agent Pattern)
SNORT_PATTERN = re.compile(r"^([\d/:-]+(?:\.\d+)?)\s+\[\*\*\]\s+\[\d+:\d+:\d+\]\s+(.*?)\s+\[\*\*\]\s+\[Classification:\s+(.*?)\]\s+\[Priority:\s+(\d+)\]\s+\{(.*?)\}\s+(.*?)\s+->\s+(.*)$")

class LogIngestionController:
    def __init__(self, headers, body):
        self.headers = headers
        self.payload = body
        self.device_id = None

    def authenticateMachine(self):
        """Xác thực thiết bị qua DynamoDB"""
        # API Gateway tự động chuyển header thành chữ thường
        token = self.headers.get('machine-token') or self.headers.get('Machine-Token')
        secret = self.headers.get('machine-secret') or self.headers.get('Machine-Secret')

        if not token or not secret:
            return False

        table = dynamodb.Table('RegisteredDevices')
        try:
            response = table.get_item(Key={'device_id': token})
            item = response.get('Item')
            
            # Kiểm tra khớp Secret và trạng thái không bị khóa
            if item and item.get('device_secret') == secret and item.get('status') == 'ACTIVE':
                self.device_id = token
                return True
        except Exception as e:
            print(f"Lỗi truy vấn Auth: {e}")
            
        return False

    def calculateTTL(self, days_to_live=30):
        """Tính toán thời gian hết hạn (TTL) dưới dạng Unix Timestamp"""
        current_unix_time = int(time.time())
        expire_time = current_unix_time + (days_to_live * 86400)
        return expire_time

    def processAndRouteLogs(self):
        """Phân luồng, so khớp dữ liệu và ghi song song xuống 2 bảng"""
        logs = self.payload.get('logs', [])
        if not logs:
            return
            
        expire_time = self.calculateTTL(days_to_live=30)
        
        raw_puts = []
        alert_puts = []

        # Duyệt mảng O(N) 1 lần
        for log in logs:
            data_type = log.get('data_type')
            timestamp = log.get('timestamp')
            
            if data_type == 'RAW':
                raw_puts.append({
                    'PutRequest': {
                        'Item': {
                            'device_id': self.device_id,
                            'timestamp': timestamp,
                            'daemon_name': log.get('daemon_name', 'unknown'),
                            'raw_message': log.get('raw_message', ''),
                            'expire_time': expire_time
                        }
                    }
                })
                
            elif data_type == 'ALERT':
                raw_msg = log.get('raw_message', '')
                match = SNORT_PATTERN.search(raw_msg)
                
                # Giá trị mặc định nếu Regex không bắt được cấu trúc
                attack_type = "UNKNOWN_ATTACK"
                severity_level = "LOW"
                
                if match:
                    attack_type = match.group(2).strip()
                    priority = int(match.group(4))
                    severity_level = "CRITICAL" if priority == 1 else "HIGH" if priority == 2 else "MEDIUM"

                alert_puts.append({
                    'PutRequest': {
                        'Item': {
                            'alert_id': str(uuid.uuid4()), # Sinh ID ngẫu nhiên không trùng lặp
                            'timestamp': timestamp,
                            'device_id': self.device_id,
                            'attack_type': attack_type,
                            'severity_level': severity_level,
                            'alert_status': 'NEW',
                            'raw_message_ref': raw_msg,
                            'expire_time': expire_time
                        }
                    }
                })

        # Đóng gói request gửi lên DynamoDB
        request_items = {}
        if raw_puts:
            request_items['RawNetworkLogs'] = raw_puts
        if alert_puts:
            request_items['SecurityAlerts'] = alert_puts

        if request_items:
            try:
                # Ghi song song bằng BatchWriteItem
                dynamodb.meta.client.batch_write_item(RequestItems=request_items)
            except Exception as e:
                print(f"Lỗi BatchWriteItem: {e}")

# =====================================================
# HÀM ENTRY POINT CHO AWS LAMBDA
# =====================================================
def lambda_handler(event, context):
    try:
        # Tách Header và Body từ HTTP Request của API Gateway
        headers = event.get('headers', {})
        body = json.loads(event.get('body', '{}'))
        
        controller = LogIngestionController(headers, body)
        
        # 1. Xác thực thiết bị
        if not controller.authenticateMachine():
            return {
                'statusCode': 401,
                'body': json.dumps({'message': 'Unauthorized or Device Blocked'})
            }
            
        # 2. Phân luồng và ghi log
        controller.processAndRouteLogs()
        
        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'Logs ingested successfully'})
        }
        
    except json.JSONDecodeError:
        return {'statusCode': 400, 'body': json.dumps({'message': 'Invalid JSON Payload'})}
    except Exception as e:
        print(f"Lỗi hệ thống: {str(e)}")
        return {'statusCode': 500, 'body': json.dumps({'message': 'Internal Server Error'})}