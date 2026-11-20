// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import { allowedApplicationUrl } from './application-url';

describe('allowedApplicationUrl', () => {
  let warn: MockInstance<typeof console.warn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  /**
   * Verifies: http and https URLs, relative URLs (including an unresolved placeholder in place of the
   *   address), and Player's own about:blank are returned unchanged and not warned about.
   * Interacts with: the browser URL parser via document.baseURI.
   * Data: the URL shapes Player's seed data, Blueprint and the operator url variables produce.
   */
  it.each([
    'https://example.test/app',
    'HTTP://example.test/app?theme=dark-theme',
    'http://localhost:4303/views/v1?theme=light-theme',
    'https://console.example.test/?vm=https://vm.example.test/',
    '/vm/views/v1',
    'assets/app/index.html',
    '//example.test/app',
    '{vmUrl}/views/v1',
    'about:blank',
  ])('allows %s', (url) => {
    expect(allowedApplicationUrl(url)).toBe(url);
    expect(warn).not.toHaveBeenCalled();
  });

  /**
   * Verifies: any other scheme becomes about:blank, including one hidden by case, leading spaces or the
   *   tabs and newlines a browser drops, and the refusal is logged.
   * Interacts with: the browser URL parser, console.warn.
   * Data: javascript:, data:, vbscript:, blob:, file: and about: URLs other than about:blank.
   */
  it.each([
    'javascript:alert(document.domain)',
    'JavaScript:alert(1)',
    '  javascript:alert(1)',
    'java\tscript:alert(1)',
    'java\nscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'blob:https://example.test/0b5e',
    'file:///etc/passwd',
    'about:srcdoc',
  ])('refuses %j', (url) => {
    expect(allowedApplicationUrl(url)).toBe('about:blank');
    expect(warn).toHaveBeenCalledWith(expect.any(String), url);
  });

  /**
   * Verifies: a URL the parser rejects outright becomes about:blank rather than throwing.
   * Interacts with: the browser URL parser.
   * Data: an absolute http URL with an invalid port.
   */
  it('refuses a URL that does not parse', () => {
    expect(allowedApplicationUrl('http://example.test:99999/')).toBe(
      'about:blank',
    );
  });
});
