import { useApp } from '../contexts/AppContext';
import { Home, CalendarDays, Plus, Dumbbell, User } from 'lucide-react';

const TABS = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'activity', icon: CalendarDays, label: 'Activity' },
  { id: 'gym', icon: Dumbbell, label: 'Gym' },
  { id: 'settings', icon: User, label: 'Profile' },
];

export default function BottomNav() {
  const { currentTab, setCurrentTab } = useApp();

  return (
    <nav className="bottom-nav">
      {TABS.map(tab => {
        if (tab.center) {
          return (
            <button key={tab.id} className="nav-center-btn" onClick={() => setCurrentTab('home')}>
              <Plus size={24} color="#1A1A1A" strokeWidth={2.5} />
            </button>
          );
        }
        const Icon = tab.icon;
        const active = currentTab === tab.id;
        return (
          <button key={tab.id} className={`nav-item ${active ? 'active' : ''}`} onClick={() => setCurrentTab(tab.id)}>
            <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
