import json
from RealtimeLogsFetcher import RealtimeFetcher
from AdvancedSearchAPI import AdvancedSearch

# Khởi tạo các object bên ngoài hàm handler để tận dụng cơ chế "Warm Start" của Lambda (giúp API chạy nhanh hơn ở các lần gọi sau)
realtime_fetcher = RealtimeFetcher()
search_api = AdvancedSearch()

def lambda_handler(event, context):
    """
    Hàm entry-point mặc định mà AWS Lambda sẽ gọi đầu tiên
    """
    # Lấy thông tin đường dẫn và phương thức từ API Gateway (Proxy Integration)
    path = event.get('path', '')
    http_method = event.get('httpMethod', '')
    
    # Hàm tiện ích để đóng gói Response trả về cho Frontend (BẮT BUỘC phải có CORS headers)
    def build_response(status_code, body_data):
        return {
            'statusCode': status_code,
            'headers': {
                'Access-Control-Allow-Origin': '*', # Tránh lỗi CORS
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,PUT,DELETE'
            },
            'body': json.dumps(body_data, ensure_ascii=False) # Đảm bảo không bị lỗi font tiếng Việt
        }

    try:
        # LUỒNG 1: Xử lý API Realtime
        if path.startswith('/dashboard/realtime/') and http_method == 'GET':
            # Cắt chuỗi để lấy chữ cuối cùng (system, firewall, hoặc alerts)
            category = path.split('/')[-1] 
            
            # Gọi file logic
            data = realtime_fetcher.fetch(category)
            return build_response(200, {"status": "success", "data": data})

        # LUỒNG 2: Xử lý API Search
        elif path == '/search':
            payload = {}
            
            # Lấy data đầu vào. Xử lý cả 2 trường hợp: FE gửi JSON (POST) hoặc gửi Query Params (GET)
            if event.get('body'):
                payload = json.loads(event['body'])
            elif event.get('queryStringParameters'):
                params = event['queryStringParameters']
                payload['table_target'] = params.get('table_target')
                # Tự động gom các tham số lọc còn lại vào mảng 'filters'
                payload['filters'] = {k: v for k, v in params.items() if k != 'table_target'}

            # Gọi file logic
            data = search_api.search(payload)
            return build_response(200, {"status": "success", "data": data})

        # LUỒNG 3: Bắt lỗi nếu FE gọi nhầm route
        else:
            return build_response(404, {"status": "error", "message": "Route không tồn tại. Vui lòng kiểm tra lại URL và phương thức HTTP."})

    except Exception as e:
        print(f"Lỗi tại Router QueryController: {str(e)}")
        return build_response(500, {"status": "error", "message": "Lỗi nội bộ Server"})