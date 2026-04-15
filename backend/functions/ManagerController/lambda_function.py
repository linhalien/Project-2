import json
from AlertStatusUpdater import AlertStatusUpdater
from DeviceCRUD_Manager import DeviceCRUDManager

# Tận dụng Warm Start: Khởi tạo các object ở ngoài handler để tái sử dụng kết nối DB
alert_updater = AlertStatusUpdater()
device_manager = DeviceCRUDManager()

def lambda_handler(event, context):
    """
    Router điều phối cho các API quản trị (Ghi/Sửa/Xóa)
    """
    path = event.get('path', '')
    http_method = event.get('httpMethod', '')

    # Hàm đóng gói Response, BẮT BUỘC có CORS
    def build_response(status_code, body_data):
        return {
            'statusCode': status_code,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,PUT,DELETE'
            },
            'body': json.dumps(body_data, ensure_ascii=False)
        }

    try:
        # Lấy payload từ Body 
        payload = {}
        if event.get('body'):
            payload = json.loads(event['body'])

        # LUỒNG 1: Đổi trạng thái Alert
        # ==========================================
        if path == '/alerts/status' and http_method == 'PUT':
            result = alert_updater.update(payload)
            status_code = 200 if result['status'] == 'success' else 400
            return build_response(status_code, result)

        # LUỒNG 2: Quản lý thiết bị (CRUD)
        # ==========================================
        elif path == '/devices':
            
            # THÊM THIẾT BỊ
            if http_method == 'POST':
                result = device_manager.create_device(payload)
                status_code = 200 if result['status'] == 'success' else 400
                return build_response(status_code, result)
                
            # SỬA THIẾT BỊ
            elif http_method == 'PUT':
                result = device_manager.update_device(payload)
                status_code = 200 if result['status'] == 'success' else 400
                return build_response(status_code, result)
                
            # XÓA THIẾT BỊ
            elif http_method == 'DELETE':
                # Đôi khi frontend gửi ID cần xóa qua URL parameter thay vì body
                if not payload and event.get('queryStringParameters'):
                    payload = event['queryStringParameters']
                
                result = device_manager.delete_device(payload)
                status_code = 200 if result['status'] == 'success' else 400
                return build_response(status_code, result)

        # Trả về 404 nếu gọi sai đường dẫn hoặc sai method
        return build_response(404, {"status": "error", "message": "Route hoặc HTTP Method không được hỗ trợ trên Lambda này"})

    except Exception as e:
        print(f"Lỗi tại Router DeviceManagerController: {str(e)}")
        return build_response(500, {"status": "error", "message": "Lỗi nội bộ Server"})