'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import FirestoreMiddleware from '@/lib/firestore-middleware';
import { NotificationService } from '@/lib/notification-service';
import {
  MessageSquare,
  Users,
  AlertCircle,
  ChevronRight,
  Loader2,
  BarChart3,
  Bell,
  Smartphone,
  FileText,
  FilePenLine
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DashboardStats {
  totalUsers: number;
  totalDevices: number;
  avgDevicesPerUser: number;
  mobileUsers: number;
  desktopUsers: number;
  totalFeedback: number;
  unresolvedFeedback: number;
  totalNotifications: number;
  unreadNotifications: number;
  totalWhiteboards: number;
  usersWithWhiteboards: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalDevices: 0,
    avgDevicesPerUser: 0,
    mobileUsers: 0,
    desktopUsers: 0,
    totalFeedback: 0,
    unresolvedFeedback: 0,
    totalNotifications: 0,
    unreadNotifications: 0,
    totalWhiteboards: 0,
    usersWithWhiteboards: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      if (!user || !isAdmin) {
        router.push('/');
      } else {
        loadDashboardStats();
      }
    }
  }, [user, isAdmin, authLoading, router]);


  const loadDashboardStats = async () => {
    try {
      // Use new consolidated admin dashboard stats function
      const dashboardStats = await FirestoreMiddleware.getAdminDashboardStats();

      // Get notification stats
      const notificationSummary = await NotificationService.getNotificationSummary();

      // Get whiteboard stats
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      let totalWhiteboards = 0;
      let usersWithWhiteboards = 0;
      usersSnapshot.forEach((doc) => {
        const whiteboards = doc.data().whiteboards || [];
        if (whiteboards.length > 0) {
          totalWhiteboards += whiteboards.length;
          usersWithWhiteboards++;
        }
      });

      setStats({
        totalUsers: dashboardStats.users.total,
        totalDevices: dashboardStats.devices.totalDevices,
        avgDevicesPerUser: dashboardStats.devices.avgDevicesPerUser,
        mobileUsers: dashboardStats.devices.mobileUsers,
        desktopUsers: dashboardStats.devices.desktopUsers,
        totalFeedback: dashboardStats.engagement.totalFeedback,
        unresolvedFeedback: dashboardStats.engagement.unresolvedFeedback,
        totalNotifications: Object.values(notificationSummary.typeCounts).reduce((sum, count) => sum + count, 0),
        unreadNotifications: notificationSummary.unreadCount,
        totalWhiteboards,
        usersWithWhiteboards,
      });


      setLoading(false);
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
      // Fallback to default values on error
      setStats({
        totalUsers: 0,
        totalDevices: 0,
        avgDevicesPerUser: 0,
        mobileUsers: 0,
        desktopUsers: 0,
        totalFeedback: 0,
        unresolvedFeedback: 0,
        totalNotifications: 0,
        unreadNotifications: 0,
        totalWhiteboards: 0,
        usersWithWhiteboards: 0,
      });
      setLoading(false);
    }
  };

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
          <Button onClick={() => router.push('/')}>Return Home</Button>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers.toLocaleString(),
      change: '+12%',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20',
      link: '/admin/users',
    },
    {
      title: 'Whiteboards',
      value: stats.totalWhiteboards.toLocaleString(),
      badge: `${stats.usersWithWhiteboards} users`,
      icon: FileText,
      color: 'text-teal-600',
      bgColor: 'bg-teal-100 dark:bg-teal-900/20',
      link: '/admin/whiteboards',
    },
    {
      title: 'Devices Tracked',
      value: stats.totalDevices.toLocaleString(),
      badge: `${stats.avgDevicesPerUser} avg/user`,
      icon: Smartphone,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/20',
      link: '/admin/users',
    },
    {
      title: 'Feedback',
      value: stats.totalFeedback.toLocaleString(),
      badge: `${stats.unresolvedFeedback} unresolved`,
      icon: MessageSquare,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/20',
      link: '/admin/feedback',
    },
    {
      title: 'Notifications',
      value: stats.totalNotifications.toLocaleString(),
      badge: stats.unreadNotifications > 0 ? `${stats.unreadNotifications} unread` : undefined,
      icon: Bell,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/20',
      link: '/admin/notifications',
    },
  ];


  const quickActions = [
    { label: 'Edit Content', href: '/admin/content/editor' as const, icon: FilePenLine },
    { label: 'View Feedback', href: '/admin/feedback' as const, icon: MessageSquare },
    { label: 'User Management', href: '/admin/users' as const, icon: Users },
    { label: 'View Whiteboards', href: '/admin/whiteboards' as const, icon: FileText },
    { label: 'Quiz Analytics', href: '/admin/quiz-analytics' as const, icon: BarChart3 },
    { label: 'Notifications', href: '/admin/notifications' as const, icon: Bell },
    { label: 'Device Tracking Test', href: '/api/device-info/test' as const, icon: Smartphone },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Monitor system performance and user activity
        </p>
      </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href as any}
              className="flex items-center justify-between p-4 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <action.icon className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                <span className="text-sm font-medium">{action.label}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400" />
            </Link>
          ))}
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((card) => (
            <div
              key={card.title}
              className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => card.link && router.push(card.link as any)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg ${card.bgColor}`}>
                  <card.icon className={`w-6 h-6 ${card.color}`} />
                </div>
                {card.change && (
                  <span className="text-xs font-medium text-green-600 bg-green-100 dark:bg-green-900/20 px-2 py-1 rounded">
                    {card.change}
                  </span>
                )}
                {card.badge && (
                  <span className="text-xs font-medium text-red-600 bg-red-100 dark:bg-red-900/20 px-2 py-1 rounded">
                    {card.badge}
                  </span>
                )}
              </div>
              <h3 className="text-2xl font-bold mb-1">{card.value}</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">{card.title}</p>
              {card.link && (
                <div className="mt-4 flex items-center text-sm font-medium text-indigo-600 dark:text-indigo-400">
                  View details
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
