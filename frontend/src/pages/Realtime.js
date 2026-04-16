import React, { useState, useEffect } from 'react';
import { fetchApi } from '../utils/api';
import { RefreshCw, AlertCircle, ShieldCheck } from 'lucide-react';

const Realtime = () => {
    const [activeTab, setActiveTab] = useState('system');
    const [logs, setLogs] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [loadingAlerts, setLoadingAlerts] = useState(false);
    const [selectedAlert, setSelectedAlert] = useState(null);

    const fetchLogs = async (type) => {
        setLoadingLogs(true);
        try {
            const res = await fetchApi(`/dashboard/realtime/${type}`);
            if (res && res.status === 'success') setLogs(res.data);
        } catch (e) {
            console.error("Lỗi fetch logs:", e);
        } finally {
            setLoadingLogs(false);
        }
    };

    const fetchAlerts = async () => {
        setLoadingAlerts(true);
        try {
            const res = await fetchApi('/dashboard/realtime/alerts');
            if (res && res.status === 'success') setAlerts(res.data);
        } catch (e) {
            console.error("Lỗi fetch alerts:", e);
        } finally {
            setLoadingAlerts(false);
        }
    };

    const handleResolve = async (alert) => {
        if (!window.confirm("Xác nhận đã xử lý cảnh báo này?")) return;
        try {
            const res = await fetchApi('/alerts/status', {
                method: 'PUT',
                body: JSON.stringify({
                    alert_id: alert.alert_id,  
                    timestamp: alert.timestamp,
                    new_status: 'RESOLVED'      
                })
            });
           
            if (res && res.status === 'success') {
                setSelectedAlert(null);
                fetchAlerts();
            }
        } catch (e) {
            console.error("Lỗi cập nhật alert:", e);
        }
    };

    useEffect(() => {
        fetchLogs(activeTab);
        fetchAlerts();
        const interval = setInterval(() => {
            fetchLogs(activeTab);
            fetchAlerts();
        }, 1500); // update mỗi 1.5 giây
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
                {/* DANH SÁCH ALERT (NEW) */}
                <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertCircle size={20} /> Security Alerts ({alerts.length})
                    </h3>
                    <div style={tableContainerStyle}>
                        {alerts.map((alert, idx) => (
                            <div 
                                key={idx} 
                                onClick={() => setSelectedAlert(alert)}
                                style={alertCardStyle(selectedAlert?.alert_id === alert.alert_id)}
                            >
                                <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '4px', paddingRight: '40px' }}>{alert.attack_type}</div>
                                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                                    {alert.device_name} • {new Date(alert.timestamp).toLocaleTimeString()}
                                </div>
                                <span style={severityBadgeStyle(alert.severity_level)}>{alert.severity_level}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* CHI TIẾT ALERT ĐƯỢC CHỌN */}
                <div style={{ flex: 1.2, backgroundColor: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#374151' }}>Chi tiết Alert</h3>
                    {!selectedAlert ? (
                        <div style={emptyDetailStyle}>Nhấp vào một Alert để xử lý</div>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                            {/* Vùng cuộn chứa TẤT CẢ thông tin, bao gồm cả Raw Log */}
                            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
                                <div style={detailGridContainer}>
                                    {Object.entries(selectedAlert)
                                        .filter(([key]) => !['device_id_raw', 'alert_status'].includes(key))
                                        .map(([key, value]) => (
                                            <div key={key} style={key === 'raw_message_ref' ? rawItemFullWidth : detailItemStyle}>
                                                <label style={detailLabelStyle}>{key.replace(/_/g, ' ')}</label>
                                                {key === 'raw_message_ref' ? (
                                                    <div style={rawBoxInsideStyle}>{String(value)}</div>
                                                ) : (
                                                    <div style={detailValueStyle}>{String(value)}</div>
                                                )}
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>

                            {/* Nút xử lý */}
                            <button onClick={() => handleResolve(selectedAlert)} style={resolveBtnStyle}>
                                <ShieldCheck size={18} /> Xác nhận đã xử lý
                            </button>
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
    padding: '12px 75px 12px 12px',
    borderBottom: '1px solid #fee2e2', cursor: 'pointer', position: 'relative',
    backgroundColor: active ? '#fef2f2' : 'transparent', borderLeft: active ? '4px solid #dc2626' : '4px solid transparent'
});

const severityBadgeStyle = (level) => ({
    fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', position: 'absolute', right: '12px', top: '15px', fontWeight: 'bold',
    backgroundColor: level === 'HIGH' ? '#dc2626' : '#f59e0b', color: 'white'
});

const detailGridContainer = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' };
const detailItemStyle = { padding: '6px', borderBottom: '1px solid #f3f4f6' };
const detailLabelStyle = { fontSize: '0.7rem', fontWeight: 'bold', color: '#9ca3af', textTransform: 'uppercase' };
const detailValueStyle = { fontSize: '0.85rem', color: '#1f2937', marginTop: '2px', wordBreak: 'break-all' };

const rawItemFullWidth = { gridColumn: '1 / span 2', padding: '6px', borderBottom: '1px solid #f3f4f6' };
const rawBoxInsideStyle = {
    marginTop: '8px', padding: '12px', backgroundColor: '#0f172a', color: '#38bdf8',
    borderRadius: '6px', fontSize: '0.75rem', fontFamily: 'monospace',
    whiteSpace: 'pre-wrap', wordBreak: 'break-all', border: '1px solid #1e293b'
};

const resolveBtnStyle = {
    marginTop: '15px', width: '100%', padding: '12px', backgroundColor: '#059669',
    color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
};

const emptyDetailStyle = { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #e5e7eb', borderRadius: '6px', color: '#94a3b8' };

export default Realtime;