'use client';

import { useCallback, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { NotificationService } from '@/lib/notification-service';
import { AdminNotification, NotificationType, NotificationPriority } from '@/lib/firebase-types';
import { useToast } from '@/components/ui/toast';
import {
  Bell,
  BellRing,
  X,
  Check,
  AlertTriangle,
  Info,
  AlertCircle,
  Users,
  MessageSquare,
  Activity,
  Settings,
  Filter,
  ExternalLink,
  Clock,
  MoreHorizontal
} from 'lucide-react';

interface NotificationCenterProps {
  className?: string;
}

export default function NotificationCenter({ className = '' }: NotificationCenterProps) {
  const { user, isAdmin } = useAuth();
  const { addToast } = useToast();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<NotificationType | 'all'>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const recentNotifications = await NotificationService.getRecentNotifications(50);
      setNotifications(recentNotifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
      addToast({
        title: 'Error',
        description: 'Failed to load notifications',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (isAdmin) {
      loadNotifications();
    }
  }, [isAdmin, loadNotifications]);

  const markAsRead = async (notificationId: string) => {
    if (!user?.uid) return;

    try {
      await NotificationService.markAsRead(notificationId, user.uid);
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, read: true, readAt: new Date() as any, readBy: user.uid }
            : n
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user?.uid) return;

    try {
      await NotificationService.markAllAsRead(user.uid);

      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true, readAt: new Date() as any, readBy: user.uid }))
      );

      addToast({
        title: 'Success',
        description: 'All notifications marked as read',
        variant: 'success'
      });
    } catch (error) {
      console.error('Error marking all as read:', error);
      addToast({
        title: 'Error',
        description: 'Failed to mark notifications as read',
        variant: 'destructive'
      });
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    if (filter !== 'all' && notification.type !== filter) return false;
    if (showUnreadOnly && notification.read) return false;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'user_activity': return Users;
      case 'feedback': return MessageSquare;
      case 'system_health': return AlertTriangle;
      case 'content_milestone': return Activity;
      case 'learning_activity': return Activity;
      case 'engagement': return Activity;
      case 'security': return AlertCircle;
      case 'error': return AlertCircle;
      default: return Info;
    }
  };

  const getPriorityColor = (priority: NotificationPriority) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800';
      case 'low': return 'text-green-600 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800';
      default: return 'text-gray-600 bg-gray-50 border-gray-200 dark:bg-gray-900/20 dark:border-gray-800';
    }
  };

  const formatTimeAgo = (timestamp: any) => {
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (!isAdmin) return null;

  return (
    <div className={`relative ${className}`}>
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
      >
        {unreadCount > 0 ? (
          <BellRing className="w-5 h-5" />
        ) : (
          <Bell className="w-5 h-5" />
        )}

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 w-96 max-w-[90vw] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xl z-50 max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                  Notifications
                </h3>
                {unreadCount > 0 && (
                  <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs px-2 py-1 rounded-full font-medium">
                    {unreadCount} new
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 p-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
              <Filter className="w-4 h-4 text-neutral-500" />

              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as NotificationType | 'all')}
                className="text-sm bg-transparent border-none focus:outline-none text-neutral-700 dark:text-neutral-300"
              >
                <option value="all">All Types</option>
                <option value="user_activity">User Activity</option>
                <option value="feedback">Feedback</option>
                <option value="system_health">System Health</option>
                <option value="content_milestone">Content</option>
                <option value="learning_activity">Learning</option>
                <option value="engagement">Engagement</option>
                <option value="security">Security</option>
                <option value="error">Errors</option>
              </select>

              <label className="flex items-center gap-1 text-sm text-neutral-600 dark:text-neutral-400 ml-auto">
                <input
                  type="checkbox"
                  checked={showUnreadOnly}
                  onChange={(e) => setShowUnreadOnly(e.target.checked)}
                  className="rounded"
                />
                Unread only
              </label>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <Bell className="w-8 h-8 text-neutral-300 mb-2" />
                  <p className="text-sm text-neutral-500">
                    {showUnreadOnly ? 'No unread notifications' : 'No notifications'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {filteredNotifications.map((notification) => {
                    const IconComponent = getNotificationIcon(notification.type);

                    return (
                      <div
                        key={notification.id}
                        className={`p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors ${
                          !notification.read ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Icon */}
                          <div className={`p-2 rounded-lg ${getPriorityColor(notification.priority)}`}>
                            <IconComponent className="w-4 h-4" />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                                {notification.title}
                              </h4>
                              <div className="flex items-center gap-2 ml-2">
                                {!notification.read && (
                                  <button
                                    onClick={() => notification.id && markAsRead(notification.id)}
                                    className="p-1 text-neutral-400 hover:text-green-600 transition-colors"
                                    title="Mark as read"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                )}
                                <span className="text-xs text-neutral-500 whitespace-nowrap">
                                  {formatTimeAgo(notification.createdAt)}
                                </span>
                              </div>
                            </div>

                            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1 line-clamp-2">
                              {notification.message}
                            </p>

                            {/* Priority Badge */}
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`text-xs px-2 py-1 rounded-full font-medium ${getPriorityColor(notification.priority)}`}>
                                {notification.priority}
                              </span>

                              <span className="text-xs text-neutral-500 capitalize">
                                {notification.type.replace('_', ' ')}
                              </span>

                              {notification.actionRequired && (
                                <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-1 rounded-full">
                                  Action Required
                                </span>
                              )}
                            </div>

                            {/* Actions */}
                            {notification.actions && notification.actions.length > 0 && (
                              <div className="flex items-center gap-2 mt-3">
                                {notification.actions.slice(0, 2).map((action, index) => (
                                  <a
                                    key={index}
                                    href={action.url}
                                    className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-1"
                                    onClick={() => setIsOpen(false)}
                                  >
                                    {action.label}
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">
                  {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    // Navigate to full notifications page
                    window.location.href = '/admin/notifications';
                  }}
                  className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  View all
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
