import React, { useState } from 'react';
import { Menu, Activity, Search, Server, LogOut } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const Layout = ({ children }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const menuItems = [
        { path: '/realtime', name: 'Realtime Dashboard', icon: <Activity size={20} /> },
        { path: '/search', name: 'Tra cứu Logs', icon: <Search size={20} /> },
        { path: '/devices', name: 'Quản lý Thiết bị', icon: <Server size={20} /> }
    ];

    const handleLogout = () => {
        localStorage.clear();
        // Gọi API Logout của Cognito
        window.location.href = `${process.env.REACT_APP_COGNITO_DOMAIN}/logout?client_id=${process.env.REACT_APP_CLIENT_ID}&logout_uri=${process.env.REACT_APP_REDIRECT_URI}`;
    };

    return (
        <div style={{ display: 'flex', height: '100vh', backgroundColor: '#f3f4f6', fontFamily: 'sans-serif' }}>
            
            {/* Thanh Sidebar Menu */}
            <div style={{ 
                width: isMenuOpen ? '250px' : '0', 
                overflow: 'hidden', 
                transition: 'width 0.3s', 
                backgroundColor: '#1f2937', 
                color: 'white',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div style={{ padding: '20px', fontSize: '1.2rem', fontWeight: 'bold', borderBottom: '1px solid #374151' }}>
                    Admin Console
                </div>
                
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, flex: 1 }}>
                    {menuItems.map(item => (
                        <li 
                            key={item.path}
                            onClick={() => { navigate(item.path); setIsMenuOpen(false); }}
                            style={{ 
                                padding: '15px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '15px',
                                backgroundColor: location.pathname.includes(item.path) ? '#374151' : 'transparent',
                                borderLeft: location.pathname.includes(item.path) ? '4px solid #3b82f6' : '4px solid transparent'
                            }}
                        >
                            {item.icon} {item.name}
                        </li>
                    ))}
                </ul>

                <div style={{ padding: '20px', borderTop: '1px solid #374151' }}>
                    <button onClick={handleLogout} style={{ width: '100%', padding: '10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <LogOut size={18} /> Đăng xuất
                    </button>
                </div>
            </div>

            {/* Vùng nội dung chính */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Header chứa nút 3 gạch */}
                <header style={{ backgroundColor: 'white', padding: '15px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center' }}>
                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                        <Menu size={28} color="#374151" />
                    </button>
                    <h2 style={{ margin: '0 0 0 15px', fontSize: '1.2rem', color: '#111827' }}>Threat Intelligence Dashboard</h2>
                </header>

                {/* Vùng Render các màn hình con */}
                <main style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
                    {children}
                </main>
            </div>
        </div>
    );
};

export default Layout;