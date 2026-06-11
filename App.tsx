/**
 * Arvelli - Jewelry E-Commerce App
 * @format
 */

import React, {useRef, useState, useCallback} from 'react';
import {
  StatusBar,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  BackHandler,
  Platform,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {WebView} from 'react-native-webview';
import type {WebViewNavigation} from 'react-native-webview';
import type {WebViewErrorEvent} from 'react-native-webview/lib/WebViewTypes';
import Icon from 'react-native-vector-icons/Feather';
import BootSplash from 'react-native-bootsplash';

const BASE_URL = 'https://dev-arvelli-fe.oh0rvq.easypanel.host';

const TABS = [
  {key: 'home', label: 'Home', path: '/', icon: 'home'},
  {key: 'categories', label: 'Categories', path: '/jewellery', icon: 'grid'},
  {key: 'wishlist', label: 'Wishlist', path: '/wishlist', icon: 'heart'},
  {key: 'cart', label: 'Cart', path: '/checkout/cart', icon: 'shopping-bag'},
  {key: 'account', label: 'Account', path: '/account', icon: 'user'},
] as const;

type TabKey = (typeof TABS)[number]['key'];

const DISABLE_ZOOM_JS = `
  var meta = document.querySelector('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'viewport';
    document.head.appendChild(meta);
  }
  meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
  document.addEventListener('gesturestart', function(e) { e.preventDefault(); });
  true;
`;

function getActiveTab(url: string): TabKey {
  if (!url) {return 'home';}
  const path = url.replace(BASE_URL, '');
  if (path.startsWith('/wishlist')) {return 'wishlist';}
  if (path.startsWith('/checkout/cart')) {return 'cart';}
  if (path.startsWith('/account') || path.startsWith('/my-account') || path.startsWith('/profile')) {return 'account';}
  if (path.startsWith('/jewellery') || path.startsWith('/gold') || path.startsWith('/diamond') || path.startsWith('/silver')) {return 'categories';}
  if (path === '/' || path === '') {return 'home';}
  return 'home';
}

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#ffffff"
        translucent={false}
      />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const webViewRef = useRef<WebView>(null);
  const insets = useSafeAreaInsets();
  const [canGoBack, setCanGoBack] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [currentUrl, setCurrentUrl] = useState(`${BASE_URL}/`);
  const tabBarSafeAreaStyle = React.useMemo(
    () =>
      StyleSheet.create({
        tabBarSafeArea: {
          paddingBottom: Math.max(insets.bottom, 6),
        },
      }).tabBarSafeArea,
    [insets.bottom],
  );
  const onNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      setCanGoBack(navState.canGoBack);
      if (navState.url) {
        setCurrentUrl(navState.url);
        setActiveTab(getActiveTab(navState.url));
      }
    },
    [],
  );

  const onTabPress = useCallback(
    (tab: (typeof TABS)[number]) => {
      if (tab.key === 'account') {
        const checkLoginAndNavigate = `
          (function() {
            var btns = document.querySelectorAll('button');
            var loginBtn = null;
            for (var i = 0; i < btns.length; i++) {
              if (btns[i].textContent.trim().includes('Sign in')) {
                loginBtn = btns[i];
                break;
              }
            }
            if (loginBtn) {
              loginBtn.click();
            } else {
              window.location.href = '${BASE_URL}/account';
            }
          })();
          true;
        `;
        webViewRef.current?.injectJavaScript(checkLoginAndNavigate);
        setActiveTab('account');
        return;
      }
      const targetUrl = `${BASE_URL}${tab.path}`;
      if (currentUrl !== targetUrl) {
        webViewRef.current?.injectJavaScript(
          `window.location.href = '${targetUrl}'; true;`,
        );
      } else {
        webViewRef.current?.injectJavaScript(
          `window.scrollTo({top: 0, behavior: 'smooth'}); true;`,
        );
      }
      setActiveTab(tab.key);
    },
    [currentUrl],
  );

  const onError = useCallback((event: WebViewErrorEvent) => {
    const {nativeEvent} = event;
    const offlineErrors = [
      'net::ERR_NAME_NOT_RESOLVED',
      'net::ERR_INTERNET_DISCONNECTED',
      'net::ERR_CONNECTION_REFUSED',
      'net::ERR_CONNECTION_TIMED_OUT',
      'net::ERR_ADDRESS_UNREACHABLE',
      'NSURLErrorNotConnectedToInternet',
      'NSURLErrorCannotFindHost',
      'NSURLErrorTimedOut',
      'NSURLErrorNetworkConnectionLost',
    ];
    if (offlineErrors.some(e => nativeEvent.description?.includes(e))) {
      setIsOffline(true);
    }
  }, []);

  const handleRetry = useCallback(() => {
    setIsOffline(false);
    webViewRef.current?.reload();
  }, []);

  React.useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (canGoBack && webViewRef.current) {
          webViewRef.current.goBack();
          return true;
        }
        return false;
      },
    );
    return () => backHandler.remove();
  }, [canGoBack]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          source={{uri: `${BASE_URL}/`}}
          style={isOffline ? styles.hidden : styles.webview}
          onNavigationStateChange={onNavigationStateChange}
          onError={onError}
          onLoadEnd={() => {
            if (isOffline) {
              setIsOffline(false);
            }
            BootSplash.hide({fade: true});
          }}
          renderError={() => <View />}
          sharedCookiesEnabled={true}
          thirdPartyCookiesEnabled={true}
          allowsBackForwardNavigationGestures={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={false}
          scalesPageToFit={false}
          injectedJavaScript={DISABLE_ZOOM_JS}
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          cacheEnabled={true}
          cacheMode="LOAD_DEFAULT"
          pullToRefreshEnabled={true}
          allowFileAccess={true}
          setSupportMultipleWindows={false}
          bounces={true}
          overScrollMode="always"
          applicationNameForUserAgent="ArvelliApp/1.0"
        />
        {isOffline && (
          <View style={styles.offlineContainer}>
            <Text style={styles.offlineIcon}>📡</Text>
            <Text style={styles.offlineTitle}>No Internet Connection</Text>
            <Text style={styles.offlineMessage}>
              Please check your Wi-Fi or mobile data and try again.
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleRetry}
              activeOpacity={0.8}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom Tab Bar */}
        <View
          style={[
            styles.tabBar,
            tabBarSafeAreaStyle,
          ]}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.tabItem}
                onPress={() => onTabPress(tab)}
                activeOpacity={0.7}>
                <Icon
                  name={tab.icon}
                  size={22}
                  color={isActive ? ACCENT : '#999999'}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    isActive && styles.tabLabelActive,
                  ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const ACCENT = '#b8860b';
const ACCENT_LIGHT = '#d4a84b';

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  hidden: {
    height: 0,
    opacity: 0,
  },
  offlineContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 40,
  },
  offlineIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  offlineTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
    textAlign: 'center',
  },
  offlineMessage: {
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  retryButton: {
    backgroundColor: ACCENT,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 30,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f0e6d3',
    paddingTop: 8,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -3},
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#999999',
    marginTop: 1,
  },
  tabLabelActive: {
    color: ACCENT_LIGHT,
    fontWeight: '700',
  },
});

export default App;
