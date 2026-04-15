import boto3

dynamodb = boto3.resource('dynamodb', region_name='ap-southeast-1')

class AlertStatusUpdater:
    def __init__(self):
        self.table = dynamodb.Table('SecurityAlerts')

    def update(self, payload):
        alert_id = payload.get('alert_id')
        timestamp_val = payload.get('timestamp') # Bắt buộc phải có vì là Sort Key
        new_status = payload.get('new_status')

        # Validate dữ liệu đầu vào
        if not alert_id or not timestamp_val or not new_status:
            return {
                "status": "error", 
                "message": "Thiếu alert_id, timestamp hoặc new_status trong payload"
            }

        try:
            response = self.table.update_item(
                # Cung cấp chính xác bộ khóa chính (Composite Key) để DB định vị record
                Key={
                    'alert_id': alert_id,
                    'timestamp': timestamp_val
                },
                # Thực hiện ghi đè giá trị ở cột alert_status
                UpdateExpression="SET alert_status = :status_val",
                ExpressionAttributeValues={
                    ':status_val': new_status
                },
                # Trả về data mới sau khi update xong để FE dùng nếu cần
                ReturnValues="UPDATED_NEW" 
            )
            
            return {
                "status": "success",
                "message": "Cập nhật trạng thái thành công",
                "updated_data": response.get('Attributes')
            }

        except Exception as e:
            print(f"Update Alert Error: {str(e)}")
            return {
                "status": "error", 
                "message": "Lỗi hệ thống khi cập nhật DynamoDB"
            }