import React, { useState, useEffect } from 'react';
import { fetchApi } from '../utils/api';
import { RefreshCw, AlertCircle } from 'lucide-react';

const Realtime = () => {
    // State quản lý dữ liệu
    const [activeTab, setActiveTab] = useState('system'); // 'system' hoặc 'firewall'
    const [logs, setLogs] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [loadingAlerts, setLoadingAlerts] = useState(false);
    const [selectedAlert, setSelectedAlert] = useState(null); // Cho Giai đoạn 2

    // 1. Hàm lấy dữ liệu Logs (System/Firewall)
    const fetchLogs = async (type) => {
        setLoadingLogs(true);
        try {
            const res = await fetchApi(`/dashboard/realtime/${type}`);
            if (res && res.status === 'success') {
                setLogs(res.data);
            }
        } catch (e) {
            console.error("Lỗi fetch logs:", e);
        } finally {
            setLoadingLogs(false);
        }
    };

    // 2. Hàm lấy dữ liệu Alerts (Chỉ lấy status NEW)
    const fetchAlerts = async () => {
        setLoadingAlerts(true);
        try {
            const res = await fetchApi('/dashboard/realtime/alerts');
            if (res && res.status === 'success') {
                setAlerts(res.data);
            }
        } catch (e) {
            console.error("Lỗi fetch alerts:", e);
        } finally {
            setLoadingAlerts(false);
        }
    };

    // 3. Tự động load dữ liệu khi vào trang hoặc đổi tab
    useEffect(() => {
        fetchLogs(activeTab);
        fetchAlerts();
        
        // Cơ chế polling: Tự động làm mới mỗi 30 giây
        const interval = setInterval(() => {
            fetchLogs(activeTab);
            fetchAlerts();
        }, 30000);
        
        return () => clearInterval(interval);
    }, [activeTab]);

    return (
        <div style={{ display: 'flex', height: '100%', gap: '20px', minHeight: 0 }}>
            
            {/* CỘT TRÁI: LOGS MONITORING */}
            <div style={{ flex: 1.2, backgroundColor: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => setActiveTab('system')} style={tabStyle(activeTab === 'system')}>System Logs</button>
                        <button onClick={() => setActiveTab('firewall')} style={tabStyle(activeTab === 'firewall')}>Firewall Logs</button>
                    </div>
                    <button onClick={() => fetchLogs(activeTab)} style={refreshBtnStyle}>
                        <RefreshCw size={16} className={loadingLogs ? 'animate-spin' : ''} />
                    </button>
                </div>

                <div style={tableContainerStyle}>
                    <table style={tableStyle}>
                        <thead>
                            <tr style={theadStyle}>
                                <th style={thStyle}>Device</th>
                                {activeTab === 'system' ? <th style={thStyle}>Daemon</th> : <th style={thStyle}>Source IP</th>}
                                {activeTab === 'firewall' && <th style={thStyle}>Dest IP</th>}
                                <th style={thStyle}>Timestamp</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log, idx) => (
                                <tr key={idx} style={trStyle}>
                                    <td style={tdStyle}>{log.device_name}</td>
                                    <td style={tdStyle}>{activeTab === 'system' ? log.daemon_name : log.src_ip}</td>
                                    {activeTab === 'firewall' && <td style={tdStyle}>{log.dst_ip}</td>}
                                    <td style={tdStyle}>{new Date(log.timestamp).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* CỘT PHẢI: SECURITY ALERTS */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 0 }}>
                <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertCircle size={20} /> Security Alerts (NEW)
                    </h3>
                    <div style={tableContainerStyle}>
                        {alerts.map((alert, idx) => (
                            <div 
                                key={idx} 
                                onClick={() => setSelectedAlert(alert)}
                                style={alertCardStyle(selectedAlert?.timestamp === alert.timestamp)}
                            >
                                <div style={{ fontWeight: 'bold' }}>{alert.attack_type}</div>
                                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                                    {alert.device_name} • {new Date(alert.timestamp).toLocaleTimeString()}
                                </div>
                                <span style={severityBadgeStyle(alert.severity_level)}>{alert.severity_level}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Nửa dưới: Chi tiết Alert (Sẽ xử lý ở Giai đoạn 2) */}
                <div style={{ flex: 0.8, backgroundColor: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#374151' }}>Chi tiết Alert</h3>
                    {!selectedAlert ? (
                        <div style={emptyDetailStyle}>Nhấp vào một Alert để xử lý</div>
                    ) : (
                        <div style={{ fontSize: '0.9rem' }}>
                            <p><strong>Loại:</strong> {selectedAlert.attack_type}</p>
                            <p><strong>Thiết bị:</strong> {selectedAlert.device_name}</p>
                            <p><strong>Thời gian:</strong> {new Date(selectedAlert.timestamp).toLocaleString()}</p>
                            {/* Nút bấm update status sẽ code ở Giai đoạn 2 */}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- CSS Objects ---
const tabStyle = (active) => ({
    padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold',
    backgroundColor: active ? '#3b82f6' : '#f3f4f6', color: active ? 'white' : '#4b5563'
});
const tableContainerStyle = { flex: 1, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' };
const theadStyle = { backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', textAlign: 'left' };
const thStyle = { padding: '12px', color: '#374151' };
const trStyle = { borderBottom: '1px solid #f3f4f6' };
const tdStyle = { padding: '12px', color: '#4b5563' };
const refreshBtnStyle = { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' };
const alertCardStyle = (active) => ({
    padding: '12px', borderBottom: '1px solid #fee2e2', cursor: 'pointer', position: 'relative',
    backgroundColor: active ? '#fef2f2' : 'transparent', borderLeft: active ? '4px solid #dc2626' : '4px solid transparent'
});
const severityBadgeStyle = (level) => ({
    fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', position: 'absolute', right: '12px', top: '12px',
    backgroundColor: level === 'HIGH' ? '#fee2e2' : '#fef3c7', color: level === 'HIGH' ? '#991b1b' : '#92400e'
});
const emptyDetailStyle = { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #e5e7eb', borderRadius: '6px', color: '#94a3b8' };

export default Realtime;