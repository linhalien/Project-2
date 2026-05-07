import React, { useState, useEffect } from 'react';
import { fetchApi } from '../utils/api';
import { Search as SearchIcon, X, Calendar, Info } from 'lucide-react';

const Search = () => {
    const [tableTarget, setTableTarget] = useState('SystemLogs');
    const [activeFilters, setActiveFilters] = useState({});
    const [timeOption, setTimeOption] = useState('1d'); // Mặc định 1 ngày
    const [customTime, setCustomTime] = useState({ start: '', end: '' });
    
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedLog, setSelectedLog] = useState(null);
    const [deviceList, setDeviceList] = useState([]); // Chứa danh sách thiết bị

    // Lấy danh sách thiết bị 
    useEffect(() => {
        const getDevices = async () => {
            try {
                const res = await fetchApi('/devices');
                if (res && res.status === 'success') {
                    setDeviceList(res.data);
                }
            } catch (error) {
                console.error("Lỗi fetch thiết bị:", error);
            }
        };
        getDevices();
    }, []);

    // Format cho các field
    const filterOptions = {
        SystemLogs: [
            { field: 'device_id', label: 'Device', hint: 'Chọn thiết bị' },
            { field: 'daemon_name', label: 'Daemon Name', hint: 'VD: sshd, sudo, systemd...' },
            { field: 'raw_message', label: 'Nội dung Log (Raw)', hint: 'Nhập từ khóa cần tìm trong log...' }
        ],
        FirewallLogs: [
            { field: 'device_id', label: 'Device', hint: 'Chọn thiết bị' },
            { field: 'src_ip', label: 'Source IP', hint: 'VD: 192.168.1.10' },
            { field: 'dst_ip', label: 'Dest IP', hint: 'VD: 8.8.8.8' },
            { field: 'action', label: 'Action', hint: 'ALLOW / BLOCK' }
        ],
        SecurityAlerts: [
            { field: 'device_id', label: 'Device', hint: 'Chọn thiết bị' },
            { field: 'attack_type', label: 'Attack Type', hint: 'VD: SSH Brute Force, Port Scan' },
            { field: 'severity_level', label: 'Severity Level', hint: 'LOW, MEDIUM, HIGH, CRITICAL' },
            { field: 'alert_status', label: 'Alert Status', hint: 'NEW / RESOLVED' },
            { field: 'raw_message', label: 'Nội dung Log (Raw)', hint: 'Nhập từ khóa cần tìm trong log...' }
        ]
    };

    // 
    const handleCheckboxChange = (field) => {
        const newFilters = { ...activeFilters };
        // Nếu là bỏ check -> xóa filter
        if (newFilters[field] !== undefined) {
            delete newFilters[field];
        } else {
            // Nếu field là device, lấy thiết bị đầu tiên làm mặc định
            newFilters[field] = field === 'device_id' && deviceList.length > 0 ? deviceList[0].device_id : ''; 
        }
        setActiveFilters(newFilters);
    };

    const handleSearch = async () => {
        setLoading(true);
        try {
            // Tính toán khoảng thời gian tìm kiếm
            let timeRange = null;
            const now = new Date();
            // Hàm chuyển đổi thời gian sang chuỗi ISO có timezone +07:00 (vì timestamp lưu trong DB là +07:00)
            const toVNTimeString = (date) => {
                const tzOffset = 7 * 60 * 60 * 1000;
                const localTime = new Date(date.getTime() + tzOffset);
                return localTime.toISOString().replace('.000Z', '+07:00');
            };

            if (timeOption !== 'all') {
                if (timeOption === 'custom') {
                    if (customTime.start && customTime.end) {
                        timeRange = {
                            start: toVNTimeString(new Date(customTime.start)),
                            end: toVNTimeString(new Date(customTime.end))
                        };
                    } else {
                        alert("Vui lòng chọn đầy đủ thời gian bắt đầu và kết thúc.");
                        setLoading(false);
                        return;
                    }
                } else {
                    const daysMap = { '1d': 1, '3d': 3, '7d': 7 };
                    const past = new Date(now.getTime() - (daysMap[timeOption] * 24 * 60 * 60 * 1000));
                    timeRange = {
                        start: toVNTimeString(past),
                        end: toVNTimeString(now)
                    };
                }
            }

            // Lọc bỏ filter rỗng
            const cleanFilters = Object.fromEntries(
                Object.entries(activeFilters).filter(([_, v]) => v.trim() !== '')
            );

            // Gọi API
            const res = await fetchApi('/search', {
                method: 'POST',
                body: JSON.stringify({
                    table_target: tableTarget,
                    filters: cleanFilters,
                    time_range: timeRange
                })
            });
            if (res && res.status === 'success') {
                setResults(res.data);
            } else {
                alert("Không lấy được dữ liệu từ Server.");
            }
        } catch (error) {
            console.error("Lỗi tra cứu:", error);
            alert("Lỗi kết nối");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
            
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                {/* CỘT 1: CHỌN NGUỒN LOG */}
                <div style={{ flex: 1, borderRight: '1px solid #e5e7eb', paddingRight: '20px' }}>
                    <h3 style={{ marginTop: 0 }}>Nguồn Log</h3>
                    {Object.keys(filterOptions).map(table => (
                        <label key={table} style={{ display: 'block', marginBottom: '10px', cursor: 'pointer' }}>
                            <input 
                                type="radio" 
                                name="table_target"
                                checked={tableTarget === table} 
                                onChange={() => {
                                    setTableTarget(table);
                                    setActiveFilters({});
                                    setResults([]);
                                }} 
                                style={{ marginRight: '8px' }}
                            />
                            {table === 'SystemLogs' ? 'Sys Log' : table === 'FirewallLogs' ? 'UFW Log' : 'Alerts'}
                        </label>
                    ))}

                    <h3 style={{ marginTop: '20px', borderTop: '1px solid #e5e7eb', paddingTop: '20px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Calendar size={18} /> Thời gian
                    </h3>
                    <select 
                        value={timeOption} 
                        onChange={(e) => setTimeOption(e.target.value)}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', marginBottom: '10px' }}
                    >
                        <option value="1d">24 giờ qua</option>
                        <option value="3d">3 ngày qua</option>
                        <option value="7d">7 ngày qua</option>
                        <option value="all">Tất cả (Không khuyến nghị)</option>
                        <option value="custom">Tùy chỉnh</option>
                    </select>

                    {timeOption === 'custom' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div>
                                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Từ:</div>
                                <input type="datetime-local" value={customTime.start} onChange={e => setCustomTime({...customTime, start: e.target.value})} style={{ width: '100%', padding: '6px', boxSizing: 'border-box' }}/>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Đến:</div>
                                <input type="datetime-local" value={customTime.end} onChange={e => setCustomTime({...customTime, end: e.target.value})} style={{ width: '100%', padding: '6px', boxSizing: 'border-box' }}/>
                            </div>
                        </div>
                    )}
                </div>

                {/* CỘT 2: THAM SỐ LỌC */}
                <div style={{ flex: 2 }}>
                    <h3 style={{ marginTop: 0 }}>Tùy chọn tham số lọc</h3>
                    {/* HƯỚNG DẪN NHẬP LIỆU */}
                    <div style={{ backgroundColor: '#eff6ff', padding: '15px', borderRadius: '6px', marginBottom: '20px', border: '1px solid #bfdbfe' }}>
                        <h4 style={{ margin: '0 0 8px 0', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Info size={18} /> Lưu ý khi nhập từ khóa
                        </h4>
                        <ul style={{ margin: 0, paddingLeft: '20px', color: '#1e40af', fontSize: '0.85rem', lineHeight: '1.6' }}>
                            <li><b>Tìm kiếm tương đối:</b> Chỉ cần nhập một phần của từ khóa. Ví dụ: nhập <i>"scan"</i> sẽ bao gồm kết quả có <i>"Port Scan"</i>.</li>
                            <li><b>Không phân biệt hoa/thường:</b> Hệ thống tự động nhận diện. Ví dụ: <i>"ALLOW"</i> hay <i>"allow"</i> đều hợp lệ.</li>
                            <li><b>Kết hợp:</b> Khi tích chọn nhiều ô, hệ thống sẽ lọc các bản ghi thỏa mãn <b>tất cả</b> các điều kiện cùng lúc (AND).</li>
                            <li><b>Thời gian:</b> Nếu chọn "Tùy chỉnh", bắt buộc phải chọn đầy đủ cả thời điểm Từ và Đến.</li>
                        </ul>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        {filterOptions[tableTarget].map(opt => (
                            <div key={opt.field} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 'bold', color: '#374151' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={activeFilters[opt.field] !== undefined}
                                        onChange={() => handleCheckboxChange(opt.field)}
                                        style={{ marginRight: '8px' }}
                                    />
                                    {opt.label}
                                </label>
                                
                                {activeFilters[opt.field] !== undefined && (
                                    <>
                                        {opt.field === 'device_id' ? (
                                            <select
                                                value={activeFilters[opt.field]}
                                                onChange={(e) => setActiveFilters(prev => ({ ...prev, [opt.field]: e.target.value }))}
                                                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #3b82f6', outline: 'none' }}
                                            >
                                                {deviceList.map(dev => (
                                                    <option key={dev.device_id} value={dev.device_id}>{dev.device_name}</option>
                                                ))}
                                            </select>
                                        ) : opt.field === 'severity_level' ? (
                                            <select
                                                value={activeFilters[opt.field]}
                                                onChange={(e) => setActiveFilters(prev => ({ ...prev, [opt.field]: e.target.value }))}
                                                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #3b82f6', outline: 'none', width: '100%' }}
                                            >
                                                <option value="">-- Chọn mức độ --</option>
                                                <option value="LOW">LOW</option>
                                                <option value="MEDIUM">MEDIUM</option>
                                                <option value="HIGH">HIGH</option>
                                                <option value="CRITICAL">CRITICAL</option>
                                            </select>
                                        ) : opt.field === 'action' ? (
                                            <select
                                                value={activeFilters[opt.field]}
                                                onChange={(e) => setActiveFilters(prev => ({ ...prev, [opt.field]: e.target.value }))}
                                                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #3b82f6', outline: 'none', width: '100%' }}
                                            >
                                                <option value="">-- Chọn hành động --</option>
                                                <option value="ALLOW">ALLOW</option>
                                                <option value="BLOCK">BLOCK</option>
                                            </select>
                                        ) : opt.field === 'alert_status' ? (
                                            <select
                                                value={activeFilters[opt.field]}
                                                onChange={(e) => setActiveFilters(prev => ({ ...prev, [opt.field]: e.target.value }))}
                                                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #3b82f6', outline: 'none', width: '100%' }}
                                            >
                                                <option value="">-- Chọn trạng thái alert --</option>
                                                <option value="NEW">NEW</option>
                                                <option value="RESOLVED">RESOLVED</option>
                                            </select>
                                        ) : (
                                            <div style={{ position: 'relative' }}>
                                                <input 
                                                    type="text" 
                                                    value={activeFilters[opt.field]}
                                                    onChange={(e) => setActiveFilters(prev => ({ ...prev, [opt.field]: e.target.value }))}
                                                    placeholder={opt.hint}
                                                    style={{ width: '100%', padding: '8px 8px 8px 30px', borderRadius: '4px', border: '1px solid #3b82f6', boxSizing: 'border-box', outline: 'none' }}
                                                />
                                                <Info size={16} color="#9ca3af" style={{ position: 'absolute', left: '8px', top: '10px' }} />
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                    <button 
                        onClick={handleSearch} 
                        disabled={loading}
                        style={{ marginTop: '30px', padding: '12px 30px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '1rem' }}
                    >
                        <SearchIcon size={20} /> {loading ? 'Đang tìm...' : 'Tra cứu dữ liệu'}
                    </button>
                </div>
            </div>

            {/* BẢNG KẾT QUẢ */}
            <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '8px', padding: '20px', overflowY: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ marginTop: 0 }}>Kết quả ({results.length})</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f9fafb', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
                            <th style={{ padding: '12px' }}>Timestamp</th>
                            <th style={{ padding: '12px' }}>Tên thiết bị</th>
                            <th style={{ padding: '12px' }}>Chi tiết</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.map((item, idx) => {
                            // Map ID sang Name cho dễ nhìn trong bảng kết quả
                            const deviceObj = deviceList.find(d => d.device_id === item.device_id);
                            const displayDevice = deviceObj ? deviceObj.device_name : item.device_id;
                            
                            return (
                                <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '12px' }}>{new Date(item.timestamp).toLocaleString()}</td>
                                    <td style={{ padding: '12px', fontWeight: '500' }}>{displayDevice}</td>
                                    <td style={{ padding: '12px' }}>
                                        <button 
                                            onClick={() => setSelectedLog(item)}
                                            style={{ padding: '6px 12px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                            Xem chi tiết
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                        {results.length === 0 && !loading && (
                            <tr><td colSpan="3" style={{ padding: '30px', textAlign: 'center', color: '#6b7280' }}>Không có dữ liệu phù hợp với bộ lọc</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* POPUP CHI TIẾT */}
            {selectedLog && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ backgroundColor: 'white', width: '650px', maxHeight: '85vh', borderRadius: '8px', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
                        <div style={{ padding: '15px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: '8px 8px 0 0' }}>
                            <h3 style={{ margin: 0 }}>Chi tiết Bản ghi</h3>
                            <button onClick={() => setSelectedLog(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={24} /></button>
                        </div>
                        <div style={{ padding: '20px', overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
                            {Object.entries(selectedLog).map(([key, value]) => (
                                <div key={key} style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: '10px' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '6px' }}>{key}</div>
                                    <div style={{ 
                                        fontSize: '0.9rem', color: '#1f2937',
                                        whiteSpace: key === 'raw_message' ? 'pre-wrap' : 'normal',
                                        wordBreak: 'break-word',
                                        backgroundColor: key === 'raw_message' ? '#0f172a' : 'transparent',
                                        color: key === 'raw_message' ? '#38bdf8' : 'inherit',
                                        padding: key === 'raw_message' ? '12px' : '0',
                                        borderRadius: '6px',
                                        fontFamily: key === 'raw_message' ? 'monospace' : 'inherit',
                                        border: key === 'raw_message' ? '1px solid #1e293b' : 'none'
                                    }}>
                                        {String(value)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Search;      