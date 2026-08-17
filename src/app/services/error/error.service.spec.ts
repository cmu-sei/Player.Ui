// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ErrorService } from './error.service';
import { SystemMessageService } from '../system-message/system-message.service';

function createService() {
  const displayMessage = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: SystemMessageService, useValue: { displayMessage } },
      ErrorService,
    ],
  });
  // ErrorService resolves SystemMessageService lazily via Injector.get.
  return { service: TestBed.inject(ErrorService), displayMessage };
}

describe('ErrorService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: a status-0/"Unknown Error" HttpErrorResponse maps to a friendly "API could not be reached" system message
   * Interacts with: SystemMessageService.displayMessage stub; service.handleError
   * Data: an HttpErrorResponse with status 0, statusText 'Unknown Error', and a url
   * Why: relies on Angular's real generated message text matching the start/end substrings the service checks
   */
  it('reports an unreachable API for a "0 Unknown Error" HTTP response', () => {
    const { service, displayMessage } = createService();
    const err = new HttpErrorResponse({
      status: 0,
      statusText: 'Unknown Error',
      url: 'https://api.test/x',
    });
    // The real message produced by Angular matches the start/end the service checks.
    service.handleError(err);
    expect(displayMessage).toHaveBeenCalledWith(
      'API Error',
      'The API could not be reached.',
    );
  });

  /**
   * Verifies: when the response body carries an error.title, it is used as the message and statusText as the heading
   * Interacts with: SystemMessageService.displayMessage stub; service.handleError
   * Data: a 400 HttpErrorResponse whose error body is { title: 'Validation failed' }
   */
  it('uses the error.title when present on an HttpErrorResponse', () => {
    const { service, displayMessage } = createService();
    const err = new HttpErrorResponse({
      status: 400,
      statusText: 'Bad Request',
      error: { title: 'Validation failed' },
    });
    service.handleError(err);
    expect(displayMessage).toHaveBeenCalledWith(
      'Bad Request',
      'Validation failed',
    );
  });

  /**
   * Verifies: an HttpErrorResponse with no error.title falls back to statusText as heading and the response's own message
   * Interacts with: SystemMessageService.displayMessage stub; service.handleError
   * Data: a 404 'Not Found' HttpErrorResponse with no error body
   */
  it('falls back to statusText + message for other HttpErrorResponses', () => {
    const { service, displayMessage } = createService();
    const err = new HttpErrorResponse({
      status: 404,
      statusText: 'Not Found',
    });
    service.handleError(err);
    expect(displayMessage).toHaveBeenCalledWith('Not Found', err.message);
  });

  /**
   * Verifies: an uncaught-promise rejection whose message is 'Network Error' is reported as an Identity Server auth failure
   * Interacts with: SystemMessageService.displayMessage stub; service.handleError
   * Data: a plain error object with message 'Uncaught (in promise): Network Error' and rejection.message 'Network Error'
   */
  it('reports an Identity Server error for an uncaught Network Error promise', () => {
    const { service, displayMessage } = createService();
    service.handleError({
      message: 'Uncaught (in promise): Network Error',
      rejection: { message: 'Network Error' },
    });
    expect(displayMessage).toHaveBeenCalledWith(
      'Identity Server Error',
      'The Identity Server could not be reached for user authentication.',
    );
  });

  /**
   * Verifies: a non-network uncaught-promise rejection surfaces under a generic 'Error' heading with the rejection message
   * Interacts with: SystemMessageService.displayMessage stub; service.handleError
   * Data: an error with message 'Uncaught (in promise): boom' and rejection.message 'boom'
   */
  it('reports the rejection message for other uncaught promise errors', () => {
    const { service, displayMessage } = createService();
    service.handleError({
      message: 'Uncaught (in promise): boom',
      rejection: { message: 'boom' },
    });
    expect(displayMessage).toHaveBeenCalledWith('Error', 'boom');
  });

  /**
   * Verifies: a plain Error-shaped object (not HTTP, not an uncaught promise) reports its name as heading and message as body
   * Interacts with: SystemMessageService.displayMessage stub; service.handleError
   * Data: { name: 'TypeError', message: 'x is undefined' }
   */
  it('reports name + message for a generic error', () => {
    const { service, displayMessage } = createService();
    service.handleError({ name: 'TypeError', message: 'x is undefined' });
    expect(displayMessage).toHaveBeenCalledWith('TypeError', 'x is undefined');
  });
});
