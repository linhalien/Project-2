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
        
        // Nếu Cognito Authorizer trên API Gateway trả về 401 (Hết hạn hoặc sai token)
        if (response.status === 401) {
            localStorage.clear();
            window.location.href = '/'; 
            return null;
        }
        
        return await response.json();
    } catch (error) {
        console.error("Lỗi gọi API:", error);
        throw error;
    }
};