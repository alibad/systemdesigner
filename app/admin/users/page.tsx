'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, limit } from 'firebase/firestore';
import {
  Users,
  Activity,
  Clock,
  AlertCircle,
  Loader2,
  Calendar,
  Mail,
  Shield,
  ChevronLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import AdminNav from '@/components/admin/AdminNav';
import UserLevelDisplay from '@/components/admin/UserLevelDisplay';

interface UserData {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  isAdmin?: boolean;
  createdAt?: Date;
  lastActive?: Date;
  isAnonymous?: boolean;
  stats?: {
    level: number;
    totalXP: number;
  };
  lastDevice?: {
    browser?: string;
    os?: string;
    device?: string;
    isMobile: boolean;
  };
  devices?: Array<{
    browser?: string;
    os?: string;
    device?: string;
    loginCount: number;
    lastSeen: any;
    ipAddress?: string;
    location?: {
      city?: string;
      region?: string;
      country?: string;
      country_name?: string;
    };
  }>;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();

  // Get a working image URL (same logic as UserMenu)
  const getWorkingImageUrl = (photoURL: string) => {
    // Try different size parameters that might work better
    const variants = [
      photoURL.replace(/=s\d+-c$/, '=s32-c'),
      photoURL.replace(/=s\d+-c$/, '=s48-c'),
      photoURL.replace(/=s\d+-c$/, ''),
      photoURL.split('=')[0]
    ];
    return variants[0]; // Start with smallest size
  };
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    adminUsers: 0,
    anonymousUsers: 0
  });

  useEffect(() => {
    if (!authLoading) {
      if (!user || !isAdmin) {
        router.push('/');
      } else {
        loadUsers();
      }
    }
  }, [user, isAdmin, authLoading, router]);

  const loadUsers = async () => {
    try {
      const usersQuery = query(
        collection(db, 'users'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      
      const usersSnapshot = await getDocs(usersQuery);
      const usersData: UserData[] = [];
      let adminCount = 0;
      let anonymousCount = 0;
      let activeCount = 0;
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      usersSnapshot.docs.forEach(doc => {
        const userData = doc.data();
        const user: UserData = {
          id: doc.id,
          email: userData.email || 'No email',
          displayName: userData.displayName,
          photoURL: userData.photoURL,
          isAdmin: userData.isAdmin || false,
          createdAt: userData.createdAt?.toDate(),
          lastActive: userData.lastActive?.toDate(),
          isAnonymous: userData.isAnonymous || false,
          stats: userData.stats ? {
            level: userData.stats.level || 1,
            totalXP: userData.stats.totalXP || 0
          } : undefined,
          lastDevice: userData.lastDevice,
          devices: userData.devices
        };

        usersData.push(user);

        if (user.isAdmin) adminCount++;
        if (user.isAnonymous) anonymousCount++;
        if (user.lastActive && user.lastActive > oneWeekAgo) activeCount++;
      });

      setUsers(usersData);
      setStats({
        totalUsers: usersData.length,
        activeUsers: activeCount,
        adminUsers: adminCount,
        anonymousUsers: anonymousCount
      });
      setLoading(false);
    } catch (error) {
      console.error('Error loading users:', error);
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

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Back button */}
        <div className="mb-6">
          <Link
            href="/admin"
            className="inline-flex items-center text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Dashboard
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">User Management</h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            View and manage registered users
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-1">{stats.totalUsers}</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Total Users</p>
          </div>

          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <Activity className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-1">{stats.activeUsers}</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Active This Week</p>
          </div>

          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-1">{stats.adminUsers}</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Admin Users</p>
          </div>

          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-1">{stats.anonymousUsers}</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Anonymous Users</p>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
            <h2 className="text-xl font-semibold">Recent Users</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Device/Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Last Active
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/admin/users/${user.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {user.photoURL ? (
                          <Image
                            src={getWorkingImageUrl(user.photoURL)}
                            alt="Profile"
                            width={32}
                            height={32}
                            className="w-8 h-8 rounded-full mr-3"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              // Hide the image and show default icon instead
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const fallback = target.nextElementSibling as HTMLElement;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className={`w-8 h-8 bg-neutral-200 dark:bg-neutral-700 rounded-full mr-3 flex items-center justify-center ${user.photoURL ? 'hidden' : ''}`}>
                          <Users className="w-4 h-4 text-neutral-500" />
                        </div>
                        {user.photoURL && (
                          <div className="w-8 h-8 bg-neutral-200 dark:bg-neutral-700 rounded-full mr-3 items-center justify-center hidden">
                            <Users className="w-4 h-4 text-neutral-500" />
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            {user.displayName || 'No name'}
                          </div>
                          <div className="text-sm text-neutral-500 flex items-center">
                            <Mail className="w-3 h-3 mr-1" />
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {user.stats ? (
                        <UserLevelDisplay
                          level={user.stats.level}
                          currentXP={user.stats.totalXP % 1000}
                          requiredXP={1000}
                          variant="compact"
                          showFireIcon={false}
                        />
                      ) : (
                        <span className="text-sm text-neutral-400">No data</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {user.lastDevice ? (
                        <div className="text-sm space-y-1">
                          <div className="text-neutral-900 dark:text-neutral-100 font-medium">
                            {user.lastDevice.browser || 'Unknown'} • {user.lastDevice.os || 'Unknown'}
                          </div>
                          <div className="text-neutral-500 text-xs">
                            {user.lastDevice.device || 'Unknown device'}
                            {user.devices && user.devices.length > 1 && (
                              <span className="ml-2 text-indigo-600 dark:text-indigo-400">
                                ({user.devices.length} devices)
                              </span>
                            )}
                          </div>
                          {user.devices && user.devices.length > 0 && user.devices[user.devices.length - 1].ipAddress && (
                            <div className="text-neutral-500 text-xs">
                              📍 {user.devices[user.devices.length - 1].location?.city || 'Unknown'}, {user.devices[user.devices.length - 1].location?.region || 'Unknown'}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-neutral-400">No data</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {user.isAdmin && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300">
                            Admin
                          </span>
                        )}
                        {user.isAnonymous && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                            Anonymous
                          </span>
                        )}
                        {!user.isAnonymous && !user.isAdmin && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                            Registered
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-500">
                      <div className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {user.createdAt ? user.createdAt.toLocaleDateString() : 'Unknown'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-500">
                      <div className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {user.lastActive ? user.lastActive.toLocaleDateString() : 'Never'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
