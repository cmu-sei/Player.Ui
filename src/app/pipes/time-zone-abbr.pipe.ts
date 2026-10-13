// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { inject, LOCALE_ID, Pipe, PipeTransform } from '@angular/core';

// The viewer's time zone abbreviation for a date, e.g. EDT or EST. Each time is
// labeled from its own date, so a November notification reads EST even when viewed
// in October. The locale is the app's LOCALE_ID, the same one the date pipe uses.
@Pipe({ name: 'timeZoneAbbr' })
export class TimeZoneAbbrPipe implements PipeTransform {
  private readonly formats = new Map<string, Intl.DateTimeFormat>();

  private readonly locale = inject(LOCALE_ID);

  // timeZone defaults to the viewer's zone
  transform(
    value: string | Date | null | undefined,
    timeZone?: string,
  ): string {
    if (!value) {
      return '';
    }
    const key = timeZone ?? '';
    let format = this.formats.get(key);
    if (!format) {
      format = new Intl.DateTimeFormat(this.locale, {
        timeZone,
        timeZoneName: 'short',
      });
      this.formats.set(key, format);
    }
    return (
      format
        .formatToParts(new Date(value))
        .find((part) => part.type === 'timeZoneName')?.value ?? ''
    );
  }
}
