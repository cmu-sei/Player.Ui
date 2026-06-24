// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ComnAuthService, ComnSettingsService } from '@cmusei/crucible-common';
import { NotificationService } from './notification.service';
import { NotificationData } from '../../models/notification-data';
import { ViewPresence } from '../../models/view-presence';

// @microsoft/signalr is mocked so connectToNotificationServer()/joinPresence()
// build fake hub connections instead of opening real WebSockets. Each fake
// records its registered handlers (so a test can trigger a server event) and
// its invoke() calls (so a test can assert what was sent to the hub).
const { connections } = vi.hoisted(() => ({
  connections: [] as FakeHubConnection[],
}));

class FakeHubConnection {
  handlers: Record<string, (data: unknown) => void> = {};
  reconnectedCallbacks: Array<() => void> = [];
  invokeResult: unknown = undefined;
  invoke = vi.fn(() => Promise.resolve(this.invokeResult));
  start = vi.fn(() => Promise.resolve());

  on(event: string, cb: (data: unknown) => void) {
    this.handlers[event] = cb;
  }
  onreconnected(cb: () => void) {
    this.reconnectedCallbacks.push(cb);
  }
  // Test helper: simulate the hub pushing an event to this connection.
  trigger(event: string, data: unknown) {
    return this.handlers[event]?.(data);
  }
}

vi.mock('@microsoft/signalr', () => {
  class HubConnectionBuilder {
    withUrl() {
      return this;
    }
    withAutomaticReconnect() {
      return this;
    }
    withStatefulReconnect() {
      return this;
    }
    build() {
      const connection = new FakeHubConnection();
      connections.push(connection);
      return connection;
    }
  }
  return { HubConnectionBuilder };
});

// Flush pending microtasks so the start().then(...) chains run.
const flush = () => new Promise((r) => setTimeout(r));

function createService(overrides: { token?: string } = {}) {
  const { token = 'auth-token' } = overrides;

  TestBed.configureTestingModule({
    providers: [
      {
        provide: ComnSettingsService,
        useValue: {
          settings: { NotificationsSettings: { url: 'https://notify.test' } },
        },
      },
      {
        provide: ComnAuthService,
        useValue: { getAuthorizationToken: () => token },
      },
      NotificationService,
    ],
  });

  return TestBed.inject(NotificationService);
}

function makeData(overrides: Partial<NotificationData> = {}): NotificationData {
  return {
    key: 1,
    broadcastTime: '2026-01-01T00:00:00Z',
    subject: 'Subject',
    text: 'body',
    iconUrl: 'icon.png',
    priority: 'Normal',
    canPost: false,
    ...overrides,
  } as NotificationData;
}

describe('NotificationService', () => {
  beforeEach(() => {
    connections.length = 0;
    // The service logs connection lifecycle to the console; keep test output clean.
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('connectToNotificationServer()', () => {
    /**
     * Verifies: connecting builds exactly three hub connections (view/team/user), starts each, and stores them on the service
     * Interacts with: the mocked @microsoft/signalr HubConnectionBuilder producing FakeHubConnections; service.connectToNotificationServer
     * Data: view/team/user/token identifiers ('v1','t1','u1','tok')
     * Why: the signalr module is mocked so build() records FakeHubConnections in the shared connections array instead of opening real WebSockets
     */
    it('builds view, team, and user connections and starts each', async () => {
      const service = createService();
      service.connectToNotificationServer('v1', 't1', 'u1', 'tok');
      expect(connections).toHaveLength(3);
      const [view, team, user] = connections;
      expect(view.start).toHaveBeenCalled();
      expect(team.start).toHaveBeenCalled();
      expect(user.start).toHaveBeenCalled();
      expect(service.viewConnection).toBe(view);
      expect(service.teamConnection).toBe(team);
      expect(service.userConnection).toBe(user);
    });

    /**
     * Verifies: after the view connection's start() resolves, the service invokes 'Join' and 'GetHistory' with the view id
     * Interacts with: FakeHubConnection.invoke spy; service.connectToNotificationServer
     * Data: view id 'v1'; flush() drains microtasks so the start().then chain runs
     * Why: flush() (setTimeout) is needed because the Join/GetHistory calls happen inside start().then(...)
     */
    it('joins and requests history once the view connection starts', async () => {
      const service = createService();
      service.connectToNotificationServer('v1', 't1', 'u1', 'tok');
      await flush();
      const [view] = connections;
      expect(view.invoke).toHaveBeenCalledWith('Join', 'v1');
      expect(view.invoke).toHaveBeenCalledWith('GetHistory', 'v1');
    });

    /**
     * Verifies: a hub-pushed 'Reply' event passes validation and is emitted on viewNotification
     * Interacts with: FakeHubConnection.trigger (simulated server push); service.viewNotification
     * Data: a valid NotificationData built by makeData with key 99
     */
    it('routes a view "Reply" event through validation to viewNotification', async () => {
      const service = createService();
      service.connectToNotificationServer('v1', 't1', 'u1', 'tok');
      const [view] = connections;
      view.trigger('Reply', makeData({ key: 99, text: 'hi' }));
      const received = await firstValueFrom(service.viewNotification);
      expect(received.key).toBe(99);
    });

    /**
     * Verifies: a 'History' event is forwarded as-is to the notificationHistory stream
     * Interacts with: FakeHubConnection.trigger; service.notificationHistory
     * Data: a two-element NotificationData[] history array
     */
    it('routes a "History" event to notificationHistory', async () => {
      const service = createService();
      service.connectToNotificationServer('v1', 't1', 'u1', 'tok');
      const [view] = connections;
      const history = [makeData({ key: 1 }), makeData({ key: 2 })];
      view.trigger('History', history);
      expect(await firstValueFrom(service.notificationHistory)).toBe(history);
    });

    /**
     * Verifies: a 'Delete' event forwards the deleted key to the deleteNotification stream
     * Interacts with: FakeHubConnection.trigger; service.deleteNotification
     * Data: a deleted key string 'key-7'
     */
    it('routes a "Delete" event to deleteNotification', async () => {
      const service = createService();
      service.connectToNotificationServer('v1', 't1', 'u1', 'tok');
      const [view] = connections;
      view.trigger('Delete', 'key-7');
      expect(await firstValueFrom(service.deleteNotification)).toBe('key-7');
    });

    /**
     * Verifies: firing the connection's onreconnected callbacks re-invokes 'Join' with the view id
     * Interacts with: FakeHubConnection.reconnectedCallbacks and invoke spy; service.connectToNotificationServer
     * Data: view id 'v1'; invoke spy cleared before triggering reconnect to isolate the rejoin call
     * Why: invoke.mockClear() drops the initial Join/GetHistory so only the reconnect-driven Join is asserted
     */
    it('rejoins on reconnect', async () => {
      const service = createService();
      service.connectToNotificationServer('v1', 't1', 'u1', 'tok');
      const [view] = connections;
      view.invoke.mockClear();
      view.reconnectedCallbacks.forEach((cb) => cb());
      expect(view.invoke).toHaveBeenCalledWith('Join', 'v1');
    });
  });

  describe('validateNotificationData()', () => {
    /**
     * Verifies: a 'System' priority message is not returned as a notification (null) but flips canSendMessage to its canPost value
     * Interacts with: service.validateNotificationData; service.canSendMessage stream
     * Data: makeData with priority 'System' and canPost true
     */
    it('returns null and updates canSendMessage for System messages', async () => {
      const service = createService();
      const result = service.validateNotificationData(
        makeData({ priority: 'System', canPost: true }),
      );
      expect(result).toBeNull();
      expect(await firstValueFrom(service.canSendMessage)).toBe(true);
    });

    /**
     * Verifies: a notification missing subject/iconUrl (but with broadcastTime) gets default 'Player Notification' subject and alert icon
     * Interacts with: service.validateNotificationData
     * Data: a bare NotificationData literal with only broadcastTime set
     */
    it('defaults a missing subject and iconUrl', () => {
      const service = createService();
      const result = service.validateNotificationData({
        broadcastTime: '2026-01-01T00:00:00Z',
      } as NotificationData);
      expect(result?.subject).toBe('Player Notification');
      expect(result?.iconUrl).toBe('assets/img/SP_Icon_Alert.png');
    });

    /**
     * Verifies: a notification lacking broadcastTime is rejected as invalid (returns null)
     * Interacts with: service.validateNotificationData
     * Data: a NotificationData literal with only a subject, no broadcastTime
     */
    it('returns null when broadcastTime is missing', () => {
      const service = createService();
      const result = service.validateNotificationData({
        subject: 'x',
      } as NotificationData);
      expect(result).toBeNull();
    });

    /**
     * Verifies: a complete, valid notification is returned by identity (same object reference, no mutation)
     * Interacts with: service.validateNotificationData
     * Data: a fully-populated makeData fixture with key 5
     */
    it('passes a fully-formed notification through unchanged', () => {
      const service = createService();
      const data = makeData({ key: 5 });
      expect(service.validateNotificationData(data)).toBe(data);
    });
  });

  describe('sendNotification()', () => {
    /**
     * Verifies: sendNotification invokes 'Post' on the view connection with the view id and message text
     * Interacts with: FakeHubConnection.invoke spy; service.sendNotification
     * Data: view id 'v1' and message 'hello'; invoke cleared after connect so only the Post call is asserted
     */
    it('invokes "Post" on the view connection', () => {
      const service = createService();
      service.connectToNotificationServer('v1', 't1', 'u1', 'tok');
      const [view] = connections;
      view.invoke.mockClear();
      service.sendNotification('v1', 'hello');
      expect(view.invoke).toHaveBeenCalledWith('Post', 'v1', 'hello');
    });
  });

  describe('joinPresence()', () => {
    /**
     * Verifies: with no prior connection, joinPresence builds one, invokes 'JoinPresence', and emits the returned presence list on userPresence$
     * Interacts with: mocked HubConnectionBuilder; FakeHubConnection.invoke (invokeResult seeded); service.userPresence$
     * Data: a single-entry ViewPresence[] returned via the fake's invokeResult
     * Why: invokeResult is set so invoke() resolves to the presence list, and flush() drains the JoinPresence().then chain
     */
    it('builds a presence connection when none exists and emits the presence list', async () => {
      const service = createService();
      const presence: ViewPresence[] = [
        {
          id: 'p1',
          userId: 'u1',
          userName: 'Alice',
          viewId: 'v1',
          online: true,
          teamIds: [],
        },
      ];
      service.joinPresence('v1');
      expect(connections).toHaveLength(1);
      const [view] = connections;
      view.invokeResult = presence;
      await flush();
      expect(view.invoke).toHaveBeenCalledWith('JoinPresence', 'v1');
      expect(await firstValueFrom(service.userPresence$)).toEqual(presence);
    });

    /**
     * Verifies: when a view connection already exists, joinPresence reuses it (no new build) and invokes 'JoinPresence' on it
     * Interacts with: service.viewConnection (existing FakeHubConnection); its invoke spy; service.joinPresence
     * Data: an established connection from connectToNotificationServer; connection count snapshotted before joinPresence
     */
    it('reuses an existing connection instead of building a new one', async () => {
      const service = createService();
      service.connectToNotificationServer('v1', 't1', 'u1', 'tok');
      const builtBefore = connections.length;
      const view = service.viewConnection as unknown as FakeHubConnection;
      view.invoke.mockClear();
      service.joinPresence('v1');
      expect(connections).toHaveLength(builtBefore);
      expect(view.invoke).toHaveBeenCalledWith('JoinPresence', 'v1');
    });

    /**
     * Verifies: a 'PresenceUpdate' event for an existing user mutates that entry's fields (online flips to true) and re-emits the list
     * Interacts with: FakeHubConnection.invoke (initial list) and trigger (the update); service.userPresence$
     * Data: an initial presence entry with online false, then a PresenceUpdate copy with online true
     */
    it('updates an existing presence entry on PresenceUpdate and emits', async () => {
      const service = createService();
      const presence: ViewPresence[] = [
        {
          id: 'p1',
          userId: 'u1',
          userName: 'Alice',
          viewId: 'v1',
          online: false,
          teamIds: [],
        },
      ];
      service.joinPresence('v1');
      const [view] = connections;
      view.invokeResult = presence;
      await flush();

      view.trigger('PresenceUpdate', { ...presence[0], online: true });
      const updated = await firstValueFrom(service.userPresence$);
      expect(updated[0].online).toBe(true);
    });
  });

  describe('leavePresence()', () => {
    /**
     * Verifies: leavePresence invokes 'LeavePresence' with the view id when a connection is present
     * Interacts with: FakeHubConnection.invoke spy; service.leavePresence
     * Data: view id 'v1'; invoke cleared after connect to isolate the LeavePresence call
     */
    it('invokes "LeavePresence" when a connection exists', () => {
      const service = createService();
      service.connectToNotificationServer('v1', 't1', 'u1', 'tok');
      const [view] = connections;
      view.invoke.mockClear();
      service.leavePresence('v1');
      expect(view.invoke).toHaveBeenCalledWith('LeavePresence', 'v1');
    });

    /**
     * Verifies: calling leavePresence with no established connection neither throws nor invokes anything
     * Interacts with: service.leavePresence (guard against a null connection)
     * Data: a freshly created service with no connect call
     */
    it('is a no-op when there is no connection', () => {
      const service = createService();
      expect(() => service.leavePresence('v1')).not.toThrow();
    });
  });
});
