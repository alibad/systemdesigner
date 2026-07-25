'use client';

import { useCallback, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { NotificationService } from '@/lib/notification-service';
import { AdminNotification, NotificationType, NotificationPriority } from '@/lib/firebase-types';
import { useToast } from '@/components/ui/toast';
import AdminNav from '@/components/admin/AdminNav';
import {
  Bell,
  Filter,
  Search,
  Check,
  CheckCheck,
  AlertTriangle,
  Info,
  AlertCircle,
  Users,
  MessageSquare,
  Activity,
  ExternalLink,
  Calendar,
  Clock,
  MoreHorizontal,
  Mail,
  Loader2,
  RefreshCw,
  ChevronLeft,
  Trash2,
  X
} from 'lucide-react';

export default function AdminNotificationsPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { addToast } = useToast();

  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<NotificationType | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<NotificationPriority | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'read' | 'unread'>('all');
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const recentNotifications = await NotificationService.getRecentNotifications(100);
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
    if (!authLoading) {
      if (!user || !isAdmin) {
        router.push('/admin');
      } else {
        loadNotifications();
      }
    }
  }, [user, isAdmin, authLoading, router, loadNotifications]);

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

  const markSelectedAsRead = async () => {
    if (!user?.uid || selectedNotifications.length === 0) return;

    try {
      await NotificationService.markMultipleAsRead(selectedNotifications, user.uid);

      setNotifications(prev =>
        prev.map(n =>
          selectedNotifications.includes(n.id || '')
            ? { ...n, read: true, readAt: new Date() as any, readBy: user.uid }
            : n
        )
      );

      setSelectedNotifications([]);
      addToast({
        title: 'Success',
        description: `${selectedNotifications.length} notifications marked as read`,
        variant: 'success'
      });
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      addToast({
        title: 'Error',
        description: 'Failed to mark notifications as read',
        variant: 'destructive'
      });
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

  const deleteNotification = async (notificationId: string) => {
    try {
      await NotificationService.deleteNotification(notificationId);

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setSelectedNotifications(prev => prev.filter(id => id !== notificationId));

      addToast({
        title: 'Success',
        description: 'Notification deleted',
        variant: 'success'
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      addToast({
        title: 'Error',
        description: 'Failed to delete notification',
        variant: 'destructive'
      });
    }
  };

  const deleteSelectedNotifications = async () => {
    if (selectedNotifications.length === 0) return;

    try {
      // Delete notifications one by one (could be optimized with batch operations)
      for (const notificationId of selectedNotifications) {
        await NotificationService.deleteNotification(notificationId);
      }

      setNotifications(prev => prev.filter(n => !selectedNotifications.includes(n.id || '')));
      setSelectedNotifications([]);

      addToast({
        title: 'Success',
        description: `${selectedNotifications.length} notifications deleted`,
        variant: 'success'
      });
    } catch (error) {
      console.error('Error deleting notifications:', error);
      addToast({
        title: 'Error',
        description: 'Failed to delete notifications',
        variant: 'destructive'
      });
    }
  };

  const deleteAllNotifications = async () => {
    if (!confirm('Are you sure you want to delete ALL notifications? This action cannot be undone.')) {
      return;
    }

    try {
      await NotificationService.deleteAllNotifications();

      setNotifications([]);
      setSelectedNotifications([]);

      addToast({
        title: 'Success',
        description: 'All notifications deleted',
        variant: 'success'
      });
    } catch (error) {
      console.error('Error deleting all notifications:', error);
      addToast({
        title: 'Error',
        description: 'Failed to delete all notifications',
        variant: 'destructive'
      });
    }
  };

  const toggleNotificationSelection = (notificationId: string) => {
    setSelectedNotifications(prev =>
      prev.includes(notificationId)
        ? prev.filter(id => id !== notificationId)
        : [...prev, notificationId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedNotifications.length === filteredNotifications.length) {
      setSelectedNotifications([]);
    } else {
      setSelectedNotifications(filteredNotifications.map(n => n.id || '').filter(Boolean));
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !notification.title.toLowerCase().includes(query) &&
        !notification.message.toLowerCase().includes(query) &&
        !notification.type.toLowerCase().includes(query)
      ) {
        return false;
      }
    }

    // Type filter
    if (typeFilter !== 'all' && notification.type !== typeFilter) return false;

    // Priority filter
    if (priorityFilter !== 'all' && notification.priority !== priorityFilter) return false;

    // Status filter
    if (statusFilter === 'read' && !notification.read) return false;
    if (statusFilter === 'unread' && notification.read) return false;

    return true;
  });

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

  const unreadCount = notifications.filter(n => !n.read).length;

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-500" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-neutral-500 mb-4">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 pb-8">
        {/* Back button */}
        <div className="mb-6 pt-4">
          <Link
            href="/admin"
            className="inline-flex items-center text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Dashboard
          </Link>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Bell className="w-8 h-8" />
              Admin Notifications
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up!'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadNotifications}
              className="flex items-center gap-2 px-4 py-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>

            {notifications.length > 0 && (
              <button
                onClick={deleteAllNotifications}
                className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
                Delete All
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Filters */}
            <div className="flex gap-3">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as NotificationType | 'all')}
                className="px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as NotificationPriority | 'all')}
                className="px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'read' | 'unread')}
                className="px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="unread">Unread</option>
                <option value="read">Read</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {(selectedNotifications.length > 0 || unreadCount > 0) && (
          <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {filteredNotifications.length > 0 && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedNotifications.length === filteredNotifications.length}
                      onChange={toggleSelectAll}
                      className="rounded"
                    />
                    <span className="text-sm text-neutral-600 dark:text-neutral-400">
                      Select all {filteredNotifications.length} notifications
                    </span>
                  </label>
                )}

                {selectedNotifications.length > 0 && (
                  <span className="text-sm text-blue-600 dark:text-blue-400">
                    {selectedNotifications.length} selected
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedNotifications.length > 0 && (
                  <>
                    <button
                      onClick={markSelectedAsRead}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      Mark selected as read
                    </button>
                    <button
                      onClick={deleteSelectedNotifications}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete selected
                    </button>
                  </>
                )}

                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 rounded-lg transition-colors"
                  >
                    <CheckCheck className="w-4 h-4" />
                    Mark all as read
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Notifications List */}
        <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Bell className="w-12 h-12 text-neutral-300 mb-4" />
              <h3 className="text-lg font-medium text-neutral-500 mb-2">
                No notifications found
              </h3>
              <p className="text-neutral-400">
                {searchQuery || typeFilter !== 'all' || priorityFilter !== 'all' || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'All notifications will appear here'
                }
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {filteredNotifications.map((notification) => {
                const IconComponent = getNotificationIcon(notification.type);
                const isSelected = selectedNotifications.includes(notification.id || '');

                return (
                  <div
                    key={notification.id}
                    className={`p-6 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors ${
                      !notification.read ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                    } ${isSelected ? 'bg-blue-100/50 dark:bg-blue-900/20' : ''}`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Selection Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleNotificationSelection(notification.id || '')}
                        className="mt-1 rounded"
                      />

                      {/* Icon */}
                      <div className={`p-3 rounded-lg ${getPriorityColor(notification.priority)}`}>
                        <IconComponent className="w-5 h-5" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
                            {notification.title}
                          </h3>
                          <div className="flex items-center gap-3 ml-4">
                            {!notification.read && (
                              <button
                                onClick={() => notification.id && markAsRead(notification.id)}
                                className="p-1.5 text-neutral-400 hover:text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                                title="Mark as read"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => notification.id && deleteNotification(notification.id)}
                              className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                              title="Delete notification"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <span className="text-sm text-neutral-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTimeAgo(notification.createdAt)}
                            </span>
                          </div>
                        </div>

                        <p className="text-neutral-600 dark:text-neutral-400 mb-3">
                          {notification.message}
                        </p>

                        {/* Metadata */}
                        <div className="flex items-center gap-3 mb-3">
                          <span className={`text-xs px-3 py-1 rounded-full font-medium ${getPriorityColor(notification.priority)}`}>
                            {notification.priority} priority
                          </span>

                          <span className="text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-3 py-1 rounded-full">
                            {notification.type.replace('_', ' ')}
                          </span>

                          {notification.actionRequired && (
                            <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-3 py-1 rounded-full">
                              Action Required
                            </span>
                          )}

                          {!notification.read && (
                            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full">
                              Unread
                            </span>
                          )}
                        </div>

                        {/* Additional Data */}
                        {notification.data && Object.keys(notification.data).length > 0 && (
                          <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3 mb-3">
                            <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                              Additional Information:
                            </h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              {Object.entries(notification.data).map(([key, value]) => (
                                <div key={key}>
                                  <span className="text-neutral-500 capitalize">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}:</span>
                                  <span className="ml-2 text-neutral-700 dark:text-neutral-300">{String(value)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        {notification.actions && notification.actions.length > 0 && (
                          <div className="flex items-center gap-2">
                            {notification.actions.map((action, index) => (
                              <a
                                key={index}
                                href={action.url}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-lg transition-colors text-sm font-medium"
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
      </div>
    </div>
  );
}
