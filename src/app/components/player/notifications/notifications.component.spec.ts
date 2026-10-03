// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Title } from '@angular/platform-browser';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { BehaviorSubject, of } from 'rxjs';
import {
  ComnSettingsService,
  CrucibleDialogService,
} from '@cmusei/crucible-common';
import { NotificationService } from '../../../services/notification/notification.service';
import { ViewService } from '../../../generated/player-api/api/view.service';
import {
  NotificationData,
  NotificationDataStatus,
} from '../../../models/notification-data';
import { NotificationsComponent } from './notifications.component';
import { renderComponent } from '../../../test-utils/render-component';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { ApiStub } from '../../../test-utils/api-stub';
import { dialogRefStub } from '../../../test-utils/dialog-refs';

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
  // Seeded like the real NotificationService: an empty notification and an
  // empty key, both of which the component ignores.
  const viewNotification = new BehaviorSubject<NotificationData>(
    {} as NotificationData,
  );
  const deleteNotification = new BehaviorSubject<string>('');
  const connectToNotificationServer = vi.fn();
  const sendNotification = vi.fn();

  const setTitle = vi.fn();
  const confirmDialog = vi.fn(
    () => dialogRefStub<unknown, boolean>(confirm).dialogRef,
  );

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
        } satisfies Pick<
          NotificationService,
          | 'canSendMessage'
          | 'notificationHistory'
          | 'viewNotification'
          | 'deleteNotification'
          | 'connectToNotificationServer'
          | 'sendNotification'
        >,
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
        useValue: { confirm: confirmDialog } satisfies Pick<
          CrucibleDialogService,
          'confirm'
        >,
      },
      {
        provide: ViewService,
        useValue: {
          deleteNotification: deleteViewNotification,
          deleteViewNotifications,
        } satisfies ApiStub<ViewService>,
      },
      {
        provide: Title,
        useValue: { setTitle } satisfies Pick<Title, 'setTitle'>,
      },
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
   * Data: seed keys 1 and 2, emit the int key 1 as the API sends it
   *   (player.api Features/Views/Requests/DeleteNotification.cs:61); expects [2] remaining.
   */
  it('deleteNotification SignalR by key removes that entry', async () => {
    const { fixture, notificationHistory, deleteNotification } =
      await renderNotifications();
    notificationHistory.next([
      makeNotification({ key: 1 }),
      makeNotification({ key: 2 }),
    ]);
    // NotificationService.deleteNotification is typed string, but the hub
    // forwards the API's int key unchanged; the component compares with +key.
    deleteNotification.next(1 as unknown as string);
    expect(
      fixture.componentInstance.notificationsHistory.map((n) => n.key),
    ).toEqual([2]);
  });

  /**
   * Verifies: setNewNotificationCount sets the browser title, with no suffix at 0 and Alert/Alerts by count.
   * Interacts with: Title.setTitle spy, component setNewNotificationCount.
   * Data: one row per count against AppTitle 'Player'.
   */
  it.each([
    [0, 'Player'],
    [1, 'Player (1 Alert)'],
    [3, 'Player (3 Alerts)'],
  ])(
    'setNewNotificationCount(%i) sets the title to "%s"',
    async (count, title) => {
      const { fixture, setTitle } = await renderNotifications();
      fixture.componentInstance.setNewNotificationCount(count);
      expect(setTitle).toHaveBeenLastCalledWith(title);
    },
  );

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

  describe('admin actions in the open panel', () => {
    /**
     * Renders, seeds the history through the NotificationService stream, and
     * opens the panel by clicking its header, as the user does.
     */
    async function renderOpenPanel(
      overrides: { viewAdmin: boolean; confirm?: boolean },
      history: NotificationDataStatus[] = [],
    ) {
      const rendered = await renderNotifications(overrides);
      rendered.notificationHistory.next(history);
      rendered.fixture.detectChanges();
      const user = userEvent.setup();
      await user.click(screen.getByText('Notifications'));
      return { ...rendered, user };
    }

    /**
     * Verifies: sending from the form asks for confirmation, sends at most 225 characters, and clears the input.
     * Interacts with: the rendered message input and Send button; CrucibleDialogService.confirm stub;
     *   NotificationService.sendNotification spy.
     * Data: viewAdmin true; confirm true; 250 'x' characters pasted into the message box.
     */
    it('sends a confirmed message trimmed to 225 characters', async () => {
      const { fixture, user, sendNotification, confirmDialog } =
        await renderOpenPanel({ viewAdmin: true, confirm: true });
      await user.click(screen.getByPlaceholderText(/send system wide/i));
      await user.paste('x'.repeat(250));
      await user.click(screen.getByRole('button', { name: 'Send' }));
      expect(confirmDialog).toHaveBeenCalled();
      expect(sendNotification).toHaveBeenCalledWith('v1', 'x'.repeat(225));
      expect(fixture.componentInstance.messageToSend).toBe('');
    });

    /**
     * Verifies: sending a whitespace-only message from the form does nothing.
     * Interacts with: the rendered message input and Send button; NotificationService.sendNotification spy.
     * Data: viewAdmin true; '   ' pasted into the message box.
     */
    it('does not send a whitespace-only message', async () => {
      const { user, sendNotification } = await renderOpenPanel({
        viewAdmin: true,
      });
      await user.click(screen.getByPlaceholderText(/send system wide/i));
      await user.paste('   ');
      await user.click(screen.getByRole('button', { name: 'Send' }));
      expect(sendNotification).not.toHaveBeenCalled();
    });

    /**
     * Verifies: a notification's trash icon deletes it through ViewService.deleteNotification after confirm.
     * Interacts with: the rendered "Delete notification" icon; CrucibleDialogService.confirm stub;
     *   ViewService.deleteNotification spy.
     * Data: viewAdmin true; confirm true; history holds notification key 7.
     */
    it('deletes a notification from its trash icon after confirm', async () => {
      const { user, deleteViewNotification } = await renderOpenPanel(
        { viewAdmin: true, confirm: true },
        [makeNotification({ key: 7 })],
      );
      await user.click(screen.getByTitle('Delete notification'));
      expect(deleteViewNotification).toHaveBeenCalledWith('v1', 7);
    });

    /**
     * Verifies: the Delete ALL icon clears the view's notifications after confirm and empties the list.
     * Interacts with: the rendered "Delete ALL notifications" icon; CrucibleDialogService.confirm stub;
     *   ViewService.deleteViewNotifications spy.
     * Data: viewAdmin true; confirm true; history holds one notification ('hello').
     */
    it('clears the history from the Delete ALL icon after confirm', async () => {
      const { user, deleteViewNotifications } = await renderOpenPanel(
        { viewAdmin: true, confirm: true },
        [makeNotification()],
      );
      await user.click(screen.getByTitle('Delete ALL notifications'));
      expect(deleteViewNotifications).toHaveBeenCalledWith('v1');
      expect(screen.queryByText('hello')).not.toBeInTheDocument();
    });

    /**
     * Verifies: a user without view admin sees the history but neither delete icon.
     * Interacts with: the template's @if (hasViewAdmin) gates; NotificationService.canSendMessage.
     * Data: viewAdmin false (canSendMessage false, what the hub sends a non-admin); history holds one notification.
     */
    it('shows no delete icons to a user without view admin', async () => {
      await renderOpenPanel({ viewAdmin: false }, [makeNotification()]);
      expect(screen.getByText('hello')).toBeInTheDocument();
      expect(
        screen.queryByTitle('Delete notification'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTitle('Delete ALL notifications'),
      ).not.toBeInTheDocument();
    });
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
