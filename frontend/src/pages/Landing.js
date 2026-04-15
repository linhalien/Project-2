import React from 'react';
import { Shield, Lock, Activity, BarChart3 } from 'lucide-react';

const Landing = () => {
    const handleLogin = () => {
    // Redirect sang Cognito với luồng Code
    const cognitoUrl = `${process.env.REACT_APP_COGNITO_DOMAIN}/login?client_id=${process.env.REACT_APP_CLIENT_ID}&response_type=code&scope=email+openid&redirect_uri=${process.env.REACT_APP_REDIRECT_URI}`;
    window.location.href = cognitoUrl;
};

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: 'white', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column' }}>
            {/* Header đơn giản */}
            <nav style={{ padding: '20px 50px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.4rem', fontWeight: 'bold' }}>
                    <Shield color="#3b82f6" size={32} />
                    <span>THREAT <span style={{color: '#3b82f6'}}>INTEL</span></span>
                </div>
            </nav>

            {/* Hero Section */}
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 20px' }}>
                <h1 style={{ fontSize: '3.5rem', marginBottom: '20px', fontWeight: '800' }}>
                    Hệ Thống Giám Sát <br/> 
                    <span style={{ color: '#3b82f6' }}>An Ninh Mạng Tập Trung</span>
                </h1>
                <p style={{ fontSize: '1.2rem', color: '#94a3b8', maxWidth: '700px', marginBottom: '40px', lineHeight: '1.6' }}>
                    Thu thập, truy vết và phân tích sự kiện mạng (Logs) theo thời gian thực. 
                </p>

                <button 
                    onClick={handleLogin}
                    style={{ 
                        padding: '16px 40px', backgroundColor: '#3b82f6', color: 'white', border: 'none', 
                        borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer',
                        boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.5)', transition: '0.3s'
                    }}
                >
                    Đăng nhập vào Dashboard
                </button>

                {/* Features Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '30px', marginTop: '80px', maxWidth: '1000px' }}>
                    <FeatureCard icon={<Activity color="#3b82f6" />} title="Realtime Logs" desc="Theo dõi System và Firewall logs trực tiếp từ Agent." />
                    <FeatureCard icon={<Lock color="#3b82f6" />} title="Security Alerts" desc="Cảnh báo các hành vi tấn công dựa trên bộ quy tắc bảo mật." />
                    <FeatureCard icon={<BarChart3 color="#3b82f6" />} title="Analytics" desc="Tra cứu và phân tích dữ liệu lịch sử log tập trung." />
                </div>
            </main>

            <footer style={{ padding: '30px', textAlign: 'center', color: '#475569', borderTop: '1px solid #1e293b' }}>
                © 2026 Project 2 - Hanoi University of Science and Technology
            </footer>
        </div>
    );
};

// Component con cho card tính năng
const FeatureCard = ({ icon, title, desc }) => (
    <div style={{ backgroundColor: '#1e293b', padding: '30px', borderRadius: '12px', textAlign: 'left', border: '1px solid #334155' }}>
        <div style={{ marginBottom: '15px' }}>{icon}</div>
        <h3 style={{ marginBottom: '10px', fontSize: '1.2rem' }}>{title}</h3>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.5' }}>{desc}</p>
    </div>
);

export default Landing;