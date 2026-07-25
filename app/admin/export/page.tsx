'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import {
  Download,
  FileText,
  Table,
  AlertCircle,
  Loader2,
  Calendar,
  Database,
  Users,
  MessageSquare,
  Award,
  Highlighter,
  ChevronLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import AdminNav from '@/components/admin/AdminNav';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

type ExportFormat = 'csv' | 'json';
type ExportType = 'users' | 'feedback' | 'progress' | 'quizzes' | 'highlights' | 'notes';

interface ExportOption {
  id: ExportType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
}

export default function AdminExportPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<ExportType | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('json');
  const [counts, setCounts] = useState<Record<ExportType, number>>({
    users: 0,
    feedback: 0,
    progress: 0,
    quizzes: 0,
    highlights: 0,
    notes: 0
  });

  useEffect(() => {
    if (!authLoading) {
      if (!user || !isAdmin) {
        router.push('/');
      } else {
        loadCounts();
      }
    }
  }, [user, isAdmin, authLoading, router]);

  const loadCounts = async () => {
    try {
      const [
        usersSnapshot,
        feedbackSnapshot,
        progressSnapshot
      ] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'feedback')),
        getDocs(collection(db, 'progress'))
      ]);

      // Count highlights and notes from annotations collection
      const annotationsSnapshot = await getDocs(collection(db, 'annotations'));
      let totalHighlights = 0;
      let totalNotes = 0;
      annotationsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (Array.isArray(data.highlights)) totalHighlights += data.highlights.length;
        if (Array.isArray(data.notes)) totalNotes += data.notes.length;
      });

      // Count quiz attempts from user stats
      let totalQuizAttempts = 0;
      usersSnapshot.docs.forEach(doc => {
        const userData = doc.data();
        if (userData.stats && userData.stats.totalQuizzesTaken) {
          totalQuizAttempts += userData.stats.totalQuizzesTaken;
        }
      });

      setCounts({
        users: usersSnapshot.size,
        feedback: feedbackSnapshot.size,
        progress: progressSnapshot.size,
        quizzes: totalQuizAttempts,
        highlights: totalHighlights,
        notes: totalNotes
      });
      setLoading(false);
    } catch (error) {
      console.error('Error loading counts:', error);
      setLoading(false);
    }
  };

  const exportOptions: ExportOption[] = [
    {
      id: 'users',
      title: 'Users',
      description: 'Export user accounts, registration dates, and activity data',
      icon: Users,
      count: counts.users
    },
    {
      id: 'feedback',
      title: 'Feedback',
      description: 'Export all user feedback and bug reports',
      icon: MessageSquare,
      count: counts.feedback
    },
    {
      id: 'progress',
      title: 'Learning Progress',
      description: 'Export lesson completion data and user progress',
      icon: Database,
      count: counts.progress
    },
    {
      id: 'quizzes',
      title: 'Quiz Results',
      description: 'Export quiz attempts, scores, and performance data',
      icon: Award,
      count: counts.quizzes
    },
    {
      id: 'highlights',
      title: 'Highlights',
      description: 'Export user text highlights from lessons',
      icon: Highlighter,
      count: counts.highlights
    },
    {
      id: 'notes',
      title: 'Notes',
      description: 'Export user notes and annotations',
      icon: FileText,
      count: counts.notes
    }
  ];

  const handleExport = async (exportType: ExportType) => {
    setExporting(exportType);
    
    try {
      let data: any[] = [];
      let filename = '';

      switch (exportType) {
        case 'users':
          const usersSnapshot = await getDocs(collection(db, 'users'));
          data = usersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
            lastActive: doc.data().lastActive?.toDate?.()?.toISOString(),
          }));
          filename = 'users';
          break;

        case 'feedback':
          const feedbackSnapshot = await getDocs(collection(db, 'feedback'));
          data = feedbackSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate?.()?.toISOString(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
          }));
          filename = 'feedback';
          break;

        case 'progress':
          const progressSnapshot = await getDocs(collection(db, 'progress'));
          data = progressSnapshot.docs.map(doc => ({
            userId: doc.id,
            ...doc.data(),
            completedAt: doc.data().completedAt?.toDate?.()?.toISOString(),
          }));
          filename = 'learning_progress';
          break;

        case 'quizzes':
          // Export quiz data from user stats in consolidated model
          const usersQuizSnapshot = await getDocs(collection(db, 'users'));
          data = [];
          usersQuizSnapshot.docs.forEach(userDoc => {
            const userData = userDoc.data();
            if (userData.stats && userData.stats.unlockedAchievements) {
              // Extract quiz-related data from user stats
              data.push({
                userId: userDoc.id,
                totalQuizzesTaken: userData.stats.totalQuizzesTaken || 0,
                averageQuizScore: userData.stats.averageQuizScore || 0,
                lastActivityDate: userData.stats.lastActivityDate?.toDate?.()?.toISOString(),
                totalXP: userData.stats.totalXP || 0,
                level: userData.stats.level || 1
              });
            }
          });
          filename = 'user_quiz_stats';
          break;

        case 'highlights':
          {
            const annSnap = await getDocs(collection(db, 'annotations'));
            data = [];
            annSnap.docs.forEach(doc => {
              const ann = doc.data();
              (ann.highlights || []).forEach((h: any) => {
                data.push({
                  userId: doc.id,
                  ...h,
                  createdAt: h.timestamp?.toDate?.()?.toISOString(),
                });
              });
            });
            filename = 'highlights';
          }
          break;

        case 'notes':
          {
            const annSnap = await getDocs(collection(db, 'annotations'));
            data = [];
            annSnap.docs.forEach(doc => {
              const ann = doc.data();
              (ann.notes || []).forEach((n: any) => {
                data.push({
                  userId: doc.id,
                  ...n,
                  createdAt: n.timestamp?.toDate?.()?.toISOString(),
                });
              });
            });
            filename = 'notes';
          }
          break;
      }

      // Generate file
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const fullFilename = `${filename}_${timestamp}.${selectedFormat}`;
      
      let content: string;
      let mimeType: string;

      if (selectedFormat === 'json') {
        content = JSON.stringify(data, null, 2);
        mimeType = 'application/json';
      } else {
        // CSV format
        if (data.length === 0) {
          content = 'No data available';
        } else {
          const headers = Object.keys(data[0]).join(',');
          const rows = data.map(row => 
            Object.values(row).map(value => 
              typeof value === 'string' && value.includes(',') ? `"${value}"` : value
            ).join(',')
          );
          content = [headers, ...rows].join('\n');
        }
        mimeType = 'text/csv';
      }

      // Download file
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fullFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setExporting(null);
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
      <div className="max-w-4xl mx-auto px-4 py-8">
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
          <h1 className="text-3xl font-bold mb-2">Data Export</h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Export platform data for analysis and reporting
          </p>
        </div>

        {/* Export Format Selection */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Export Settings</h2>
          <div className="flex items-center gap-4">
            <div>
              <Label htmlFor="format">Export Format</Label>
              <Select value={selectedFormat} onValueChange={(value: ExportFormat) => setSelectedFormat(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">
                    <div className="flex items-center">
                      <Table className="w-4 h-4 mr-2" />
                      CSV
                    </div>
                  </SelectItem>
                  <SelectItem value="json">
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 mr-2" />
                      JSON
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center text-sm text-neutral-500">
              <Calendar className="w-4 h-4 mr-1" />
              Includes timestamp in filename
            </div>
          </div>
        </div>

        {/* Export Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {exportOptions.map((option) => (
            <div
              key={option.id}
              className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg mr-3">
                    <option.icon className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{option.title}</h3>
                    <p className="text-sm text-neutral-500">{option.description}</p>
                  </div>
                </div>
                {option.count !== undefined && (
                  <div className="text-right">
                    <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                      {option.count.toLocaleString()}
                    </div>
                    <div className="text-xs text-neutral-500">records</div>
                  </div>
                )}
              </div>
              
              <Button
                onClick={() => handleExport(option.id)}
                disabled={exporting === option.id || option.count === 0}
                className="w-full"
                variant="outline"
              >
                {exporting === option.id ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Export {option.title}
                  </>
                )}
              </Button>
              
              {option.count === 0 && (
                <p className="text-xs text-neutral-400 mt-2">No data available to export</p>
              )}
            </div>
          ))}
        </div>

        {/* Export Info */}
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 dark:text-blue-100">Export Notes</h4>
              <ul className="text-sm text-blue-700 dark:text-blue-300 mt-1 space-y-1">
                <li>• Exports include all available data fields for the selected type</li>
                <li>• Timestamps are converted to ISO 8601 format</li>
                <li>• Large exports may take a few moments to process</li>
                <li>• CSV files are compatible with Excel and Google Sheets</li>
                <li>• JSON files preserve original data structure</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}