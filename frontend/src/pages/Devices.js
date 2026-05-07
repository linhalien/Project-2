import React, { useState, useEffect } from 'react';
import { fetchApi } from '../utils/api';
import { Settings, Plus, Trash2, Edit2 } from 'lucide-react';

const Devices = () => {
    const [devices, setDevices] = useState([]);
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'add' | 'edit'
    const [formData, setFormData] = useState({ device_name: '', status: 'ACTIVE' });
    const [selectedDevice, setSelectedDevice] = useState(null);
    
    // State đảm bảo sau 10s mới được xóa
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [countdown, setCountdown] = useState(10);

    // Fetch danh sách thiết bị
    const fetchDeviceList = async () => {
        try {
            const res = await fetchApi('/devices'); // Giả định bạn sẽ tạo endpoint này
            if (res && res.data) setDevices(res.data);
        } catch (error) {
            console.error("Lỗi lấy danh sách thiết bị", error);
        }
    };

    useEffect(() => {
        fetchDeviceList();
    }, []);

    // Đếm ngược 10s khi bật Popup Xóa
    useEffect(() => {
        let timer;
        if (showDeleteModal && countdown > 0) {
            timer = setInterval(() => {
                setCountdown((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [showDeleteModal, countdown]);

    // Luồng thêm mới
    const handleAddSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await fetchApi('/devices', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            if (res && res.status === 'success') {
                alert(`Thêm thành công. \nDevice ID: ${res.data.device_id} \nSecret Token: ${res.data.device_secret} `);
                setViewMode('list');
                fetchDeviceList();
            }
        } catch (error) {
            alert("Lỗi khi thêm thiết bị");
        }
    };

    // Luồng cập nhật
    const handleEditSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await fetchApi('/devices', {
                method: 'PUT',
                body: JSON.stringify({
                    device_id: selectedDevice.device_id, // ID để xác định thiết bị cần cập nhật
                    device_name: formData.device_name,
                    status: formData.status
                })
            });
            if (res && res.status === 'success') {
                alert("Cập nhật thành công!");
                setViewMode('list');
                fetchDeviceList();
            }
        } catch (error) {
            alert("Lỗi khi cập nhật");
        }
    };

    // Luồng gọi API xóa (Chỉ được gọi khi countdown = 0)
    const executeDelete = async () => {
        try {
            const res = await fetchApi(`/devices?device_id=${selectedDevice.device_id}`, {
                method: 'DELETE'
            });
            if (res && res.status === 'success') {
                alert("Đã xóa thiết bị thành công!");
                setShowDeleteModal(false);
                setViewMode('list');
                fetchDeviceList();
            }
        } catch (error) {
            alert("Lỗi khi xóa thiết bị");
        }
    };

    const triggerDeleteProcess = () => {
        setCountdown(10);
        setShowDeleteModal(true);
    };

    return (
        <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            
            {/* Menu con */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button 
                    onClick={() => { setViewMode('list'); fetchDeviceList(); }}
                    style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: viewMode === 'list' ? '#e5e7eb' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <Settings size={18} /> Danh sách thiết bị
                </button>
                <button 
                    onClick={() => { setFormData({ device_name: '', status: 'ACTIVE' }); setViewMode('add'); }}
                    style={{ padding: '10px 20px', borderRadius: '6px', border: 'none', backgroundColor: '#10b981', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <Plus size={18} /> Thêm thiết bị
                </button>
            </div>

            {/* View: Danh sách */}
            {viewMode === 'list' && (
                <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ borderBottom: '2px solid #e5e7eb' }}>
                            <tr>
                                <th style={{ padding: '12px' }}>Tên thiết bị</th>
                                <th style={{ padding: '12px' }}>Device ID</th>
                                <th style={{ padding: '12px' }}>Trạng thái</th>
                                <th style={{ padding: '12px' }}>Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {devices.map((dev) => (
                                <tr key={dev.device_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{dev.device_name}</td>
                                    <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '0.85rem' }}>{dev.device_id}</td>
                                    <td style={{ padding: '12px' }}>
                                        <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', backgroundColor: dev.status === 'ACTIVE' ? '#d1fae5' : '#fecaca', color: dev.status === 'ACTIVE' ? '#065f46' : '#991b1b' }}>
                                            {dev.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        <button 
                                            onClick={() => {
                                                setSelectedDevice(dev);
                                                setFormData({ device_name: dev.device_name, status: dev.status });
                                                setViewMode('edit');
                                            }}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6' }}
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* View: Form Thêm / Sửa */}
            {(viewMode === 'add' || viewMode === 'edit') && (
                <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '30px', maxWidth: '600px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h2 style={{ marginTop: 0, marginBottom: '20px' }}>{viewMode === 'add' ? 'Thêm Thiết Bị Mới' : 'Thay Đổi Thông Tin Thiết Bị'}</h2>
                    
                    <form onSubmit={viewMode === 'add' ? handleAddSubmit : handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        
                        {/* Khóa cứng hiển thị ID/Secret khi chọn Edit */}
                        {viewMode === 'edit' && (
                            <>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#4b5563' }}>Device ID (Locked)</label>
                                    <input type="text" value={selectedDevice?.device_id} disabled style={{ width: '100%', padding: '10px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#4b5563' }}>Secret Token (Locked)</label>
                                    <input type="password" value="********" disabled style={{ width: '100%', padding: '10px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }} />
                                </div>
                            </>
                        )}

                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Tên thiết bị</label>
                            <input 
                                type="text" 
                                required
                                value={formData.device_name}
                                onChange={(e) => setFormData({...formData, device_name: e.target.value})}
                                style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Trạng thái</label>
                            <select 
                                value={formData.status}
                                onChange={(e) => setFormData({...formData, status: e.target.value})}
                                style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
                            >
                                <option value="ACTIVE">ACTIVE (Hoạt động)</option>
                                <option value="INACTIVE">INACTIVE (Tạm ngưng)</option>
                            </select>
                        </div>

                        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
                            <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                                Xác nhận
                            </button>

                            {viewMode === 'edit' && (
                                <button type="button" onClick={triggerDeleteProcess} style={{ padding: '10px 20px', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Trash2 size={18} /> Xóa thiết bị
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            )}

            {/* Popup Xóa Đặc Biệt (Bộ đếm 10s) */}
            {showDeleteModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', width: '350px', textAlign: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
                        <AlertTriangle size={48} color="#ef4444" style={{ marginBottom: '15px' }} />
                        <h3 style={{ margin: '0 0 10px 0', color: '#1f2937' }}>CẢNH BÁO NGUY HIỂM</h3>
                        <p style={{ fontSize: '0.9rem', color: '#4b5563', marginBottom: '20px', lineHeight: '1.5' }}>
                            Việc xóa thiết bị <b>{selectedDevice?.device_name}</b> là không thể hoàn tác. Toàn bộ rule và agent key sẽ bị vô hiệu hóa.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {/* Nút Xác nhận bị khóa cho đến khi countdown = 0 */}
                            <button 
                                onClick={executeDelete} 
                                disabled={countdown > 0}
                                style={{ 
                                    padding: '12px', borderRadius: '6px', border: 'none', fontWeight: 'bold',
                                    backgroundColor: countdown > 0 ? '#f3f4f6' : '#ef4444', 
                                    color: countdown > 0 ? '#9ca3af' : 'white',
                                    cursor: countdown > 0 ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.3s'
                                }}
                            >
                                {countdown > 0 ? `Xác nhận xóa (${countdown}s)` : 'Xác nhận xóa ngay'}
                            </button>
                            
                            {/* Nút Hủy luôn bấm được */}
                            <button 
                                onClick={() => setShowDeleteModal(false)} 
                                style={{ padding: '12px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: 'white', cursor: 'pointer' }}
                            >
                                Hủy thao tác
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

// Import thiếu icon phía trên
import { AlertTriangle } from 'lucide-react';

export default Devices;