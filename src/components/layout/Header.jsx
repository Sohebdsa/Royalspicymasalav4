import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, LogOut, Settings, User as UserIcon, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Header = ({ toggleSidebar }) => {
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { logout } = useAuth();

  // Get user data from auth context
  const user = JSON.parse(localStorage.getItem('admin') || '{}');

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Fallback to basic logout if API call fails
      localStorage.removeItem('adminToken');
      localStorage.removeItem('admin');
      navigate('/login');
    }
  };

  const getInitials = (name) => {
    if (!name) return 'A';
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <header className="text-white shadow-sm border-b border-amber-800/20 z-40 sticky top-0" style={{ backgroundColor: 'rgba(89,63,54,1)' }}>
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center min-w-0">
            <button
              onClick={toggleSidebar}
              className="lg:hidden mr-3 text-white hover:bg-amber-700 focus:outline-none w-10 h-10 flex-shrink-0 rounded-md flex items-center justify-center transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center min-w-0 lg:hidden">
              <span className="text-amber-200 mr-2 text-base flex-shrink-0">✦</span>
              <h1 className="font-semibold text-xl text-white truncate">RoyalSpicyMasala</h1>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-white hover:bg-amber-700 rounded-md transition-colors relative"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  3
                </span>
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <div className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer">
                      <p className="text-sm font-medium text-gray-900">Low Stock Alert</p>
                      <p className="text-xs text-gray-600">Red Chili Powder is running low</p>
                      <p className="text-xs text-gray-400 mt-1">2 hours ago</p>
                    </div>
                    <div className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer">
                      <p className="text-sm font-medium text-gray-900">New Order</p>
                      <p className="text-xs text-gray-600">Order #1234 received</p>
                      <p className="text-xs text-gray-400 mt-1">4 hours ago</p>
                    </div>
                    <div className="p-3 hover:bg-gray-50 cursor-pointer">
                      <p className="text-sm font-medium text-gray-900">Payment Received</p>
                      <p className="text-xs text-gray-600">₹5,000 payment confirmed</p>
                      <p className="text-xs text-gray-400 mt-1">1 day ago</p>
                    </div>
                  </div>
                  <div className="p-3 border-t border-gray-200">
                    <button className="text-sm text-orange-600 hover:text-orange-700 font-medium">
                      View all notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center focus:outline-none hover:bg-amber-700 rounded-md p-1 transition-colors"
              >
                <div className="h-8 w-8 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  {getInitials(user.full_name)}
                </div>
                <span className="ml-2 font-medium transition-all duration-100 hidden sm:block text-white">
                  {user.full_name || 'Admin'}
                </span>
              </button>

              {/* User Dropdown */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="p-3 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-900">{user.full_name || 'Admin'}</p>
                    <p className="text-xs text-gray-600">{user.email || 'admin@royalspicymasala.com'}</p>
                    <p className="text-xs text-orange-600 font-medium mt-1">{user.role || 'Super Admin'}</p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        navigate('/profile');
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <UserIcon className="mr-2 h-4 w-4" />
                      Profile
                    </button>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        navigate('/settings');
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </button>
                  </div>
                  <div className="border-t border-gray-200 py-1">
                    <button
                      onClick={handleLogout}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Click outside to close dropdowns */}
      {(showUserMenu || showNotifications) && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => {
            setShowUserMenu(false);
            setShowNotifications(false);
          }}
        />
      )}
    </header>
  );
};

export default Header;
