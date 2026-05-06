const BASE_URL = process.env.REACT_APP_API_BASE_URL;

export const fetchApi = async (endpoint, options = {}) => {
    const token = localStorage.getItem('id_token');
    
    const headers = {
        'Content-Type': 'application/json',
        // Nếu có token thì kẹp vào header Authorization
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers,
    };

    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
        
        // Nếu Cognito Authorizer trên API Gateway trả về 401 (Hết hạn hoặc sai token) hoặc 403 (Không có quyền), thì xóa token và chuyển về trang login
        if (response.status === 401 || response.status === 403) {
            localStorage.clear();
            sessionStorage.clear(); // Storage mặc định của react-oidc-context
            window.location.href = '/home'; // Chuyển về trang landing/login
            return null;
        }
        
        return await response.json();
    } catch (error) {
        console.error("Lỗi gọi API:", error);
        throw error;
    }
};