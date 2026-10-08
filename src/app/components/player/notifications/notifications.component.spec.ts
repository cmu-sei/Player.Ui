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
    useBeep?: boolean;
  } = {},
) {
  const { confirm = true, viewAdmin = false, useBeep = false } = overrides;

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
              useBeep,
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

/** Texts of the rendered notifications, in render order. */
function renderedMessages(container: Element): string[] {
  return Array.from(container.querySelectorAll('#message')).map(
    (message) => message.textContent?.trim() ?? '',
  );
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
   * Verifies: the history arrives newest first in the rendered list.
   * Interacts with: NotificationService.notificationHistory; the rendered messages.
   * Data: 'older' (Jan 1) and 'newer' (Jan 2), sent oldest first.
   */
  it('lists the notification history newest first', async () => {
    const { fixture, container, notificationHistory } =
      await renderNotifications();
    notificationHistory.next([
      makeNotification({
        key: 1,
        text: 'older',
        broadcastTime: '2026-01-01T00:00:00Z',
      }),
      makeNotification({
        key: 2,
        text: 'newer',
        broadcastTime: '2026-01-02T00:00:00Z',
      }),
    ]);
    fixture.detectChanges();
    expect(renderedMessages(container)).toEqual(['newer', 'older']);
  });

  /**
   * Verifies: a live notification goes to the top of the list, sets the badge and the browser title to the unseen
   *   count, and makes the closed panel's header blink.
   * Interacts with: NotificationService.viewNotification; the rendered list, badge and header; Title.setTitle.
   * Data: history 'older'; two live notifications 'first' and 'second' while the panel is closed.
   */
  it('puts live notifications on top and counts them as unseen', async () => {
    const {
      fixture,
      container,
      notificationHistory,
      viewNotification,
      setTitle,
    } = await renderNotifications();
    notificationHistory.next([makeNotification({ key: 1, text: 'older' })]);
    viewNotification.next(makeNotification({ key: 2, text: 'first' }));
    fixture.detectChanges();
    expect(setTitle).toHaveBeenLastCalledWith('Player (1 Alert)');
    viewNotification.next(makeNotification({ key: 3, text: 'second' }));
    fixture.detectChanges();
    expect(renderedMessages(container)).toEqual(['second', 'first', 'older']);
    expect(setTitle).toHaveBeenLastCalledWith('Player (2 Alerts)');
    expect(container.querySelector('.mat-badge-content')).toHaveTextContent(
      '2',
    );
    expect(container.querySelector('mat-expansion-panel-header')).toHaveClass(
      'blink',
    );
  });

  /**
   * Verifies: opening the panel stops the blink, and closing it marks everything seen and clears the count and title.
   * Interacts with: the rendered panel header (clicked to open and close); Title.setTitle.
   * Data: one live notification while the panel is closed.
   */
  it('clears the unseen count when the panel is opened and closed', async () => {
    const user = userEvent.setup();
    const { fixture, container, viewNotification, setTitle } =
      await renderNotifications();
    viewNotification.next(makeNotification({ key: 2, text: 'first' }));
    fixture.detectChanges();
    const header = container.querySelector('mat-expansion-panel-header')!;
    await user.click(screen.getByText('Notifications'));
    expect(header).not.toHaveClass('blink');
    expect(setTitle).toHaveBeenLastCalledWith('Player (1 Alert)');
    await user.click(screen.getByText('Notifications'));
    expect(setTitle).toHaveBeenLastCalledWith('Player');
    expect(header).not.toHaveClass('blink');
    expect(fixture.componentInstance.notificationsHistory[0].wasSeen).toBe(
      true,
    );
  });

  /**
   * Verifies: a hub delete of 'all' empties the rendered list, and a delete by key removes only that notification.
   * Interacts with: NotificationService.deleteNotification; the rendered messages.
   * Data: one row per payload: 'all', and the int key 1 as the API sends it
   *   (player.api Features/Views/Requests/DeleteNotification.cs:61).
   */
  it.each<[string, string | number, string[]]>([
    ['all', 'all', []],
    ['the int key 1', 1, ['two']],
  ])(
    'removes notifications on a hub delete of %s',
    async (_payload, key, remaining) => {
      const { fixture, container, notificationHistory, deleteNotification } =
        await renderNotifications();
      notificationHistory.next([
        makeNotification({
          key: 1,
          text: 'one',
          broadcastTime: '2026-01-02T00:00:00Z',
        }),
        makeNotification({
          key: 2,
          text: 'two',
          broadcastTime: '2026-01-01T00:00:00Z',
        }),
      ]);
      // NotificationService.deleteNotification is typed string; the hub
      // forwards the API's payload unchanged.
      deleteNotification.next(key as string);
      fixture.detectChanges();
      expect(renderedMessages(container)).toEqual(remaining);
    },
  );

  /**
   * Verifies: a notification with a link renders an Open link to it in a new tab.
   * Interacts with: the rendered notification list.
   * Data: link 'https://example.test'.
   */
  it('renders an Open link for a notification with a link', async () => {
    const { fixture, notificationHistory } = await renderNotifications();
    notificationHistory.next([
      makeNotification({ link: 'https://example.test' }),
    ]);
    fixture.detectChanges();
    const link = screen.getByText('Open');
    expect(link).toHaveAttribute('href', 'https://example.test');
    expect(link).toHaveAttribute('target', '_blank');
  });

  /**
   * Verifies: openLink, which the browser notification's onclick calls, opens the link in a new tab.
   * Interacts with: window.open spy; jsdom has no Notification API, so the method is called directly.
   * Data: url 'https://example.test'.
   */
  it('openLink opens the link in a new browser tab', async () => {
    const { fixture } = await renderNotifications();
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    fixture.componentInstance.openLink('https://example.test');
    expect(open).toHaveBeenCalledWith('https://example.test', '_blank');
  });

  /**
   * Verifies: a live notification beeps only when the useBeep setting is on.
   * Interacts with: ComnSettingsService NotificationsSettings.useBeep; NotificationService.viewNotification;
   *   HTMLMediaElement.prototype.play spy.
   * Data: one row per setting.
   */
  it.each([
    [true, 1],
    [false, 0],
  ])(
    'with useBeep %s beeps %i time(s) on a live notification',
    async (useBeep, beeps) => {
      const play = vi
        .spyOn(window.HTMLMediaElement.prototype, 'play')
        .mockResolvedValue(undefined);
      const { viewNotification } = await renderNotifications({ useBeep });
      viewNotification.next(makeNotification({ key: 9 }));
      expect(play).toHaveBeenCalledTimes(beeps);
    },
  );

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
      const { user, sendNotification, confirmDialog } = await renderOpenPanel({
        viewAdmin: true,
        confirm: true,
      });
      const input = screen.getByPlaceholderText(/send system wide/i);
      await user.click(input);
      await user.paste('x'.repeat(250));
      await user.click(screen.getByRole('button', { name: 'Send' }));
      expect(confirmDialog).toHaveBeenCalled();
      expect(sendNotification).toHaveBeenCalledWith('v1', 'x'.repeat(225));
      expect(input).toHaveValue('');
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

    /**
     * Verifies: the delete icons appear once the hub reports that the user may post (canPost true), and are absent before.
     * Interacts with: NotificationService.canSendMessage (fed by the hub's System message); the rendered icons.
     * Data: viewAdmin false at first; history holds one notification; canSendMessage then emits true.
     */
    it('shows the delete icons once the hub grants posting', async () => {
      const { fixture, canSendMessage } = await renderOpenPanel(
        { viewAdmin: false },
        [makeNotification()],
      );
      expect(
        screen.queryByTitle('Delete notification'),
      ).not.toBeInTheDocument();
      canSendMessage.next(true);
      fixture.detectChanges();
      expect(screen.getByTitle('Delete notification')).toBeInTheDocument();
      expect(screen.getByTitle('Delete ALL notifications')).toBeInTheDocument();
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
     */
    it('submitting the form broadcasts the typed message', async () => {
      const user = userEvent.setup();
      const { container, sendNotification } = await renderNotifications({
        viewAdmin: true,
      });
      const input = messageInput(container);
      input.focus();
      await user.type(input, 'broadcast me{Enter}', { skipClick: true });
      expect(sendNotification).toHaveBeenCalledExactlyOnceWith(
        'v1',
        'broadcast me',
      );
      expect(input.value).toBe('');
    });

    /**
     * Verifies: the Send button is enabled while the form is valid.
     * Interacts with: the Send button's [disabled]="!notificationForm.form.valid" binding.
     * Data: viewAdmin true, empty message box.
     */
    it('leaves the Send button enabled while the form is valid', async () => {
      const { container } = await renderNotifications({ viewAdmin: true });
      expect(sendButton(container).disabled).toBe(false);
    });
  });
});
