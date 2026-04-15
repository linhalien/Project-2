// App.js

import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Realtime from './pages/Realtime';

const App = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // 1. Kiểm tra xem URL có chứa token do Cognito Hosted UI trả về không (dạng Hash Fragment)
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
            const params = new URLSearchParams(hash.substring(1)); // Bỏ dấu #
            const accessToken = params.get('access_token');
            
            if (accessToken) {
                localStorage.setItem('access_token', accessToken);
                // Xóa token khỏi thanh URL 
                window.history.replaceState(null, null, window.location.pathname); 
                setIsAuthenticated(true);
            }
        } else {
            // 2. Nếu không có trên URL, kiểm tra trong LocalStorage (User đã đăng nhập từ trước)
            const token = localStorage.getItem('access_token');
            if (token) {
                setIsAuthenticated(true);
            } else {
                // 3. Nếu không có token -> sang Cognito Hosted UI
                const cognitoUrl = `${process.env.REACT_APP_COGNITO_DOMAIN}/login?client_id=${process.env.REACT_APP_CLIENT_ID}&response_type=token&scope=email+openid+phone&redirect_uri=${process.env.REACT_APP_REDIRECT_URI}`;
                window.location.href = cognitoUrl;
                return; // Dừng chạy code bên dưới
            }
        }
        setIsLoading(false);
    }, []);

    if (isLoading) return <div style={{padding: '50px', textAlign: 'center'}}>Đang xác thực hệ thống...</div>;

    // 4. Nếu đã xác thực thành công, bọc Layout bên ngoài và cấu hình các trang con
    return (
        <Router>
            <Layout>
                <Routes>
                    {/* Mặc định vào thẳng trang Realtime */}
                    <Route path="/" element={<Navigate to="/realtime" />} />
                    <Route path="/realtime" element={<Realtime />} />
                    {/* Các trang sẽ làm sau */}
                    <Route path="/search" element={<div style={{padding: 20}}>Màn hình Tra cứu (Đang xây dựng)</div>} />
                    <Route path="/devices" element={<div style={{padding: 20}}>Màn hình Quản lý thiết bị (Đang xây dựng)</div>} />
                </Routes>
            </Layout>
        </Router>
    );
};

export default App;