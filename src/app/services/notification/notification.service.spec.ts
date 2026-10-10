// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ComnAuthService, ComnSettingsService } from '@cmusei/crucible-common';
import { NotificationService } from './notification.service';
import { NotificationData } from '../../models/notification-data';
import { ViewPresence } from '../../models/view-presence';
import {
  FakeHubConnection,
  mockHubConnectionBuilder,
  rejectInvokes,
} from '../../test-utils/fake-hub-connection';
import {
  captureUnhandledRejections,
  flush,
} from '../../test-utils/unhandled-rx-errors';

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
        useValue: { getAuthorizationToken: () => token } satisfies Pick<
          ComnAuthService,
          'getAuthorizationToken'
        >,
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
  let connections: FakeHubConnection[];
  let withUrl: ReturnType<typeof mockHubConnectionBuilder>['withUrl'];

  beforeEach(() => {
    ({ connections, withUrl } = mockHubConnectionBuilder());
    // The service logs connection lifecycle to the console; keep test output clean.
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    TestBed.resetTestingModule();
  });

  describe('connectToNotificationServer()', () => {
    /**
     * Verifies: connecting builds exactly three hub connections (view/team/user) on the view, team and user hub URLs
     *   with the bearer token, starts each, and stores them on the service
     * Interacts with: mockHubConnectionBuilder (FakeHubConnections, withUrl spy); service.connectToNotificationServer
     * Data: view/team/user/token identifiers ('v1','t1','u1','tok'); NotificationsSettings.url 'https://notify.test'
     */
    it('builds view, team, and user connections and starts each', async () => {
      const service = createService();
      service.connectToNotificationServer('v1', 't1', 'u1', 'tok');
      expect(connections).toHaveLength(3);
      expect(withUrl.mock.calls.map(([url]) => url)).toEqual([
        'https://notify.test/view?bearer=tok',
        'https://notify.test/team?bearer=tok',
        'https://notify.test/user?bearer=tok',
      ]);
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
     * Verifies: a 'Delete' event forwards the payload the API sends, unchanged, to the deleteNotification stream.
     * Interacts with: FakeHubConnection.trigger; service.deleteNotification
     * Data: one row per API payload: the int key 7 (player.api Features/Views/Requests/DeleteNotification.cs:61)
     *   and 'all' (DeleteAllNotifications.cs:58). The stream is typed string; the component compares with +key.
     */
    it.each<[string, number | string]>([
      ['the int key', 7],
      ['"all"', 'all'],
    ])(
      'routes a "Delete" event with %s to deleteNotification',
      async (_label, payload) => {
        const service = createService();
        service.connectToNotificationServer('v1', 't1', 'u1', 'tok');
        const [view] = connections;
        view.trigger('Delete', payload);
        expect(await firstValueFrom(service.deleteNotification)).toBe(payload);
      },
    );

    /**
     * Verifies: firing the connection's onreconnected callbacks re-invokes 'Join' with the view id
     * Interacts with: FakeHubConnection.reconnect() and invoke spy; service.connectToNotificationServer
     * Data: view id 'v1'; invoke spy cleared before triggering reconnect to isolate the rejoin call
     */
    it('rejoins on reconnect', async () => {
      const service = createService();
      service.connectToNotificationServer('v1', 't1', 'u1', 'tok');
      const [view] = connections;
      view.invoke.mockClear();
      view.reconnect();
      expect(view.invoke).toHaveBeenCalledWith('Join', 'v1');
    });

    /**
     * Verifies: the team connection's reconnect re-invokes 'Join' with the team id
     * Interacts with: the team FakeHubConnection's reconnect() and invoke spy; service.connectToNotificationServer
     * Data: team id 't1'; invoke cleared before the reconnect to isolate the rejoin call
     */
    it('rejoins the team group on team reconnect', async () => {
      const service = createService();
      service.connectToNotificationServer('v1', 't1', 'u1', 'tok');
      const [, team] = connections;
      await flush();
      team.invoke.mockClear();
      team.reconnect();
      expect(team.invoke).toHaveBeenCalledTimes(1);
      expect(team.invoke).toHaveBeenCalledWith('Join', 't1');
    });

    /**
     * Verifies: the user connection's reconnect re-invokes 'Join' with the view and user ids
     * Interacts with: the user FakeHubConnection's reconnect() and invoke spy; service.connectToNotificationServer
     * Data: view id 'v1', user id 'u1'; invoke cleared before the reconnect to isolate the rejoin call
     */
    it('rejoins the user group on user reconnect', async () => {
      const service = createService();
      service.connectToNotificationServer('v1', 't1', 'u1', 'tok');
      const [, , user] = connections;
      await flush();
      user.invoke.mockClear();
      user.reconnect();
      expect(user.invoke).toHaveBeenCalledTimes(1);
      expect(user.invoke).toHaveBeenCalledWith('Join', 'v1', 'u1');
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

    /**
     * Verifies: a rejected 'Post' is caught and logged rather than left as an unhandled rejection
     * Interacts with: FakeHubConnection.invoke spy (made to reject); the console.log spy from beforeEach
     * Data: a rejection standing in for the hub refusing the post; flush() lets the rejection reach the handler
     */
    it('catches a rejected "Post" instead of leaving it unhandled', async () => {
      const service = createService();
      service.connectToNotificationServer('v1', 't1', 'u1', 'tok');
      const [view] = connections;
      view.invoke.mockRejectedValueOnce(new Error('Forbidden'));

      service.sendNotification('v1', 'hello');
      await flush();

      expect(vi.mocked(console.log)).toHaveBeenCalledWith(
        'Error while sending Notification',
      );
    });
  });

  describe('joinPresence()', () => {
    /**
     * Verifies: with no prior connection, joinPresence builds one, invokes 'JoinPresence', and emits the returned presence list on userPresence$
     * Interacts with: mockHubConnectionBuilder; FakeHubConnection.invoke (resolves to the list); service.userPresence$
     * Data: a single-entry ViewPresence[] returned by invoke
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
      view.invoke.mockResolvedValue(presence);
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
     * Verifies: each joinPresence call on an existing connection adds another onreconnected handler,
     *   so one reconnect sends JoinPresence once per earlier call (current behavior)
     * Interacts with: the presence FakeHubConnection's reconnectedCallbacks, reconnect() and invoke spy
     * Data: joinPresence('v1') three times on one service (one build, then two reuses); one reconnect
     */
    it('registers a new onreconnected handler on every joinPresence call', async () => {
      const service = createService();
      service.joinPresence('v1');
      service.joinPresence('v1');
      service.joinPresence('v1');
      const [view] = connections;
      await flush();
      expect(connections).toHaveLength(1);
      view.invoke.mockClear();
      view.reconnect();
      const joins = view.invoke.mock.calls.filter(
        ([method]) => method === 'JoinPresence',
      );
      // Current behavior; see agent-docs/ui-test-bugs/player.ui.md.
      expect(view.reconnectedCallbacks).toHaveLength(3);
      expect(joins).toHaveLength(3);
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
      view.invoke.mockResolvedValue(presence);
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

  describe('hub calls without a .catch', () => {
    type Arrange = (service: NotificationService) => Promise<void> | void;
    type Act = (
      service: NotificationService,
      connection: FakeHubConnection,
    ) => void;
    const connect: Arrange = (service) =>
      service.connectToNotificationServer('v1', 't1', 'u1', 'tok');
    const connected: Arrange = async (service) => {
      connect(service);
      await flush();
    };
    const reconnect: Act = (_service, connection) => connection.reconnect();
    const nothing: Act = () => undefined;

    /**
     * Verifies: a hub method that rejects at each call site escapes as an unhandled rejection (current behavior).
     * Interacts with: the FakeHubConnection at `connection` (0 view, 1 team, 2 user; 0 is also the presence
     *   connection), whose invoke is replaced by rejectInvokes; captureUnhandledRejections.
     * Data: view 'v1', team 't1', user 'u1'; `arrange` builds and (where needed) starts the connections,
     *   then every invoke on the chosen connection rejects with `<method> failed` before `act` runs.
     */
    it.each<[string, Arrange, number, Act, Array<[string, ...unknown[]]>]>([
      [
        'view Join and GetHistory after start',
        connect,
        0,
        nothing,
        [
          ['Join', 'v1'],
          ['GetHistory', 'v1'],
        ],
      ],
      [
        'team Join and GetHistory after start',
        connect,
        1,
        nothing,
        [
          ['Join', 't1'],
          ['GetHistory', 't1'],
        ],
      ],
      [
        'user Join and GetHistory after start',
        connect,
        2,
        nothing,
        [
          ['Join', 'v1', 'u1'],
          ['GetHistory', 'v1', 'u1'],
        ],
      ],
      ['view rejoin on reconnect', connected, 0, reconnect, [['Join', 'v1']]],
      ['team rejoin on reconnect', connected, 1, reconnect, [['Join', 't1']]],
      [
        'user rejoin on reconnect',
        connected,
        2,
        reconnect,
        [['Join', 'v1', 'u1']],
      ],
      [
        'JoinPresence from joinPresence',
        (service) => service.joinPresence('v1'),
        0,
        nothing,
        [['JoinPresence', 'v1']],
      ],
      [
        'LeavePresence from leavePresence',
        connected,
        0,
        (service) => service.leavePresence('v1'),
        [['LeavePresence', 'v1']],
      ],
    ])(
      'leaves a rejected %s unhandled',
      async (_label, arrange, index, act, expectedCalls) => {
        const service = createService();
        // Await only an async arrange: an extra microtask after a synchronous
        // connect would run the start().then callback before rejectInvokes.
        const arranged = arrange(service);
        if (arranged) await arranged;
        const rejections = captureUnhandledRejections();
        const connection = connections[index];
        const invoked = rejectInvokes(
          connection,
          (method: string) => new Error(`${method} failed`),
        );

        act(service, connection);
        await flush();

        expect(invoked).toEqual(expectedCalls);
        // Current behavior; see agent-docs/ui-test-bugs/player.ui.md.
        expect(rejections.map((e) => (e as Error).message)).toEqual(
          expectedCalls.map(([method]) => `${method} failed`),
        );
      },
    );
  });
});
