'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Monitor, Smartphone, Globe, Loader2, AlertCircle, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function DeviceInfoTestPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Protect this page - admin only
  useEffect(() => {
    if (!authLoading) {
      if (!user || !isAdmin) {
        router.push('/');
      }
    }
  }, [user, isAdmin, authLoading, router]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-500" />
      </div>
    );
  }

  // Show access denied if not admin
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-neutral-500 mb-4">This page is only accessible to administrators.</p>
        </div>
      </div>
    );
  }

  const testGetEndpoint = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/device-info');
      const result = await response.json();
      setData({ endpoint: 'GET', ...result });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const testPostEndpoint = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/device-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientData: {
            userAgent: navigator.userAgent,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        }),
      });
      const result = await response.json();
      setData({ endpoint: 'POST', ...result });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const testFullFlow = async () => {
    setLoading(true);
    setError(null);
    try {
      const { getEnrichedDeviceInfo } = await import('@/lib/device-info');
      const result = await getEnrichedDeviceInfo();
      setData({ endpoint: 'Full Flow', ...result });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Admin Badge */}
        <div className="mb-6">
          <a
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
          >
            <Shield className="w-4 h-4" />
            Back to Admin Dashboard
          </a>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">Device Info API Test</h1>
            <span className="px-2.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-xs font-medium rounded-full">
              Admin Only
            </span>
          </div>
          <p className="text-neutral-600 dark:text-neutral-400">
            Test the device tracking and geolocation API endpoints
          </p>
        </div>

        {/* Test Buttons */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Endpoints</h2>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={testGetEndpoint}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Testing...' : 'Test GET /api/device-info'}
            </button>
            <button
              onClick={testPostEndpoint}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Testing...' : 'Test POST /api/device-info'}
            </button>
            <button
              onClick={testFullFlow}
              disabled={loading}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Testing...' : 'Test Full Flow'}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-200 font-medium">Error:</p>
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}

        {/* Results Display */}
        {!loading && data && (
          <div className="space-y-6">
            {/* Endpoint Info */}
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200 rounded-full text-sm font-medium">
                  {data.endpoint}
                </div>
              </div>

              {/* IP Address */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-neutral-500 mb-2">IP Address</h3>
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-blue-600" />
                  <p className="text-2xl font-mono font-bold">{data.ip || 'Not available'}</p>
                </div>
              </div>

              {/* Device Info */}
              {data.browser && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-neutral-500 mb-2">Device Information</h3>
                  <div className="flex items-center gap-2 mb-2">
                    {data.isMobile ? (
                      <Smartphone className="w-5 h-5 text-purple-600" />
                    ) : (
                      <Monitor className="w-5 h-5 text-purple-600" />
                    )}
                    <p className="text-lg font-semibold">
                      {data.browser} • {data.os}
                    </p>
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Device: {data.device} {data.isMobile ? '(Mobile)' : '(Desktop)'}
                  </p>
                </div>
              )}

              {/* Location */}
              {data.location && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-neutral-500 mb-2">Location</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.location.city && (
                      <div>
                        <p className="text-xs text-neutral-500">City</p>
                        <p className="font-semibold">{data.location.city}</p>
                      </div>
                    )}
                    {data.location.region && (
                      <div>
                        <p className="text-xs text-neutral-500">Region</p>
                        <p className="font-semibold">{data.location.region}</p>
                      </div>
                    )}
                    {data.location.country_name && (
                      <div>
                        <p className="text-xs text-neutral-500">Country</p>
                        <p className="font-semibold">{data.location.country_name}</p>
                      </div>
                    )}
                    {data.location.timezone && (
                      <div>
                        <p className="text-xs text-neutral-500">Timezone</p>
                        <p className="font-semibold">{data.location.timezone}</p>
                      </div>
                    )}
                    {data.location.latitude && data.location.longitude && (
                      <div className="md:col-span-2">
                        <p className="text-xs text-neutral-500">Coordinates</p>
                        <p className="font-mono text-sm">
                          {data.location.latitude}, {data.location.longitude}
                        </p>
                      </div>
                    )}
                    {data.location.isp && (
                      <div className="md:col-span-2">
                        <p className="text-xs text-neutral-500">ISP</p>
                        <p className="font-semibold">{data.location.isp}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Raw JSON */}
              <div>
                <h3 className="text-sm font-medium text-neutral-500 mb-2">Raw Response</h3>
                <pre className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-4 overflow-x-auto text-xs">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </div>
            </div>

            {/* What This Means */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                💡 What This Means
              </h3>
              <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                {data.ip === '127.0.0.1' || data.ip === '::1' ? (
                  <>
                    <li>✅ You're testing locally - IP shows as localhost</li>
                    <li>⚠️ Location will show as "Local Development"</li>
                    <li>🚀 Deploy to production to see real IP and location data</li>
                  </>
                ) : (
                  <>
                    <li>✅ Your real IP address is being captured</li>
                    {data.location?.city ? (
                      <li>✅ Geolocation is working - showing your actual location</li>
                    ) : (
                      <li>⚠️ Geolocation failed - only IP and timezone available</li>
                    )}
                    <li>✅ This data will be stored in Firestore on user login</li>
                  </>
                )}
              </ul>
            </div>

            {/* Test Again */}
            <div className="flex justify-center">
              <button
                onClick={() => setData(null)}
                className="px-6 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Clear Results
              </button>
            </div>
          </div>
        )}

        {/* Instructions */}
        {!data && !loading && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
            <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
              📋 Testing Instructions
            </h3>
            <ul className="space-y-2 text-sm text-amber-800 dark:text-amber-200">
              <li>
                <strong>GET Endpoint:</strong> Simple test - just returns your IP and location
              </li>
              <li>
                <strong>POST Endpoint:</strong> Full test - includes client-side data like user agent
              </li>
              <li>
                <strong>Full Flow:</strong> Tests the actual function used during user login
              </li>
              <li className="mt-4 pt-4 border-t border-amber-200 dark:border-amber-700">
                <strong>Local Testing Note:</strong> When running on localhost, your IP will show
                as 127.0.0.1 and location as "Local Development". Deploy to Vercel/production
                to see real data!
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
