// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Title } from '@angular/platform-browser';
import { BehaviorSubject, of, Subject } from 'rxjs';
import {
  ComnSettingsService,
  CrucibleDialogService,
} from '@cmusei/crucible-common';
import { NotificationService } from '../../../services/notification/notification.service';
import { ViewService } from '../../../generated/player-api/api/view.service';
import { NotificationDataStatus } from '../../../models/notification-data';
import { NotificationsComponent } from './notifications.component';
import { renderComponent } from '../../../test-utils/render-component';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';

function makeNotification(
  overrides: Partial<NotificationDataStatus> = {},
): NotificationDataStatus {
  return {
    key: 1,
    subject: 'Hi',
    text: 'hello',
    link: '',
    iconUrl: '',
    broadcastTime: new Date('2026-01-01').toISOString(),
    wasSeen: false,
    ...overrides,
  } as NotificationDataStatus;
}

async function renderNotifications(
  overrides: {
    confirm?: boolean;
    viewAdmin?: boolean;
  } = {},
) {
  const { confirm = true, viewAdmin = false } = overrides;

  const canSendMessage = new BehaviorSubject<boolean>(viewAdmin);
  const notificationHistory = new BehaviorSubject<NotificationDataStatus[]>([]);
  const viewNotification = new Subject<Partial<NotificationDataStatus>>();
  const deleteNotification = new Subject<string>();
  const connectToNotificationServer = vi.fn();
  const sendNotification = vi.fn();

  const setTitle = vi.fn();
  const confirmDialog = vi.fn(() => ({
    afterClosed: () => of(confirm),
  }));

  const deleteViewNotification = vi.fn(() => of(undefined));
  const deleteViewNotifications = vi.fn(() => of(undefined));

  const rendered = await renderComponent(NotificationsComponent, {
    imports: [
      MatExpansionModule,
      MatListModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatBadgeModule,
      MatButtonModule,
    ],
    declarations: [NotificationsComponent],
    componentProperties: {
      viewGuid: 'v1',
      teamGuid: 't1',
      userGuid: 'u1',
      userToken: 'tok',
      userName: 'Alice',
    },
    providers: [
      {
        provide: NotificationService,
        useValue: {
          canSendMessage,
          notificationHistory,
          viewNotification,
          deleteNotification,
          connectToNotificationServer,
          sendNotification,
        },
      },
      {
        provide: ComnSettingsService,
        useValue: {
          settings: {
            AppTitle: 'Player',
            NotificationsSettings: {
              useBadge: true,
              useBlink: true,
              useBeep: false,
            },
          },
        },
      },
      {
        provide: CrucibleDialogService,
        useValue: { confirm: confirmDialog },
      },
      {
        provide: ViewService,
        useValue: {
          deleteNotification: deleteViewNotification,
          deleteViewNotifications,
        },
      },
      { provide: Title, useValue: { setTitle } },
    ],
  });

  return {
    ...rendered,
    canSendMessage,
    notificationHistory,
    viewNotification,
    deleteNotification,
    connectToNotificationServer,
    sendNotification,
    setTitle,
    confirmDialog,
    deleteViewNotification,
    deleteViewNotifications,
  };
}

describe('NotificationsComponent', () => {
  /**
   * Verifies: init connects to the notification server using the view/team/user guids and token inputs.
   * Interacts with: NotificationService.connectToNotificationServer spy.
   * Data: component inputs viewGuid 'v1', teamGuid 't1', userGuid 'u1', userToken 'tok'.
   */
  it('connects to the notification server on init with the input guids', async () => {
    const { connectToNotificationServer } = await renderNotifications();
    expect(connectToNotificationServer).toHaveBeenCalledWith(
      'v1',
      't1',
      'u1',
      'tok',
    );
  });

  /**
   * Verifies: hasViewAdmin reflects the latest NotificationService.canSendMessage emission.
   * Interacts with: NotificationService.canSendMessage subject, component hasViewAdmin field.
   * Data: canSendMessage emits true.
   */
  it('hasViewAdmin tracks canSendMessage emissions', async () => {
    const { fixture, canSendMessage } = await renderNotifications();
    canSendMessage.next(true);
    expect(fixture.componentInstance.hasViewAdmin).toBe(true);
  });

  /**
   * Verifies: notification history is ordered by broadcastTime descending (newest first).
   * Interacts with: NotificationService.notificationHistory subject, component notificationsHistory.
   * Data: two notifications keyed 1 (Jan 1) and 2 (Jan 2); expects [2, 1].
   */
  it('sorts notification history with the newest broadcastTime first', async () => {
    const { fixture, notificationHistory } = await renderNotifications();
    notificationHistory.next([
      makeNotification({ key: 1, broadcastTime: '2026-01-01T00:00:00Z' }),
      makeNotification({ key: 2, broadcastTime: '2026-01-02T00:00:00Z' }),
    ]);
    expect(
      fixture.componentInstance.notificationsHistory.map((n) => n.key),
    ).toEqual([2, 1]);
  });

  /**
   * Verifies: a live viewNotification emission is prepended to history and bumps the unseen count.
   * Interacts with: NotificationService.viewNotification subject, newNotificationCount signal.
   * Data: makeNotification override key 42; expects count 1 and head key 42.
   */
  it('viewNotification stream prepends a new notification and increments the count', async () => {
    const { fixture, viewNotification } = await renderNotifications();
    viewNotification.next(makeNotification({ key: 42, text: 'new!' }));
    expect(fixture.componentInstance.newNotificationCount()).toBe(1);
    expect(fixture.componentInstance.notificationsHistory[0].key).toBe(42);
  });

  /**
   * Verifies: a SignalR deleteNotification 'all' message empties the local history.
   * Interacts with: NotificationService.deleteNotification subject, notificationsHistory.
   * Data: seed one notification, then emit 'all'.
   */
  it('deleteNotification SignalR "all" clears the history', async () => {
    const { fixture, notificationHistory, deleteNotification } =
      await renderNotifications();
    notificationHistory.next([makeNotification()]);
    deleteNotification.next('all');
    expect(fixture.componentInstance.notificationsHistory).toEqual([]);
  });

  /**
   * Verifies: a SignalR deleteNotification with a key removes only the matching entry.
   * Interacts with: NotificationService.deleteNotification subject, notificationsHistory.
   * Data: seed keys 1 and 2, emit '1'; expects [2] remaining.
   */
  it('deleteNotification SignalR by key removes that entry', async () => {
    const { fixture, notificationHistory, deleteNotification } =
      await renderNotifications();
    notificationHistory.next([
      makeNotification({ key: 1 }),
      makeNotification({ key: 2 }),
    ]);
    deleteNotification.next('1');
    expect(
      fixture.componentInstance.notificationsHistory.map((n) => n.key),
    ).toEqual([2]);
  });

  /**
   * Verifies: setNewNotificationCount updates the browser title and pluralizes Alert/Alerts by count.
   * Interacts with: Title.setTitle spy, component setNewNotificationCount.
   * Data: counts 0 (no suffix), 1 (singular), 3 (plural) against AppTitle 'Player'.
   */
  it('setNewNotificationCount updates the browser title', async () => {
    const { fixture, setTitle } = await renderNotifications();
    fixture.componentInstance.setNewNotificationCount(0);
    expect(setTitle).toHaveBeenLastCalledWith('Player');
    fixture.componentInstance.setNewNotificationCount(1);
    expect(setTitle).toHaveBeenLastCalledWith('Player (1 Alert)');
    fixture.componentInstance.setNewNotificationCount(3);
    expect(setTitle).toHaveBeenLastCalledWith('Player (3 Alerts)');
  });

  /**
   * Verifies: closing the panel hides it, marks every notification seen, and resets the count to zero.
   * Interacts with: notificationPanelToggle, notificationsHistory, newNotificationCount signal.
   * Data: seed one notification with count 5, then toggle 'close'.
   */
  it('notificationPanelToggle("close") marks all seen and resets count', async () => {
    const { fixture, notificationHistory } = await renderNotifications();
    notificationHistory.next([makeNotification({ key: 1 })]);
    fixture.componentInstance.setNewNotificationCount(5);
    fixture.componentInstance.notificationPanelToggle('close');
    expect(fixture.componentInstance.showSystemNotifications).toBe(false);
    expect(
      fixture.componentInstance.notificationsHistory.every((n) => n.wasSeen),
    ).toBe(true);
    expect(fixture.componentInstance.newNotificationCount()).toBe(0);
  });

  /**
   * Verifies: notificationDisplayClass returns 'blink' when the panel is closed and there are unseen alerts.
   * Interacts with: component showSystemNotifications flag, notificationDisplayClass computed.
   * Data: showSystemNotifications false with count 2.
   */
  it('notificationDisplayClass returns "blink" when conditions met', async () => {
    const { fixture } = await renderNotifications();
    fixture.componentInstance.showSystemNotifications = false;
    fixture.componentInstance.setNewNotificationCount(2);
    expect(fixture.componentInstance.notificationDisplayClass()).toBe('blink');
  });

  /**
   * Verifies: notificationDisplayClass returns '' (no blink) while the panel is open even with unseen alerts.
   * Interacts with: component showSystemNotifications flag, notificationDisplayClass computed.
   * Data: showSystemNotifications true with count 2.
   */
  it('notificationDisplayClass returns empty when panel is open', async () => {
    const { fixture } = await renderNotifications();
    fixture.componentInstance.showSystemNotifications = true;
    fixture.componentInstance.setNewNotificationCount(2);
    expect(fixture.componentInstance.notificationDisplayClass()).toBe('');
  });

  /**
   * Verifies: sendMessage sends only after dialog confirm, truncates to 225 chars, and clears the input.
   * Interacts with: DialogService.confirm stub, NotificationService.sendNotification spy.
   * Data: confirm true; messageToSend of 250 'x' chars; expects sent 225 chars and cleared field.
   */
  it('sendMessage only sends after confirm and trims long messages', async () => {
    const { fixture, sendNotification } = await renderNotifications({
      confirm: true,
    });
    fixture.componentInstance.messageToSend = 'x'.repeat(250);
    fixture.componentInstance.sendMessage();
    expect(sendNotification).toHaveBeenCalledWith('v1', 'x'.repeat(225));
    expect(fixture.componentInstance.messageToSend).toBe('');
  });

  /**
   * Verifies: sendMessage does nothing when the message is only whitespace.
   * Interacts with: NotificationService.sendNotification spy.
   * Data: messageToSend '   '.
   */
  it('sendMessage is a no-op on empty input', async () => {
    const { fixture, sendNotification } = await renderNotifications();
    fixture.componentInstance.messageToSend = '   ';
    fixture.componentInstance.sendMessage();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  /**
   * Verifies: deleting a single notification calls ViewService.deleteNotification with the view id and key after confirm.
   * Interacts with: DialogService.confirm stub, ViewService.deleteNotification spy.
   * Data: confirm true; seeded notification key 7; expects call ('v1', 7).
   */
  it('deleteNotification(n) calls ViewService.deleteNotification after confirm', async () => {
    const { fixture, deleteViewNotification } = await renderNotifications({
      confirm: true,
    });
    fixture.componentInstance.notificationsHistory = [
      makeNotification({ key: 7 }),
    ];
    fixture.componentInstance.deleteNotification(makeNotification({ key: 7 }));
    expect(deleteViewNotification).toHaveBeenCalledWith('v1', 7);
  });

  /**
   * Verifies: deleting all notifications calls ViewService.deleteViewNotifications and empties local history after confirm.
   * Interacts with: DialogService.confirm stub, ViewService.deleteViewNotifications spy.
   * Data: confirm true; seeded one notification; expects call ('v1') and cleared history.
   */
  it('deleteViewNotifications clears history after confirm', async () => {
    const { fixture, deleteViewNotifications } = await renderNotifications({
      confirm: true,
    });
    fixture.componentInstance.notificationsHistory = [makeNotification()];
    fixture.componentInstance.deleteViewNotifications();
    expect(deleteViewNotifications).toHaveBeenCalledWith('v1');
    expect(fixture.componentInstance.notificationsHistory).toEqual([]);
  });

  /**
   * Verifies: openLink delegates to window.open with the URL and a _blank target.
   * Interacts with: window.open spy, component openLink.
   * Data: url 'https://example.test'.
   */
  it('openLink opens the link in a new browser tab', async () => {
    const { fixture } = await renderNotifications();
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    fixture.componentInstance.openLink('https://example.test');
    expect(open).toHaveBeenCalledWith('https://example.test', '_blank');
  });

  describe('playBeep()', () => {
    /**
     * Verifies: playBeep plays the audio element when useBeep is enabled.
     * Interacts with: HTMLMediaElement.prototype.play spy, component playBeep.
     * Data: useBeep true.
     */
    it('plays the beep audio when useBeep is enabled', async () => {
      const { fixture } = await renderNotifications();
      const play = vi
        .spyOn(window.HTMLMediaElement.prototype, 'play')
        .mockResolvedValue(undefined);
      fixture.componentInstance.useBeep = true;
      fixture.componentInstance.playBeep();
      expect(play).toHaveBeenCalled();
    });

    /**
     * Verifies: playBeep does not play audio when useBeep is disabled.
     * Interacts with: HTMLMediaElement.prototype.play spy, component playBeep.
     * Data: useBeep false.
     */
    it('does nothing when useBeep is disabled', async () => {
      const { fixture } = await renderNotifications();
      const play = vi
        .spyOn(window.HTMLMediaElement.prototype, 'play')
        .mockResolvedValue(undefined);
      fixture.componentInstance.useBeep = false;
      fixture.componentInstance.playBeep();
      expect(play).not.toHaveBeenCalled();
    });
  });

  describe('admin-only send message form', () => {
    const SEND_BUTTON = 'button[aria-label="Send"]';

    function messageInput(container: Element): HTMLInputElement {
      const input = container.querySelector<HTMLInputElement>(
        'input[name="messageToSend"]',
      );
      if (!input) {
        throw new Error('The message input was not rendered');
      }
      return input;
    }

    function sendButton(container: Element): HTMLButtonElement {
      const button = container.querySelector<HTMLButtonElement>(SEND_BUTTON);
      if (!button) {
        throw new Error('The Send button was not rendered');
      }
      return button;
    }

    /**
     * Verifies: the send-message form stays out of the DOM for a user without view admin.
     * Interacts with: the template's @if (hasViewAdmin) gate; NotificationService.canSendMessage.
     * Data: default renderNotifications() — canSendMessage stays false.
     * Why: the form broadcasts to everyone in the view, so the gate is what keeps non-admins out of it.
     */
    it('hides the form from a user without view admin', async () => {
      const { container } = await renderNotifications();
      expect(container.querySelector('form')).toBeNull();
      expect(container.querySelector(SEND_BUTTON)).toBeNull();
    });

    /**
     * Verifies: what the user types reaches messageToSend and submitting the form broadcasts it.
     * Interacts with: the rendered message input ([(ngModel)]) and Send button; the form's
     *   (ngSubmit) binding; NotificationService.sendNotification spy.
     * Data: viewAdmin true; 'broadcast me' typed into the message box.
     * Why: pins (ngSubmit)="sendMessage()" and the ngModel binding — every method-level sendMessage
     *   test passes with both removed from the template.
     */
    it('submitting the form broadcasts the typed message', async () => {
      const { container, fixture, sendNotification } =
        await renderNotifications({ viewAdmin: true });
      const input = messageInput(container);
      input.value = 'broadcast me';
      input.dispatchEvent(new Event('input'));
      expect(fixture.componentInstance.messageToSend).toBe('broadcast me');
      await fixture.whenStable();

      sendButton(container).click();
      await fixture.whenStable();
      expect(sendNotification).toHaveBeenCalledWith('v1', 'broadcast me');
    });

    /**
     * Verifies: the Send button is enabled while the form is valid.
     * Interacts with: the Send button's [disabled]="!notificationForm.form.valid" binding.
     * Data: viewAdmin true, empty message box.
     * Why: the input carries no validators, so this binding only has two reachable states —
     *   enabled (current behavior) and permanently disabled (inverted or hardcoded). This catches
     *   the second, which would silently take the broadcast feature away from admins.
     */
    it('leaves the Send button enabled while the form is valid', async () => {
      const { container } = await renderNotifications({ viewAdmin: true });
      expect(sendButton(container).disabled).toBe(false);
    });
  });
});
