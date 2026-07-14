import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutGrid, Globe, Building2, Copyright, Landmark, Users, FileText,
} from 'lucide-react';

const NAV = [
  { to: '/', label: 'Portfolio', icon: LayoutGrid, end: true },
  { to: '/domains', label: 'Domains', icon: Globe },
  { to: '/entities', label: 'Entities', icon: Building2 },
  { to: '/ip', label: 'IP Assets', icon: Copyright },
  { to: '/licenses', label: 'Licenses', icon: Landmark },
  { to: '/community', label: 'Community', icon: Users },
  { to: '/notes', label: '$DPNOTE', icon: FileText },
];

export default function Sidebar() {
  return (
    <nav className="w-56 shrink-0 border-r px-3 py-6 hidden md:block" style={{ borderColor: 'var(--border)' }}>
      <div className="space-y-1">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                isActive ? 'text-black' : 'text-[var(--text2)] hover:text-[var(--text)]'
              }`
            }
            style={({ isActive }) => (isActive ? { background: 'var(--gold)' } : {})}
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
