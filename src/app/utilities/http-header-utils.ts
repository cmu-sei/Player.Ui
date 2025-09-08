// Copyright 2025 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { HttpHeaders } from '@angular/common/http';

export default class HttpHeaderUtils {
  static getFilename(headers: HttpHeaders): string {
    return headers
      .get('content-disposition')
      .match('filename*?=[\'"]?(?:UTF-d[\'"]*)?([^;\r\n"\']*)[\'"]?;?')[1];
  }

  static hasArchiveErrors(headers: HttpHeaders): boolean {
    const value = headers.get('X-Archive-Contains-Errors');
    return value?.toLowerCase() === 'true';
  }
}
