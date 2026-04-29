// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { ComnSettingsService } from '@cmusei/crucible-common';
import { DialogService } from '../../../services/dialog/dialog.service';
import { NotificationService } from '../../../services/notification/notification.service';
import { ViewService } from '../../../generated/player-api/api/view.service';
import { NotificationDataStatus } from '../../../models/notification-data';
import { NotificationsComponent } from './notifications.component';
import { renderComponent } from '../../../test-utils/render-component';

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
  } = {},
) {
  const { confirm = true } = overrides;

  const canSendMessage = new BehaviorSubject<boolean>(false);
  const notificationHistory = new BehaviorSubject<NotificationDataStatus[]>([]);
  const viewNotification = new Subject<Partial<NotificationDataStatus>>();
  const deleteNotification = new Subject<string>();
  const connectToNotificationServer = vi.fn();
  const sendNotification = vi.fn();

  const setTitle = vi.fn();
  const confirmDialog = vi.fn(() => of({ confirm }));

  const deleteViewNotification = vi.fn(() => of(undefined));
  const deleteViewNotifications = vi.fn(() => of(undefined));

  const rendered = await renderComponent(NotificationsComponent, {
    declarations: [NotificationsComponent],
    schemas: [NO_ERRORS_SCHEMA],
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
      { provide: DialogService, useValue: { confirm: confirmDialog } },
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
  it('creates the component', async () => {
    const { fixture } = await renderNotifications();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('connects to the notification server on init with the input guids', async () => {
    const { connectToNotificationServer } = await renderNotifications();
    expect(connectToNotificationServer).toHaveBeenCalledWith(
      'v1',
      't1',
      'u1',
      'tok',
    );
  });

  it('hasViewAdmin tracks canSendMessage emissions', async () => {
    const { fixture, canSendMessage } = await renderNotifications();
    canSendMessage.next(true);
    expect(fixture.componentInstance.hasViewAdmin).toBe(true);
  });

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

  it('viewNotification stream prepends a new notification and increments the count', async () => {
    const { fixture, viewNotification } = await renderNotifications();
    viewNotification.next(makeNotification({ key: 42, text: 'new!' }));
    expect(fixture.componentInstance.newNotificationCount()).toBe(1);
    expect(fixture.componentInstance.notificationsHistory[0].key).toBe(42);
  });

  it('deleteNotification SignalR "all" clears the history', async () => {
    const { fixture, notificationHistory, deleteNotification } =
      await renderNotifications();
    notificationHistory.next([makeNotification()]);
    deleteNotification.next('all');
    expect(fixture.componentInstance.notificationsHistory).toEqual([]);
  });

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

  it('setNewNotificationCount updates the browser title', async () => {
    const { fixture, setTitle } = await renderNotifications();
    fixture.componentInstance.setNewNotificationCount(0);
    expect(setTitle).toHaveBeenLastCalledWith('Player');
    fixture.componentInstance.setNewNotificationCount(1);
    expect(setTitle).toHaveBeenLastCalledWith('Player (1 Alert)');
    fixture.componentInstance.setNewNotificationCount(3);
    expect(setTitle).toHaveBeenLastCalledWith('Player (3 Alerts)');
  });

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

  it('notificationDisplayClass returns "blink" when conditions met', async () => {
    const { fixture } = await renderNotifications();
    fixture.componentInstance.showSystemNotifications = false;
    fixture.componentInstance.setNewNotificationCount(2);
    expect(fixture.componentInstance.notificationDisplayClass()).toBe('blink');
  });

  it('notificationDisplayClass returns empty when panel is open', async () => {
    const { fixture } = await renderNotifications();
    fixture.componentInstance.showSystemNotifications = true;
    fixture.componentInstance.setNewNotificationCount(2);
    expect(fixture.componentInstance.notificationDisplayClass()).toBe('');
  });

  it('sendMessage only sends after confirm and trims long messages', async () => {
    const { fixture, sendNotification } = await renderNotifications({
      confirm: true,
    });
    fixture.componentInstance.messageToSend = 'x'.repeat(250);
    fixture.componentInstance.sendMessage();
    expect(sendNotification).toHaveBeenCalledWith('v1', 'x'.repeat(225));
    expect(fixture.componentInstance.messageToSend).toBe('');
  });

  it('sendMessage is a no-op on empty input', async () => {
    const { fixture, sendNotification } = await renderNotifications();
    fixture.componentInstance.messageToSend = '   ';
    fixture.componentInstance.sendMessage();
    expect(sendNotification).not.toHaveBeenCalled();
  });

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

  it('deleteViewNotifications clears history after confirm', async () => {
    const { fixture, deleteViewNotifications } = await renderNotifications({
      confirm: true,
    });
    fixture.componentInstance.notificationsHistory = [makeNotification()];
    fixture.componentInstance.deleteViewNotifications();
    expect(deleteViewNotifications).toHaveBeenCalledWith('v1');
    expect(fixture.componentInstance.notificationsHistory).toEqual([]);
  });
});
