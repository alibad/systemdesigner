'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import {
  AlertCircle,
  Loader2,
  Calendar,
  User,
  ChevronLeft,
  FileText,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import AdminNav from '@/components/admin/AdminNav';

interface WhiteboardData {
  id: string;
  title: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  userName?: string;
  userEmail?: string;
}

export default function AdminWhiteboardsPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [whiteboards, setWhiteboards] = useState<WhiteboardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalWhiteboards: 0,
    usersWithWhiteboards: 0,
  });

  useEffect(() => {
    if (!authLoading) {
      if (!user || !isAdmin) {
        router.push('/');
      } else {
        loadWhiteboards();
      }
    }
  }, [user, isAdmin, authLoading, router]);

  const loadWhiteboards = async () => {
    try {
      setLoading(true);

      // Get all users who have whiteboards
      const usersQuery = query(
        collection(db, 'users'),
        orderBy('createdAt', 'desc')
      );

      const usersSnapshot = await getDocs(usersQuery);
      const allWhiteboards: WhiteboardData[] = [];
      const userIds = new Set<string>();

      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        const whiteboards = data.whiteboards || [];

        if (whiteboards.length > 0) {
          userIds.add(doc.id);

          whiteboards.forEach((wb: any) => {
            allWhiteboards.push({
              id: wb.id,
              title: wb.title || 'Untitled',
              description: wb.description,
              createdAt: wb.createdAt?.toDate?.() || new Date(wb.createdAt),
              updatedAt: wb.updatedAt?.toDate?.() || new Date(wb.updatedAt),
              userId: doc.id,
              userName: data.displayName,
              userEmail: data.email,
            });
          });
        }
      });

      // Sort by updated date (newest first)
      allWhiteboards.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      setWhiteboards(allWhiteboards);
      setStats({
        totalWhiteboards: allWhiteboards.length,
        usersWithWhiteboards: userIds.size,
      });
      setLoading(false);
    } catch (error) {
      console.error('Error loading whiteboards:', error);
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
    <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 mb-4"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Dashboard
          </Link>

          <h1 className="text-3xl font-bold mb-2">Whiteboards</h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            View all user whiteboards across the platform
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-1">{stats.totalWhiteboards.toLocaleString()}</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Total Whiteboards</p>
          </div>

          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/20">
                <User className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-1">{stats.usersWithWhiteboards.toLocaleString()}</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Users with Whiteboards</p>
          </div>
        </div>

        {/* Whiteboards Table */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Last Updated
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {whiteboards.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="text-neutral-400">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">No whiteboards found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  whiteboards.map((whiteboard) => (
                    <tr
                      key={whiteboard.id}
                      className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-neutral-900 dark:text-neutral-100">
                            {whiteboard.title}
                          </div>
                          {whiteboard.description && (
                            <div className="text-sm text-neutral-500 dark:text-neutral-400 line-clamp-1">
                              {whiteboard.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm text-neutral-900 dark:text-neutral-100">
                            {whiteboard.userName || 'Unknown'}
                          </div>
                          <div className="text-xs text-neutral-500 dark:text-neutral-400">
                            {whiteboard.userEmail}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center text-sm text-neutral-600 dark:text-neutral-400">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(whiteboard.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-neutral-600 dark:text-neutral-400">
                          {formatDate(whiteboard.updatedAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/admin/whiteboard/${whiteboard.id}`}
                          className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                          title="View in admin read-only mode"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
      </div>
    </div>
  );
}
