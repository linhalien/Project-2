// Chưa hoàn thiện

import json
import boto3
from boto3.dynamodb.conditions import Key, Attr
from functools import reduce

dynamodb = boto3.resource('dynamodb', region_name='ap-southeast-1')

class AdvancedSearch:
    def __init__(self):
        # Init resources
        self.tables = {
            'SystemLogs': dynamodb.Table('SystemLogs'),
            'FirewallLogs': dynamodb.Table('FirewallLogs'),
            'SecurityAlerts': dynamodb.Table('SecurityAlerts')
        }
        
        # Ánh xạ table_target (từ FE) sang log_type để làm Partition Key query GSI
        self.log_type_map = {
            'SystemLogs': 'SYS',
            'FirewallLogs': 'UFW',
            'SecurityAlerts': 'ALERT'
        }

    def search(self, payload):
        table_target = payload.get('table_target')
        filters = payload.get('filters', {}) # Dict các tham số lọc động

        if table_target not in self.tables:
            return []

        table = self.tables[table_target]
        log_type_val = self.log_type_map[table_target]

        # 1. Ràng buộc bắt buộc để dùng được hàm query() trên index realtimeFetch
        key_condition = Key('log_type').eq(log_type_val)

        # 2. Xử lý bộ lọc động (Dynamic filters)
        filter_expression = None
        if filters:
            attr_conditions = []
            for col_name, col_value in filters.items():
                # Tạo điều kiện exact match cho từng field
                attr_conditions.append(Attr(col_name).eq(col_value))
            
            # Nối tất cả các điều kiện lại bằng toán tử AND (&)
            # VD: (src_ip == "10.1.0.7") & (action == "BLOCK")
            filter_expression = reduce(lambda x, y: x & y, attr_conditions)

        # 3. Call DB
        try:
            query_kwargs = {
                'IndexName': 'realtimeFetch',
                'KeyConditionExpression': key_condition,
                'ScanIndexForward': False, # Sort desc theo timestamp
                # Không dùng ProjectionExpression để ép DB trả full cột (cần lấy raw_message để đổ vào popup chi tiết)
            }

            if filter_expression:
                query_kwargs['FilterExpression'] = filter_expression

            response = table.query(**query_kwargs)
            return response.get('Items', [])

        except Exception as e:
            print(f"Search query error: {str(e)}")
            return []