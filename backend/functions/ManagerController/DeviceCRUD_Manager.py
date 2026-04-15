import boto3
import uuid
import secrets

dynamodb = boto3.resource('dynamodb', region_name='ap-southeast-1')

class DeviceCRUDManager:
    def __init__(self):
        self.table = dynamodb.Table('RegisteredDevices')

    def create_device(self, payload):
        """
        API POST: Thêm thiết bị mới
        FE chỉ cần gửi: {"device_name": "Web Server 1", "status": "ACTIVE"}
        """
        device_name = payload.get('device_name', 'Unknown Device')
        status = payload.get('status', 'ACTIVE')

        # Tự sinh ID và Secret duy nhất
        # uuid4 để làm Machine-Token, token_hex(32) sinh chuỗi 64 ký tự ngẫu nhiên làm Secret
        new_device_id = str(uuid.uuid4())
        new_device_secret = secrets.token_hex(32)

        item = {
            'device_id': new_device_id,
            'device_name': device_name,
            'device_secret': new_device_secret,
            'status': status
        }

        try:
            self.table.put_item(Item=item)
            # Trả về nguyên cục item để UI hiển thị Secret ra màn hình 1 lần duy nhất cho Admin copy dán vào Agent
            return {
                "status": "success",
                "message": "Thêm thiết bị thành công",
                "data": item 
            }
        except Exception as e:
            print(f"Create error: {str(e)}")
            return {"status": "error", "message": "Lỗi DB khi thêm"}

    def update_device(self, payload):
        """
        API PUT: Sửa thông tin
        Bảo mật: Lọc sạch payload, không cho phép sửa ID hoặc Secret
        """
        device_id = payload.get('device_id')
        if not device_id:
            return {"status": "error", "message": "Thiếu device_id"}

        # 1. Tạo 1 dict mới, chỉ cho phép giữ lại các trường an toàn (không phải id hoặc secret) để update
        allowed_updates = {}
        for key, value in payload.items():
            if key not in ['device_id', 'device_secret']:
                allowed_updates[key] = value

        if not allowed_updates:
            return {"status": "error", "message": "Không có thông tin hợp lệ để sửa"}

        # 2. Update động theo các trường mà FE gửi lên (không phải lúc nào FE cũng sửa tất cả trường)
        # Nếu FE gửi {device_name: "abc", status: "INACTIVE"} -> tự động build ra UpdateExpression tương ứng
        update_expr = "SET "
        expr_names = {}
        expr_attrs = {}
        
        for idx, (key, value) in enumerate(allowed_updates.items()):
            update_expr += f"#f{idx} = :v{idx}, "
            expr_names[f"#f{idx}"] = key
            expr_attrs[f":v{idx}"] = value
            
        update_expr = update_expr.rstrip(', ') # Xóa dấu phẩy thừa 

        try:
            response = self.table.update_item(
                Key={'device_id': device_id},
                UpdateExpression=update_expr,
                ExpressionAttributeNames=expr_names,
                ExpressionAttributeValues=expr_attrs,
                ReturnValues="UPDATED_NEW"
            )
            return {
                "status": "success",
                "message": "Cập nhật thành công",
                "updated_data": response.get('Attributes')
            }
        except Exception as e:
            print(f"Update error: {str(e)}")
            return {"status": "error", "message": "Lỗi DB khi sửa"}

    def delete_device(self, payload):
        """API DELETE: Xóa thiết bị"""
        device_id = payload.get('device_id')
        if not device_id:
            return {"status": "error", "message": "Thiếu device_id"}

        try:
            self.table.delete_item(
                Key={'device_id': device_id}
            )
            return {"status": "success", "message": "Xóa thành công"}
        except Exception as e:
            print(f"Delete error: {str(e)}")
            return {"status": "error", "message": "Lỗi DB khi xóa"}