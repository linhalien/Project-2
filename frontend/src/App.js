import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Realtime from './pages/Realtime';
import Landing from './pages/Landing';
import Search from './pages/Search';
import Devices from './pages/Devices';

const App = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('access_token'));
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            const searchParams = new URLSearchParams(window.location.search);
            const code = searchParams.get('code');

            if (code && !isAuthenticated) {
                try {
                    const tokenEndpoint = `${process.env.REACT_APP_COGNITO_DOMAIN}/oauth2/token`;
                    const bodyParams = new URLSearchParams();
                    bodyParams.append('grant_type', 'authorization_code');
                    bodyParams.append('client_id', process.env.REACT_APP_CLIENT_ID);
                    bodyParams.append('code', code);
                    bodyParams.append('redirect_uri', process.env.REACT_APP_REDIRECT_URI);

                    const response = await fetch(tokenEndpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: bodyParams
                    });

                    if (response.ok) {
                        const data = await response.json();
                        localStorage.setItem('access_token', data.access_token);
                        localStorage.setItem('id_token', data.id_token); //kẹp vào header HTTP
                        window.history.replaceState(null, null, window.location.pathname);
                        setIsAuthenticated(true);
                    }
                } catch (error) {
                    console.error("Auth Error:", error);
                }
            }
            setIsLoading(false);
        };
        checkAuth();
    }, [isAuthenticated]);

    if (isLoading) return <div style={{backgroundColor: '#0f172a', height: '100vh', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>Đang khởi tạo hệ thống...</div>;

    return (
        <Router>
            <Routes>
                {/* Trang Landing */}
                <Route path="/home" element={isAuthenticated ? <Navigate to="/realtime" /> : <Landing />} />

                {/* Các Route sau login (Yêu cầu Login) */}
                <Route path="/realtime" element={isAuthenticated ? <Layout><Realtime /></Layout> : <Navigate to="/home" />} />
                <Route path="/search" element={isAuthenticated ? <Layout><Search /></Layout> : <Navigate to="/home" />} />
                <Route path="/devices" element={isAuthenticated ? <Layout><Devices /></Layout> : <Navigate to="/home" />} />
                {/* Mặc định quay về home */}
                <Route path="*" element={<Navigate to="/home" />} />
            </Routes>
        </Router>
    );
};

export default App;