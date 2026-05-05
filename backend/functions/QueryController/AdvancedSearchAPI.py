import json
import boto3
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource('dynamodb', region_name='ap-southeast-1')

class AdvancedSearch:
    def __init__(self):
        self.tables = {
            'SystemLogs': dynamodb.Table('SystemLogs'),
            'FirewallLogs': dynamodb.Table('FirewallLogs'),
            'SecurityAlerts': dynamodb.Table('SecurityAlerts')
        }
        self.log_type_map = {
            'SystemLogs': 'SYS',
            'FirewallLogs': 'UFW',
            'SecurityAlerts': 'ALERT'
        }

    def search(self, payload):
        table_target = payload.get('table_target')
        filters = payload.get('filters', {}) 
        time_range = payload.get('time_range', {})

        if table_target not in self.tables:
            return []

        table = self.tables[table_target]
        log_type_val = self.log_type_map[table_target]

        # 1. Ràng buộc KeyCondition (Chỉ dùng Partition Key + Sort Key cho DynamoDB)
        key_condition = Key('log_type').eq(log_type_val)
        if time_range and time_range.get('start') and time_range.get('end'):
            key_condition = key_condition & Key('timestamp').between(time_range['start'], time_range['end'])

        try:
            # 2. Call DB để lấy tập dữ liệu thô theo thời gian
            query_kwargs = {
                'IndexName': 'realtimeFetch',
                'KeyConditionExpression': key_condition,
                'ScanIndexForward': False
            }
            
            response = table.query(**query_kwargs)
            raw_items = response.get('Items', [])

            # Nếu không có bộ lọc nào được chọn, trả về nguyên bản
            if not filters:
                return raw_items

            # 3. Lọc dữ liệu (Filter) bằng Python (tìm theo chuỗi con, không phân biệt hoa thường)
            filtered_items = []
            for item in raw_items:
                match_all = True
                for col_name, col_value in filters.items():
                    # Ép kiểu dữ liệu gốc và dữ liệu nhập vào về dạng chuỗi viết thường (lowercase)
                    item_val = str(item.get(col_name, '')).lower()
                    search_val = str(col_value).lower()
                    
                    # Dùng toán tử 'in' để kiểm tra xem từ khóa search có nằm trong chuỗi gốc không
                    # Ví dụ: "scan" in "port scan" -> True
                    if search_val not in item_val:
                        match_all = False
                        break # Dừng kiểm tra nếu có 1 điều kiện bị sai
                
                # Chỉ lấy những dòng log thỏa mãn TẤT CẢ các điều kiện (Toán tử AND)
                if match_all:
                    filtered_items.append(item)

            return filtered_items

        except Exception as e:
            print(f"Search query error: {str(e)}")
            return []