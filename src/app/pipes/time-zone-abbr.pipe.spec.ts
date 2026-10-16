// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimeZoneAbbrPipe } from './time-zone-abbr.pipe';

/** The pipe as the app builds it, under the given LOCALE_ID; one call per test. */
function createPipe(locale = 'en-US'): TimeZoneAbbrPipe {
  TestBed.configureTestingModule({
    providers: [{ provide: LOCALE_ID, useValue: locale }],
  });
  return TestBed.runInInjectionContext(() => new TimeZoneAbbrPipe());
}

describe('TimeZoneAbbrPipe', () => {
  // The viewer's-zone test pins TZ; unstubAllEnvs restores the host's.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /**
   * Verifies: each time is labeled from its own date, not today's, across the DST boundary, for a string or a Date.
   * Interacts with: transform with an explicit zone (the dev container runs in UTC); LOCALE_ID en-US.
   * Data: America/New_York; 2026-10-12 16:00Z is EDT and 2026-11-12 16:00Z is EST (DST ends Nov 1).
   */
  it.each([
    {
      label: 'an October ISO string',
      value: '2026-10-12T16:00:00Z' as string | Date,
      expected: 'EDT',
    },
    {
      label: 'a November ISO string',
      value: '2026-11-12T16:00:00Z',
      expected: 'EST',
    },
    {
      label: 'a November Date',
      value: new Date('2026-11-12T16:00:00Z'),
      expected: 'EST',
    },
  ])(
    'derives the America/New_York label from $label: $expected',
    ({ value, expected }) => {
      expect(createPipe().transform(value, 'America/New_York')).toBe(expected);
    },
  );

  /**
   * Verifies: an empty time has no label.
   * Interacts with: transform with no zone; LOCALE_ID en-US.
   * Data: one row each for '', null and undefined.
   */
  it.each([
    { label: 'an empty string', value: '' },
    { label: 'null', value: null },
    { label: 'undefined', value: undefined },
  ])('returns an empty string for $label', ({ value }) => {
    expect(createPipe().transform(value)).toBe('');
  });

  /**
   * Verifies: the label follows the app locale (LOCALE_ID), not a hard-coded en-US.
   * Interacts with: LOCALE_ID; transform with an explicit zone.
   * Data: Europe/Berlin on 2026-11-12; en-US gives GMT+1 and de-DE gives MEZ.
   */
  it.each([
    { locale: 'en-US', expected: 'GMT+1' },
    { locale: 'de-DE', expected: 'MEZ' },
  ])('uses the $locale locale it is given: $expected', ({ locale, expected }) => {
    expect(
      createPipe(locale).transform('2026-11-12T16:00:00Z', 'Europe/Berlin'),
    ).toBe(expected);
  });

  /**
   * Verifies: without a zone argument the label is the viewer's own zone, the one the runtime resolves.
   * Interacts with: transform with no zone; the process time zone pinned through the TZ environment variable;
   *   LOCALE_ID en-US.
   * Data: TZ America/New_York; 2026-11-12 16:00Z, after DST ends, is EST.
   */
  it("labels a time in the viewer's zone when no zone is given", () => {
    vi.stubEnv('TZ', 'America/New_York');
    expect(createPipe().transform('2026-11-12T16:00:00Z')).toBe('EST');
  });

  /**
   * Verifies: one pipe instance labels each date from its own date while reusing the zone's cached format.
   * Interacts with: transform called repeatedly on the same instance with one zone; LOCALE_ID en-US.
   * Data: America/New_York; 2026-10-12 16:00Z string (EDT), 2026-11-12 16:00Z string (EST), the same November
   *   time as a Date (EST).
   */
  it('labels each date from its own date on one instance', () => {
    const pipe = createPipe();
    expect([
      pipe.transform('2026-10-12T16:00:00Z', 'America/New_York'),
      pipe.transform('2026-11-12T16:00:00Z', 'America/New_York'),
      pipe.transform(new Date('2026-11-12T16:00:00Z'), 'America/New_York'),
    ]).toEqual(['EDT', 'EST', 'EST']);
  });

  /**
   * Verifies: one pipe instance keeps a format per zone, so alternating zones never reuses another zone's format.
   * Interacts with: transform called repeatedly on the same instance; LOCALE_ID en-US.
   * Data: 2026-11-12 16:00Z in America/New_York (EST), Europe/Berlin (GMT+1), then America/New_York again.
   */
  it('labels each zone with its own format on one instance', () => {
    const pipe = createPipe();
    const value = '2026-11-12T16:00:00Z';
    expect([
      pipe.transform(value, 'America/New_York'),
      pipe.transform(value, 'Europe/Berlin'),
      pipe.transform(value, 'America/New_York'),
    ]).toEqual(['EST', 'GMT+1', 'EST']);
  });
});
