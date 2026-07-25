'use client';

import { useState } from 'react';
import { signInAnonymouslyIfNeeded, markLessonCompleted, getCategoryProgress } from '@/lib/firebase';

export default function DebugFirebasePage() {
  const [status, setStatus] = useState('Ready to test');
  const [progress, setProgress] = useState<any[]>([]);

  const testFirebase = async () => {
    try {
      setStatus('Testing Firebase authentication...');
      const user = await signInAnonymouslyIfNeeded();
      setStatus(`✅ Authenticated as: ${user.uid}`);
      
      setStatus('Testing lesson completion...');
      await markLessonCompleted('test-lesson', 'fundamentals', 60);
      setStatus('✅ Lesson marked complete');
      
      setStatus('Loading progress...');
      const userProgress = await getCategoryProgress('fundamentals');
      setProgress(userProgress);
      setStatus(`✅ Found ${userProgress.length} completed lessons`);
      
    } catch (error) {
      setStatus(`❌ Error: ${error}`);
      console.error('Firebase test error:', error);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-6">
      <h1 className="text-2xl font-bold mb-4">Firebase Debug Page</h1>
      
      <div className="bg-white dark:bg-neutral-900 border rounded-lg p-4 mb-4">
        <h2 className="font-semibold mb-2">Status:</h2>
        <div className="font-mono text-sm">{status}</div>
      </div>
      
      <button 
        onClick={testFirebase}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Test Firebase
      </button>
      
      {progress.length > 0 && (
        <div className="mt-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <h3 className="font-semibold mb-2">Progress Data:</h3>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(progress, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}