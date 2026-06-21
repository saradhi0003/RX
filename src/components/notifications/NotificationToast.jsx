import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

// Global notification state
let notificationId = 0;
const notificationListeners = new Set();

export const addNotification = (notification) => {
  const id = ++notificationId;
  const toast = { id, ...notification, timestamp: Date.now() };
  notificationListeners.forEach(listener => listener(toast));
  return id;
};

export const removeNotification = (id) => {
  notificationListeners.forEach(listener => listener({ id, remove: true }));
};

export default function NotificationToast() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const listener = (toast) => {
      if (toast.remove) {
        setNotifications(prev => prev.filter(n => n.id !== toast.id));
      } else {
        setNotifications(prev => [...prev, toast]);
        
        // Auto-remove after duration
        const duration = toast.duration || 5000;
        setTimeout(() => {
          removeNotification(toast.id);
        }, duration);
      }
    };

    notificationListeners.add(listener);
    return () => notificationListeners.delete(listener);
  }, []);

  const getIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5" />;
      case 'error': return <AlertCircle className="w-5 h-5" />;
      case 'warning': return <AlertTriangle className="w-5 h-5" />;
      default: return <Info className="w-5 h-5" />;
    }
  };

  const getColors = (type) => {
    switch (type) {
      case 'success': return 'bg-green-50 border-green-200 text-green-800';
      case 'error': return 'bg-red-50 border-red-200 text-red-800';
      case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default: return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2 max-w-md">
      <AnimatePresence>
        {notifications.map(notification => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 300, scale: 0.9 }}
            className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-sm ${getColors(notification.type)}`}
          >
            {getIcon(notification.type)}
            <div className="flex-1 min-w-0">
              {notification.title && (
                <p className="font-medium text-sm">{notification.title}</p>
              )}
              {notification.message && (
                <p className="text-sm opacity-90">{notification.message}</p>
              )}
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="text-current opacity-50 hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}