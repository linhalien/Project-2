import boto3
from boto3.dynamodb.conditions import Key

# Khởi tạo tài nguyên kết nối DynamoDB
dynamodb = boto3.resource('dynamodb', region_name='ap-southeast-1')

class RealtimeFetcher:
    def __init__(self):
        # Khai báo các bảng cần tương tác
        self.tables = {
            'system': dynamodb.Table('SystemLogs'),
            'firewall': dynamodb.Table('FirewallLogs'),
            'alerts': dynamodb.Table('SecurityAlerts'),
            'devices': dynamodb.Table('RegisteredDevices')
        }

    def _get_device_map(self):
        """
        Lấy danh sách tất cả thiết bị để tạo bộ từ điển mapping {id: name}
        Giúp UI hiển thị tên thiết bị thay vì ID uuid khó hiểu
        """
        try:
            # Lấy toàn bộ thiết bị với projection chỉ cần device_id và device_name 
            response = self.tables['devices'].scan(
                ProjectionExpression="device_id, device_name"
            )
            # Trả về dictionary dạng: {devide_id: device_name}
            return {item['device_id']: item.get('device_name', 'Unknown') for item in response.get('Items', [])}
        except Exception as e:
            print(f"Lỗi không lấy được thiết bị: {str(e)}")
            return {}

    def fetch(self, log_category):
        """Hàm entry point để lấy dữ liệu realtime dựa trên category từ URL"""
        table = self.tables.get(log_category)
        if not table:
            return []

        # 1. Lấy bản đồ tên thiết bị trước
        device_map = self._get_device_map()
        
        # 2. Query lấy dữ liệu thô từ DynamoDB (Tối đa 50 bản ghi mới nhất)
        if log_category == 'system':
            raw_data = self._query_logs(table, 'SYS', "device_id, daemon_name, #ts", {"#ts": "timestamp"})
        elif log_category == 'firewall':
            raw_data = self._query_logs(table, 'UFW', "device_id, src_ip, dst_ip, #ts", {"#ts": "timestamp"})
        elif log_category == 'alerts':
            raw_data = self._query_alerts(table)
        else:
            raw_data = []

        # 3. Duyệt qua dữ liệu thô để thay thế device_id bằng device_name
        for item in raw_data:
            d_id = item.get('device_id')
            # Nếu tìm thấy tên trong bản đồ thì gán vào, không thì giữ lại ID làm fallback
            item['device_name'] = device_map.get(d_id, f"ID: {d_id[:]}")
            # Xóa device_id cũ đi cho gọn payload gửi về Frontend
            if 'device_id' in item: del item['device_id']

        return raw_data

    def _query_logs(self, table, log_type_val, projection, attr_names=None):
        """Sử dụng Index 'realtimeFetch' để truy vấn nhanh theo loại log"""
        response = table.query(
            IndexName='realtimeFetch',
            KeyConditionExpression=Key('log_type').eq(log_type_val),
            ScanIndexForward=False, # False: lấy dữ liệu mới nhất lên đầu (DESC)
            Limit=50,               # Lấy tối đa 50 dòng (nếu bảng có ít hơn 50 thì lấy hết)
            ProjectionExpression=projection,
            ExpressionAttributeNames=attr_names
        )
        return response.get('Items', [])

    def _query_alerts(self, table):
        """Truy vấn lấy TOÀN BỘ thông tin Alert từ Index"""
        response = table.query(
            IndexName='alert_status-timestamp-index',
            KeyConditionExpression=Key('alert_status').eq('NEW'),
            ScanIndexForward=False,
            Limit=50
        )
        return response.get('Items', [])
    
    def update_alert(self, device_id, timestamp):
        """Hàm đổi trạng thái alert sang RESOLVED"""
        try:
            self.tables['alerts'].update_item(
                Key={'alert_id': device_id, 'timestamp': timestamp},
                UpdateExpression="set alert_status = :s",
                ExpressionAttributeValues={':s': 'RESOLVED'}
            )
            return True
        except Exception: return False