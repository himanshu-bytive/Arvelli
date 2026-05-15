# Arvelli WebView Detection Guide

## Purpose

The Arvelli mobile app loads the website inside a React Native WebView.

On the public website, app download buttons can be shown normally:

- Download on App Store
- Get it on Google Play

Inside the Arvelli mobile app WebView, these buttons must be hidden because the user is already inside the app. This is also required for App Store Review because Google Play references must not appear inside the iOS app experience.

## How The App Sends The WebView Signal

The React Native app WebView sends a custom user-agent suffix:

```tsx
applicationNameForUserAgent="ArvelliApp/1.0"
```

When the website is opened inside the Arvelli app, `navigator.userAgent` will contain:

```text
ArvelliApp/1.0
```

## Website Detection Logic

Use this check in the website code:

```js
const isArvelliAppWebView =
  typeof navigator !== 'undefined' &&
  navigator.userAgent.includes('ArvelliApp');
```

## Required Website Behavior

If `isArvelliAppWebView` is `true`, hide:

- App Store download button
- Google Play download button
- App install banners
- Any text or image mentioning Google Play, Play Store, or app download links

If `isArvelliAppWebView` is `false`, show these buttons normally on the public website.

## React / Next.js Example

```jsx
'use client';

import {useEffect, useState} from 'react';

export default function AppDownloadButtons() {
  const [isArvelliAppWebView, setIsArvelliAppWebView] = useState(false);

  useEffect(() => {
    setIsArvelliAppWebView(navigator.userAgent.includes('ArvelliApp'));
  }, []);

  if (isArvelliAppWebView) {
    return null;
  }

  return (
    <div className="download-app-buttons">
      <a href="APP_STORE_LINK">Download on App Store</a>
      <a href="PLAY_STORE_LINK">Get it on Google Play</a>
    </div>
  );
}
```

## Plain JavaScript Example

```js
document.addEventListener('DOMContentLoaded', function () {
  const isArvelliAppWebView = navigator.userAgent.includes('ArvelliApp');

  if (isArvelliAppWebView) {
    document.querySelectorAll('.download-app-buttons').forEach(function (el) {
      el.style.display = 'none';
    });
  }
});
```

## Important Notes

Do not detect only by screen size or mobile layout.

This is not enough:

```js
const isMobile = window.innerWidth < 768;
```

Mobile Safari and Chrome users should still see the download buttons. Only hide app download content when this is true:

```js
navigator.userAgent.includes('ArvelliApp')
```

## Expected Result

| Opened In | User Agent Has `ArvelliApp` | Download Buttons |
| --- | --- | --- |
| Arvelli iOS app WebView | Yes | Hidden |
| Arvelli Android app WebView | Yes | Hidden |
| Mobile Safari | No | Visible |
| Chrome Android | No | Visible |
| Desktop browser | No | Visible |

## App Store Review Context

Apple rejected the iOS app because Google Play references were visible inside the app experience.

Hiding the download buttons inside the Arvelli WebView fixes this issue while keeping them visible on the normal public website.
