import { NavLink, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard, PackageSearch, Store,
  ChefHat, ShoppingCart, ClipboardList,
  Calculator, Settings, X
} from 'lucide-react';

const Sidebar = ({ isMobileOpen, closeMobileSidebar }) => {
  const location = useLocation();
  
  // Get user data from localStorage
  const user = JSON.parse(localStorage.getItem('admin') || '{}');

  const isActive = (path) => location.pathname === path;

  const navItems = [
    
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    // { name: 'Orders', path: '/orders', icon: <ClipboardList className="h-5 w-5" /> },
    { name: 'Inventory', path: '/inventory', icon: <PackageSearch className="h-5 w-5" /> },
    { name: 'Products', path: '/products', icon: <PackageSearch className="h-5 w-5" /> },
    { name: 'Suppliers', path: '/suppliers', icon: <Store className="h-5 w-5" /> },
    { name: 'Caterers', path: '/caterers', icon: <ChefHat className="h-5 w-5" /> },
    { name: 'Customers', path: '/Customers', icon: <ChefHat className="h-5 w-5" /> },
    // { name: 'Caterer Orders', path: '/caterer-orders', icon: <ClipboardList className="h-5 w-5" /> },
  ];

  const financialItems = [
    { name: 'Financial Tracker', path: '/financial-tracker', icon: <Calculator className="h-5 w-5" /> },
  ];

  const managementItems = [
    { name: 'Settings', path: '/settings', icon: <Settings className="h-5 w-5" /> },
  ];

  const handleNavClick = () => {
    if (window.innerWidth < 1024) {
      closeMobileSidebar();
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 modal-backdrop z-20 lg:hidden"
          onClick={closeMobileSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          text-white overflow-y-auto transition-all duration-300 ease-in-out
          w-64 xl:w-72 flex-shrink-0
          ${isMobileOpen ? 'fixed inset-y-0 left-0 z-30' : 'hidden lg:flex'}
          lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0
          h-screen
        `}
        style={{ backgroundColor: 'rgba(89,63,54,1)' }}
      >
        <div className="flex flex-col h-screen">
          {/* Header */}
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-amber-800/20 flex-shrink-0">
            <div className="flex items-center space-x-2 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-amber-600 rounded-md flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-xs sm:text-sm">🌶️</span>
              </div>
              <h1 className="text-base sm:text-lg font-semibold text-white truncate">RoyalSpicyMasala</h1>
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={closeMobileSidebar}
              className="text-white lg:hidden hover:bg-amber-700 flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-md flex items-center justify-center transition-colors"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="sr-only">Close menu</span>
            </button>
          </div>

          {/* Navigation Content */}
          <div className="flex-1 px-3 sm:px-4 py-4 sm:py-6 overflow-y-auto">
            <nav className="space-y-4 sm:space-y-6">
              {/* Main Navigation */}
              <div>
                <p className="text-xs font-medium text-white uppercase tracking-wider mb-2 sm:mb-3 px-2">
                  Main
                </p>
                <div className="space-y-0.5 sm:space-y-1">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={handleNavClick}
                      className={({ isActive }) => `
                        flex items-center px-2 sm:px-3 py-2 sm:py-2.5 text-sm rounded-lg transition-all duration-200 w-full group
                        hover:scale-[1.02] active:scale-[0.98]
                        ${isActive
                          ? 'bg-amber-600 text-white font-medium shadow-sm'
                          : 'text-white hover:bg-amber-700 hover:text-white'
                        }
                      `}
                    >
                      <span className="flex items-center min-w-0 w-full">
                        <span className="flex-shrink-0">
                          {item.icon}
                        </span>
                        <span className="ml-2 sm:ml-3 truncate">{item.name}</span>
                      </span>
                    </NavLink>
                  ))}
                </div>
              </div>

              {/* Financial Management */}
              <div>
                <p className="text-xs font-medium text-white uppercase tracking-wider mb-2 sm:mb-3 px-2">
                  Financial Management
                </p>
                <div className="space-y-0.5 sm:space-y-1">
                  {financialItems.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={handleNavClick}
                      className={({ isActive }) => `
                        flex items-center px-2 sm:px-3 py-2 sm:py-2.5 text-sm rounded-lg transition-all duration-200 w-full group
                        hover:scale-[1.02] active:scale-[0.98]
                        ${isActive
                          ? 'bg-amber-600 text-white font-medium shadow-sm'
                          : 'text-white hover:bg-amber-700 hover:text-white'
                        }
                      `}
                    >
                      <span className="flex items-center min-w-0 w-full">
                        <span className="flex-shrink-0">
                          {item.icon}
                        </span>
                        <span className="ml-2 sm:ml-3 truncate">{item.name}</span>
                      </span>
                    </NavLink>
                  ))}
                </div>
              </div>

              {/* Management (Admin Only) */}
              {user?.role === 'super_admin' && (
                <div>
                  <p className="text-xs font-medium text-white uppercase tracking-wider mb-2 sm:mb-3 px-2">
                    Management
                  </p>
                  <div className="space-y-0.5 sm:space-y-1">
                    {managementItems.map((item) => (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={handleNavClick}
                        className={({ isActive }) => `
                          flex items-center px-2 sm:px-3 py-2 sm:py-2.5 text-sm rounded-lg transition-all duration-200 w-full group
                          hover:scale-[1.02] active:scale-[0.98]
                          ${isActive
                            ? 'bg-amber-600 text-white font-medium shadow-sm'
                            : 'text-white hover:bg-amber-700 hover:text-white'
                          }
                        `}
                      >
                        <span className="flex items-center min-w-0 w-full">
                          <span className="flex-shrink-0">
                            {item.icon}
                          </span>
                          <span className="ml-2 sm:ml-3 truncate">{item.name}</span>
                        </span>
                      </NavLink>
                    ))}
                  </div>
                </div>
              )}
            </nav>
          </div>

          {/* Footer */}
          <div className="p-3 sm:p-4 border-t border-amber-800/20 flex-shrink-0">
            <div className="bg-amber-700 rounded-lg p-2 sm:p-3">
              <p className="text-xs font-medium text-amber-200 uppercase tracking-wider mb-1">
                Application Version
              </p>
              <p className="text-xs sm:text-sm text-white font-medium">v2.0.0</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
