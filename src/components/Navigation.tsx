import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, BookOpen, Sparkles, Settings, LogOut } from 'lucide-react';
import { Dock, DockIcon, DockItem, DockLabel } from '@/components/ui/dock';
import { toast } from 'sonner';

const navItems = [
  { title: 'Home', icon: Home, href: '/' },
  { title: 'Info', icon: BookOpen, href: '/info' },
  { title: 'Features', icon: Sparkles, href: '/features' },
  { title: 'Settings', icon: Settings, href: '/settings' },
];

export default function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthenticated = typeof window !== 'undefined' && localStorage.getItem('isAuthenticated') === 'true';

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    toast.success('Logged out successfully!');
    navigate('/');
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <Dock className="items-end pb-3">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link key={item.href} to={item.href}>
              <DockItem
                className={`aspect-square rounded-full transition-colors ${
                  isActive
                    ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
                    : 'bg-gray-200 dark:bg-neutral-800 hover:bg-gray-300 dark:hover:bg-neutral-700'
                }`}
              >
                <DockLabel>{item.title}</DockLabel>
                <DockIcon>
                  <item.icon 
                    className={`h-full w-full ${
                      isActive 
                        ? 'text-white' 
                        : 'text-neutral-600 dark:text-neutral-300'
                    }`} 
                  />
                </DockIcon>
              </DockItem>
            </Link>
          );
        })}
        {isAuthenticated && (
          <button onClick={handleLogout}>
            <DockItem
              className="aspect-square rounded-full transition-colors bg-gradient-to-br from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700"
            >
              <DockLabel>Logout</DockLabel>
              <DockIcon>
                <LogOut className="h-full w-full text-white" />
              </DockIcon>
            </DockItem>
          </button>
        )}
      </Dock>
    </div>
  );
}
