import json
from RealtimeLogsFetcher import RealtimeFetcher
from AdvancedSearchAPI import AdvancedSearch

realtime_fetcher = RealtimeFetcher()
search_api = AdvancedSearch()

def lambda_handler(event, context):
    """
    Hàm entry-point mặc định mà AWS Lambda sẽ gọi đầu tiên
    """
    # Lấy thông tin đường dẫn và phương thức từ API Gateway
    path = event.get('path', '')
    http_method = event.get('httpMethod', '')
    
    # Hàm đóng gói Response trả về cho Frontend (BẮT BUỘC phải có CORS headers)
    def build_response(status_code, body_data):
        return {
            'statusCode': status_code,
            'headers': {
                'Access-Control-Allow-Origin': '*', # Tránh lỗi CORS
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,PUT,DELETE'
            },
            'body': json.dumps(body_data, ensure_ascii=False, default=str) # Đảm bảo không bị lỗi font tiếng Việt
        }

    try:
        # LUỒNG 1: Xử lý API Realtime (method GET)
        if path.startswith('/dashboard/realtime/') and http_method == 'GET':
            category = path.split('/')[-1]
            data = realtime_fetcher.fetch(category)
            return build_response(200, {"status": "success", "data": data})
            
        # LUỒNG 1.5: Xử lý nút Xác nhận xử lý Alert (method PUT)
        elif path == '/alerts/status' and http_method == 'PUT':
            payload = json.loads(event.get('body', '{}'))
            
            # Lấy alert_id và timestamp từ body FE gửi lên
            d_id = payload.get('alert_id')
            ts = payload.get('timestamp')
            
            if realtime_fetcher.update_alert(d_id, ts):
                return build_response(200, {"status": "success"})
            else:
                return build_response(500, {"status": "error", "message": "Update failed"})

        # LUỒNG 2: Xử lý API Search (method POST)
        elif path == '/search' and http_method == 'POST':
            payload = {}
            if event.get('body'):
                payload = json.loads(event['body'])

            # Gọi file logic AdvancedSearchAPI
            data = search_api.search(payload)
            return build_response(200, {"status": "success", "data": data})

        # LUỒNG 3: Bắt lỗi nếu FE gọi nhầm route
        else:
            return build_response(404, {"status": "error", "message": "Route không tồn tại. Vui lòng kiểm tra lại URL và phương thức HTTP."})

    except Exception as e:
        print(f"Lỗi tại Router QueryController: {str(e)}")
        return build_response(500, {"status": "error", "message": str(e)})