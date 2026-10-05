import React, { createContext, useContext, useCallback, useState } from 'react';
import { CheckCircle2, XCircle, Info } from 'lucide-react';

const NotificationContext = createContext();

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within a NotificationProvider');
  return ctx;
};

let nextId = 1;

export const NotificationProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (type, title, message) => {
      const id = nextId++;
      setToasts((t) => [...t, { id, type, title, message }]);
      setTimeout(() => remove(id), 6000);
    },
    [remove]
  );

  const showSuccess = useCallback((title, message) => push('success', title, message), [push]);
  const showError = useCallback((title, message) => push('error', title, message), [push]);
  const showInfo = useCallback((title, message) => push('info', title, message), [push]);

  const icons = { success: CheckCircle2, error: XCircle, info: Info };
  const colors = { success: 'text-green-400 border-green-400/30', error: 'text-red-400 border-red-400/30', info: 'text-gold border-gold/30' };

  return (
    <NotificationContext.Provider value={{ showSuccess, showError, showInfo }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
        {toasts.map((t) => {
          const Icon = icons[t.type];
          return (
            <div key={t.id} className={`card border p-3 flex items-start gap-2 ${colors[t.type]}`}>
              <Icon size={18} className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="font-display font-semibold text-sm text-[var(--text)]">{t.title}</div>
                {t.message && <div className="text-xs text-[var(--text2)] break-words">{String(t.message)}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </NotificationContext.Provider>
  );
};
