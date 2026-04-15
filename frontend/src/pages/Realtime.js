import React, { useState } from 'react';

const Realtime = () => {
    // Quản lý Tab ở cột trái
    const [activeTab, setActiveTab] = useState('systemLog'); 

    return (
        <div style={{ display: 'flex', height: '100%', gap: '20px' }}>
            
            {/* ================= CỘT TRÁI (LOGS) ================= */}
            <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}>
                {/* 2 Nút Tab */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <button 
                        onClick={() => setActiveTab('systemLog')}
                        style={{ padding: '10px 20px', fontWeight: 'bold', backgroundColor: activeTab === 'systemLog' ? '#e0f2fe' : '#f3f4f6', color: activeTab === 'systemLog' ? '#0369a1' : '#4b5563', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: '0.2s' }}
                    >
                        System Logs
                    </button>
                    <button 
                        onClick={() => setActiveTab('firewallLog')}
                        style={{ padding: '10px 20px', fontWeight: 'bold', backgroundColor: activeTab === 'firewallLog' ? '#e0f2fe' : '#f3f4f6', color: activeTab === 'firewallLog' ? '#0369a1' : '#4b5563', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: '0.2s' }}
                    >
                        Firewall Logs
                    </button>
                </div>
                
                {/* Bảng dữ liệu Logs */}
                <div style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: '6px', padding: '15px', backgroundColor: '#f9fafb' }}>
                    <h3 style={{marginTop: 0, color: '#374151'}}>
                        {activeTab === 'systemLog' ? 'Dữ liệu System Logs' : 'Dữ liệu Firewall Logs'}
                    </h3>
                    <p style={{color: '#6b7280'}}>Khu vực này sẽ render bảng gọi API tương ứng...</p>
                </div>
            </div>

            {/* ================= CỘT PHẢI (ALERTS) ================= */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Nửa trên: Danh sách Alert */}
                <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ marginTop: 0, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{width: 10, height: 10, backgroundColor: '#dc2626', borderRadius: '50%', display: 'inline-block'}}></span>
                        Security Alerts (NEW)
                    </h3>
                    <div style={{ border: '1px solid #e5e7eb', height: 'calc(100% - 40px)', borderRadius: '6px', padding: '15px', backgroundColor: '#fef2f2' }}>
                        <p style={{color: '#6b7280'}}>Khu vực đổ danh sách các cảnh báo bảo mật mới nhất...</p>
                    </div>
                </div>

                {/* Nửa dưới: Chi tiết Alert (Ban đầu ẩn/trống) */}
                <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ marginTop: 0, color: '#374151' }}>Chi tiết Alert</h3>
                    <div style={{ color: '#6b7280', display: 'flex', height: '80%', alignItems: 'center', justifyContent: 'center', border: '2px dashed #e5e7eb', borderRadius: '6px' }}>
                        Nhấp vào một Alert ở bảng trên để xem chi tiết và xử lý.
                    </div>
                </div>
            </div>

        </div>
    );
};

export default Realtime;