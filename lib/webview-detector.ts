/**
 * Utility to detect if the app is running in an embedded webview
 * This helps provide better authentication experiences for mobile users
 */

export interface WebViewDetectionResult {
  isWebView: boolean;
  isStandaloneBrowser: boolean;
  platform: 'ios' | 'android' | 'desktop' | 'unknown';
  browserName: string;
  suggestedAction?: string;
}

/**
 * Detects if the current environment is an embedded webview
 * Returns detailed information about the browser environment
 */
export function detectWebView(): WebViewDetectionResult {
  // Server-side rendering guard
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isWebView: false,
      isStandaloneBrowser: true,
      platform: 'unknown',
      browserName: 'unknown',
    };
  }

  const userAgent = navigator.userAgent || '';
  const vendor = navigator.vendor || '';

  // Detect platform
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
  const isAndroid = /Android/.test(userAgent);
  const platform: 'ios' | 'android' | 'desktop' | 'unknown' =
    isIOS ? 'ios' : isAndroid ? 'android' : /Windows|Mac|Linux/.test(userAgent) ? 'desktop' : 'unknown';

  // Detect specific webview indicators
  const webViewIndicators = {
    // iOS indicators
    iOSWebView: isIOS && !/(Safari|CriOS|FxiOS|EdgiOS)/.test(userAgent),

    // Android indicators
    androidWebView: isAndroid && /wv/.test(userAgent),

    // Facebook/Instagram in-app browser
    facebookBrowser: /FBAN|FBAV/.test(userAgent),
    instagramBrowser: /Instagram/.test(userAgent),

    // Twitter/X in-app browser
    twitterBrowser: /Twitter/.test(userAgent),

    // LinkedIn in-app browser
    linkedInBrowser: /LinkedInApp/.test(userAgent),

    // Generic embedded browser
    embeddedBrowser: /WebView|(iPhone|iPod|iPad)(?!.*Safari\/)/i.test(userAgent),
  };

  const isWebView = Object.values(webViewIndicators).some(indicator => indicator);

  // Detect browser name for standalone browsers
  let browserName = 'Unknown';
  let suggestedAction: string | undefined;

  if (webViewIndicators.facebookBrowser) {
    browserName = 'Facebook In-App Browser';
    suggestedAction = platform === 'ios'
      ? 'Tap the three dots (•••) and select "Open in Safari"'
      : 'Tap the menu and select "Open in external browser"';
  } else if (webViewIndicators.instagramBrowser) {
    browserName = 'Instagram In-App Browser';
    suggestedAction = platform === 'ios'
      ? 'Tap the three dots (•••) and select "Open in Safari"'
      : 'Tap the menu and select "Open in browser"';
  } else if (webViewIndicators.twitterBrowser) {
    browserName = 'Twitter In-App Browser';
    suggestedAction = 'Tap the share icon and select "Open in browser"';
  } else if (webViewIndicators.linkedInBrowser) {
    browserName = 'LinkedIn In-App Browser';
    suggestedAction = 'Tap the menu and select "Open in external browser"';
  } else if (webViewIndicators.iOSWebView || webViewIndicators.embeddedBrowser) {
    browserName = 'In-App Browser';
    suggestedAction = platform === 'ios'
      ? 'Copy the URL and open it in Safari'
      : 'Copy the URL and open it in Chrome';
  } else if (webViewIndicators.androidWebView) {
    browserName = 'Android WebView';
    suggestedAction = 'Copy the URL and open it in Chrome';
  } else if (/Safari/.test(userAgent) && /Apple/.test(vendor)) {
    browserName = 'Safari';
  } else if (/Chrome/.test(userAgent)) {
    browserName = 'Chrome';
  } else if (/Firefox/.test(userAgent)) {
    browserName = 'Firefox';
  } else if (/Edge/.test(userAgent)) {
    browserName = 'Edge';
  }

  return {
    isWebView,
    isStandaloneBrowser: !isWebView,
    platform,
    browserName,
    suggestedAction,
  };
}

/**
 * Gets a user-friendly message to display when authentication is blocked
 */
export function getWebViewAuthMessage(detection: WebViewDetectionResult): {
  title: string;
  message: string;
  instructions: string;
} {
  const { platform, browserName, suggestedAction } = detection;

  if (!detection.isWebView) {
    return {
      title: 'Ready to Sign In',
      message: 'You can sign in using any of the available methods.',
      instructions: '',
    };
  }

  const platformName = platform === 'ios' ? 'Safari' : platform === 'android' ? 'Chrome' : 'your browser';

  return {
    title: 'Browser Compatibility Issue',
    message: `You're using ${browserName}, which doesn't support Google Sign-In for security reasons.`,
    instructions: suggestedAction ||
      `To sign in, please open this page in ${platformName}:\n\n1. Copy the current URL\n2. Open ${platformName}\n3. Paste and visit the URL\n4. Sign in normally`,
  };
}
