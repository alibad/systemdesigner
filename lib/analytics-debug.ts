'use client';

// Debug analytics functionality for development and testing

// Read the GA property from env so a fork sends analytics only to its own property.
const MEASUREMENT_ID = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '';

export const enableAnalyticsDebug = () => {
  if (typeof window !== 'undefined') {
    if (!MEASUREMENT_ID) {
      console.log('Analytics debug skipped: NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID is not set.');
      return;
    }

    // Enable Firebase Analytics Debug Mode
    (window as any).gtag = (window as any).gtag || function(...args: any[]) {
      console.log('🔍 GA Debug:', args);
      if ((window as any).dataLayer) {
        (window as any).dataLayer.push(arguments);
      }
    };

    // Enable debug mode
    (window as any).gtag('config', MEASUREMENT_ID, {
      debug_mode: true
    });

    console.log('🐛 Analytics Debug Mode Enabled');
    console.log('📊 Events will be logged to console and sent to Firebase');
  }
};

// Test analytics functionality
export const testAnalyticsEvents = async () => {
  console.log('🧪 Testing Analytics Events...');
  
  const { trackEvent, trackPageView, trackLessonStarted } = await import('@/lib/firebase');
  
  // Test basic event
  await trackEvent('test_event', {
    test_parameter: 'test_value',
    timestamp: Date.now()
  });

  // Test page view
  trackPageView('Test Page', '/test');

  // Test lesson tracking
  trackLessonStarted('test-lesson', 'fundamentals');

  console.log('✅ Test events sent - check console for Analytics logs');
};

// Add debug panel to page (for development)
export const addAnalyticsDebugPanel = () => {
  if (typeof window === 'undefined') return;

  const panel = document.createElement('div');
  panel.id = 'analytics-debug-panel';
  panel.innerHTML = `
    <div style="
      position: fixed; 
      bottom: 20px; 
      right: 20px; 
      background: #1a1a1a; 
      color: white; 
      padding: 15px; 
      border-radius: 8px; 
      font-family: monospace; 
      font-size: 12px; 
      z-index: 10000;
      border: 1px solid #333;
      min-width: 300px;
    ">
      <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 10px;">
        <strong>🔬 Analytics Debug</strong>
        <button onclick="this.parentElement.parentElement.parentElement.remove()" style="
          background: none; 
          border: none; 
          color: white; 
          cursor: pointer; 
          font-size: 16px;
          margin-left: auto;
        ">×</button>
      </div>
      
      <button onclick="window.enableAnalyticsDebug()" style="
        background: #4CAF50; 
        color: white; 
        border: none; 
        padding: 8px 12px; 
        border-radius: 4px; 
        cursor: pointer; 
        margin: 2px;
        font-size: 12px;
      ">Enable Debug</button>
      
      <button onclick="window.testAnalyticsEvents()" style="
        background: #2196F3; 
        color: white; 
        border: none; 
        padding: 8px 12px; 
        border-radius: 4px; 
        cursor: pointer; 
        margin: 2px;
        font-size: 12px;
      ">Test Events</button>
      
      <div style="margin-top: 10px; font-size: 11px; opacity: 0.8;">
        Check browser console for analytics logs
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  // Make functions available globally for buttons
  (window as any).enableAnalyticsDebug = enableAnalyticsDebug;
  (window as any).testAnalyticsEvents = testAnalyticsEvents;
};

// Check if analytics is working
export const checkAnalyticsStatus = () => {
  // Silent check - only return status, no logs
  const status = {
    windowExists: typeof window !== 'undefined',
    gtagExists: typeof (window as any)?.gtag === 'function',
    dataLayerExists: Array.isArray((window as any)?.dataLayer),
    measurementId: MEASUREMENT_ID
  };

  return status;
};
