# CẤU HÌNH ĐỊNH DANH & ENDPOINT
# =========================================================
DEVICE_ID = "AGENT_MACHINE_001"
DEVICE_SECRET = "super_secret_key_2026"
API_URL = "https://2uxz2wq2zh.execute-api.ap-southeast-1.amazonaws.com/prod/ingest"

FILE_AUTH = "/var/log/auth.log"
FILE_SYSLOG = "/var/log/syslog"
FILE_UFW = "/var/log/ufw.log"
FILE_SNORT = "/var/log/snort/snort.alert.fast"


# CẤU HÌNH BATCHING & QUEUE
# =========================================================
BATCH_SIZE = 25  
BATCH_TIMEOUT = 5 