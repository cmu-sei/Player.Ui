// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/** What an application iframe shows when it has no URL Player may load. */
export const BLANK_APPLICATION_URL = 'about:blank';

/**
 * Returns `url` if Player may load it into an application iframe, or
 * about:blank if it may not. Applications' URLs are trusted past Angular's
 * sanitizer, so this is what keeps a `javascript:` or `data:` URL from running
 * in Player's origin. Only http and https are allowed, and URLs with no
 * scheme, which resolve against Player's own address. The API refuses other
 * schemes too, but not for URLs saved before it did.
 */
export function allowedApplicationUrl(url: string): string {
  if (url === BLANK_APPLICATION_URL) {
    return url;
  }

  let protocol: string | undefined;
  try {
    // Parsed the way the iframe will parse it, so the tabs, newlines and
    // leading spaces a browser ignores cannot hide a scheme.
    protocol = new URL(url, document.baseURI).protocol;
  } catch {
    protocol = undefined;
  }

  if (protocol === 'http:' || protocol === 'https:') {
    return url;
  }

  console.warn(
    'Not loading an application URL that is not http or https:',
    url,
  );
  return BLANK_APPLICATION_URL;
}
