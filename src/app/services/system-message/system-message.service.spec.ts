// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { SystemMessageService } from './system-message.service';
import { SystemMessageComponent } from '../../components/shared/system-message/system-message.component';

function createService() {
  const open = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: MatBottomSheet, useValue: { open } },
      SystemMessageService,
    ],
  });
  return { service: TestBed.inject(SystemMessageService), open };
}

describe('SystemMessageService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  /**
   * Verifies: displayMessage forwards title and message as the bottom sheet's data payload, targeting SystemMessageComponent.
   * Interacts with: MatBottomSheet.open (stubbed vi.fn), SystemMessageService.displayMessage.
   * Data: literal title/message strings passed to displayMessage.
   */
  it('displayMessage() opens the bottom sheet with the title and message', () => {
    const { service, open } = createService();
    service.displayMessage('Heads up', 'Something happened');
    expect(open).toHaveBeenCalledWith(SystemMessageComponent, {
      data: { title: 'Heads up', message: 'Something happened' },
    });
  });
});
