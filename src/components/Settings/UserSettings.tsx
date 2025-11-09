import React, { useState } from 'react';
import { User, Lock, Bell, Globe, Save, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function UserSettings() {
  const { userData } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const [profileData, setProfileData] = useState({
    name: userData?.name || '',
    email: userData?.email || '',
    department: userData?.department || '',
    role: userData?.role || ''
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    requestUpdates: true,
    invoiceReminders: true,
    systemAlerts: false
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      console.log('Saving profile:', profileData);
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotifications = async () => {
    setLoading(true);
    try {
      console.log('Saving notifications:', notificationSettings);
      alert('Notification settings updated successfully!');
    } catch (error) {
      console.error('Error updating notifications:', error);
      alert('Failed to update notification settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('New passwords do not match!');
      return;
    }

    setLoading(true);
    try {
      console.log('Changing password');
      alert('Password changed successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Error changing password:', error);
      alert('Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = () => {
    setIsUpdating(true);
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }
    window.location.reload();
  };

  const tabs = [
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'security', name: 'Security', icon: Lock },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'preferences', name: 'Preferences', icon: Globe },
    { id: 'update', name: 'Update', icon: RefreshCw }
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your account settings and preferences</p>
      </div>

      <div className="flex flex-col md:flex-row md:space-x-6">
        <div className="w-full md:w-1/4 mb-6 md:mb-0">
          <nav className="flex flex-col space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-4 rounded-lg font-medium text-sm flex items-center gap-3 transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        <div className="w-full md:w-3/4 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-gray-900">Profile Information</h3>
              <div className="grid grid-cols-1 gap-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input type="text" value={profileData.name} onChange={(e) => setProfileData({ ...profileData, name: e.target.value })} className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input type="email" value={profileData.email} readOnly className="w-full bg-gray-100 border-gray-300 rounded-lg shadow-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <input type="text" value={profileData.department} readOnly className="w-full bg-gray-100 border-gray-300 rounded-lg shadow-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <input type="text" value={profileData.role} readOnly className="w-full bg-gray-100 border-gray-300 rounded-lg shadow-sm" />
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={handleSaveProfile} disabled={loading} className="w-full md:w-auto bg-blue-600 text-white py-2 px-4 rounded-lg shadow-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" />
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-gray-900">Change Password</h3>
              <div className="max-w-lg mx-auto space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                  <input type="password" value={passwordData.currentPassword} onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })} className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <input type="password" value={passwordData.newPassword} onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })} className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                  <input type="password" value={passwordData.confirmPassword} onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={handleChangePassword} disabled={loading} className="w-full md:w-auto bg-blue-600 text-white py-2 px-4 rounded-lg shadow-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  <Lock className="w-4 h-4" />
                  {loading ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-gray-900">Notification Preferences</h3>
              <div className="space-y-4">
                {[ { title: 'Email Notifications', description: 'Receive notifications via email', key: 'emailNotifications' }, { title: 'Request Updates', description: 'Get notified about request status changes', key: 'requestUpdates' }, { title: 'Invoice Reminders', description: 'Reminders for pending invoices', key: 'invoiceReminders' }, { title: 'System Alerts', description: 'Important system notifications', key: 'systemAlerts' }, ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{item.title}</p>
                      <p className="text-sm text-gray-500">{item.description}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={notificationSettings[item.key]} onChange={(e) => setNotificationSettings({ ...notificationSettings, [item.key]: e.target.checked })} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                 <button onClick={handleSaveNotifications} disabled={loading} className="w-full md:w-auto bg-blue-600 text-white py-2 px-4 rounded-lg shadow-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" />
                  {loading ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-gray-900">Application Preferences</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                  <select className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500">
                    <option value="en">English</option>
                    <option value="si">Sinhala</option>
                    <option value="ta">Tamil</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time Zone</label>
                  <select className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500">
                    <option value="Asia/Colombo">Asia/Colombo (GMT+5:30)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date Format</label>
                  <select className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500">
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency Display</label>
                  <select className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500">
                    <option value="LKR">LKR (Sri Lankan Rupee)</option>
                    <option value="USD">USD (US Dollar)</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end">
                <button disabled={loading} className="w-full md:w-auto bg-blue-600 text-white py-2 px-4 rounded-lg shadow-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" />
                  {loading ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'update' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-gray-900">Application Update</h3>
              <p className="text-gray-600">Click the button below to clear the application cache and refresh to the latest version.</p>
              <div className="flex justify-start">
                <button onClick={handleUpdate} disabled={isUpdating} className="w-full md:w-auto bg-green-600 text-white py-2 px-4 rounded-lg shadow-sm hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
                  {isUpdating ? 'Updating...' : 'Update Now'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
