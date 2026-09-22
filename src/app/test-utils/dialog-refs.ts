// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Mock, vi } from 'vitest';
import { EMPTY } from 'rxjs';
import { MatDialogRef } from '@angular/material/dialog';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';

// The refs are typed off the real classes, so the stand-ins track the members a
// dialog host actually touches and a vi.fn() close spy stays assignable.
type DialogRefStub<T> = Pick<
  MatDialogRef<T>,
  'close' | 'disableClose' | 'keydownEvents' | 'afterClosed'
>;

export function dialogRefStub<T>(): {
  dialogRef: MatDialogRef<T>;
  close: Mock;
} {
  const close = vi.fn();
  const stub: DialogRefStub<T> = {
    close,
    disableClose: false,
    keydownEvents: () => EMPTY,
    afterClosed: () => EMPTY,
  };
  return { dialogRef: stub as MatDialogRef<T>, close };
}

export function bottomSheetRefStub<T>(): {
  sheetRef: MatBottomSheetRef<T>;
  dismiss: Mock;
} {
  const dismiss = vi.fn();
  const stub: Pick<MatBottomSheetRef<T>, 'dismiss'> = { dismiss };
  return { sheetRef: stub as MatBottomSheetRef<T>, dismiss };
}
