// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { TimeZoneAbbrPipe } from './time-zone-abbr.pipe';

function createPipe(locale: string): TimeZoneAbbrPipe {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: LOCALE_ID, useValue: locale }],
  });
  return TestBed.runInInjectionContext(() => new TimeZoneAbbrPipe());
}

describe('TimeZoneAbbrPipe', () => {
  /**
   * Verifies: each time is labeled from its own date, not today's, across the DST boundary.
   * Interacts with: transform with an explicit zone (the dev container runs in UTC).
   * Data: America/New_York, 2026-10-12 16:00Z (EDT) and 2026-11-12 16:00Z (EST, DST ends Nov 1).
   */
  it('derives EDT/EST from the date', () => {
    const pipe = createPipe('en-US');
    expect(pipe.transform('2026-10-12T16:00:00Z', 'America/New_York')).toBe(
      'EDT',
    );
    expect(pipe.transform('2026-11-12T16:00:00Z', 'America/New_York')).toBe(
      'EST',
    );
    expect(
      pipe.transform(new Date('2026-11-12T16:00:00Z'), 'America/New_York'),
    ).toBe('EST');
  });

  /**
   * Verifies: an empty time has no label.
   * Data: '', null, undefined.
   */
  it('returns an empty string for no time', () => {
    const pipe = createPipe('en-US');
    expect(pipe.transform('')).toBe('');
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });

  /**
   * Verifies: the label follows the app locale (LOCALE_ID), not a hard-coded en-US.
   * Data: Europe/Berlin in November, en-US gives GMT+1 and de-DE gives MEZ.
   */
  it('uses the locale it is given', () => {
    expect(
      createPipe('en-US').transform('2026-11-12T16:00:00Z', 'Europe/Berlin'),
    ).toBe('GMT+1');
    expect(
      createPipe('de-DE').transform('2026-11-12T16:00:00Z', 'Europe/Berlin'),
    ).toBe('MEZ');
  });
});
