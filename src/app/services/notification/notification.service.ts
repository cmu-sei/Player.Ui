// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { ComnAuthService, ComnSettingsService } from '@cmusei/crucible-common';
import { BehaviorSubject } from 'rxjs';
import { NotificationData } from '../../models/notification-data';
import { ViewPresence } from '../../models/view-presence';

@Injectable()
export class NotificationService {
  public viewNotification = new BehaviorSubject<NotificationData>(
    <NotificationData>{}
  );
  public deleteNotification = new BehaviorSubject<string>('');
  public notificationHistory = new BehaviorSubject<Array<NotificationData>>(
    new Array<NotificationData>()
  );

  private userPresenceList$ = new BehaviorSubject<ViewPresence[]>([]);
  private userPresenceList = new Array<ViewPresence>();
  public userPresence$ = this.userPresenceList$.asObservable();

  public canSendMessage = new BehaviorSubject<boolean>(false);
  public viewConnection: signalR.HubConnection;
  public teamConnection: signalR.HubConnection;
  public userConnection: signalR.HubConnection;

  constructor(
    private settingsSvc: ComnSettingsService,
    private authService: ComnAuthService
  ) {}

  connectToNotificationServer(
    viewGuid: string,
    teamGuid: string,
    userGuid: string,
    userToken: string
  ) {
    this.viewConnection = new signalR.HubConnectionBuilder()
      .withUrl(
        `${this.settingsSvc.settings.NotificationsSettings.url}/view?bearer=${userToken}`
      )
      .withStatefulReconnect()
      .withAutomaticReconnect(new RetryPolicy(120, 0, 5))
      .build();
    this.teamConnection = new signalR.HubConnectionBuilder()
      .withUrl(
        `${this.settingsSvc.settings.NotificationsSettings.url}/team?bearer=${userToken}`
      )
      .withStatefulReconnect()
      .withAutomaticReconnect(new RetryPolicy(120, 0, 5))
      .build();
    this.userConnection = new signalR.HubConnectionBuilder()
      .withUrl(
        `${this.settingsSvc.settings.NotificationsSettings.url}/user?bearer=${userToken}`
      )
      .withStatefulReconnect()
      .withAutomaticReconnect(new RetryPolicy(120, 0, 5))
      .build();

    this.viewConnection.on('Reply', (data: NotificationData) => {
      const validatedData = this.validateNotificationData(data);
      if (validatedData != null) {
        this.viewNotification.next(validatedData);
      }
    });

    this.viewConnection.on('History', (data: [NotificationData]) => {
      this.notificationHistory.next(data);
    });

    this.viewConnection.on('Delete', (data: string) => {
      this.deleteNotification.next(data);
    });

    this.viewConnection.on('PresenceUpdate', (data) => {
      console.log(data);
    });

    this.teamConnection.on('Reply', (data: NotificationData) => {
      const validatedData = this.validateNotificationData(data);
      if (validatedData != null) {
        this.viewNotification.next(validatedData);
      }
    });

    this.teamConnection.on('History', (data: [NotificationData]) => {
      this.notificationHistory.next(data);
    });

    this.userConnection.on('Reply', (data: NotificationData) => {
      const validatedData = this.validateNotificationData(data);
      if (validatedData != null) {
        this.viewNotification.next(validatedData);
      }
    });

    this.userConnection.on('History', (data: [NotificationData]) => {
      this.notificationHistory.next(data);
    });

    this.viewConnection
      .start()
      .then(() => {
        this.viewConnection.invoke('Join', viewGuid);
        this.viewConnection.invoke('GetHistory', viewGuid);
        console.log('View connection started');
      })
      .catch(() => {
        console.log('Error while establishing View connection');
      });

    this.viewConnection.onreconnected(() => {
      this.viewConnection.invoke('Join', viewGuid);
      console.log('View reconnected');
    });

    this.teamConnection
      .start()
      .then(() => {
        this.teamConnection.invoke('Join', teamGuid);
        this.teamConnection.invoke('GetHistory', teamGuid);
        console.log('Team connection started');
      })
      .catch(() => {
        console.log('Error while establishing Team connection');
      });

    this.teamConnection.onreconnected(() => {
      this.teamConnection.invoke('Join', teamGuid);
      console.log('Team reconnected');
    });

    this.userConnection
      .start()
      .then(() => {
        this.userConnection.invoke('Join', viewGuid, userGuid);
        this.userConnection.invoke('GetHistory', viewGuid, userGuid);
        console.log('User connection started');
      })
      .catch(() => {
        console.log('Error while establishing User connection');
      });

    this.userConnection.onreconnected(() => {
      this.userConnection.invoke('Join', viewGuid, userGuid);
      console.log('User reconnected');
    });
  }

  sendNotification(guid: string, msg: string) {
    console.log('Sending Notification  ' + msg);

    this.viewConnection.invoke('Post', guid, msg);
  }

  validateNotificationData(data: NotificationData): NotificationData {
    if (data.priority == 'System') {
      this.canSendMessage.next(data.canPost);
      return null; // Indicates that a System message was broadcast and should be ignored by user
    }

    if (data.subject == undefined) {
      data.subject = 'Player Notification';
    }
    if (data.iconUrl == undefined) {
      data.iconUrl = 'assets/img/SP_Icon_Alert.png';
    }

    if (data.broadcastTime == undefined) {
      return null;
    }

    return data;
  }

  joinPresence(viewId: string) {
    if (this.viewConnection == null) {
      this.viewConnection = new signalR.HubConnectionBuilder()
        .withUrl(
          `${
            this.settingsSvc.settings.NotificationsSettings.url
          }/view?bearer=${this.authService.getAuthorizationToken()}`
        )
        .withStatefulReconnect()
        .withAutomaticReconnect(new RetryPolicy(120, 0, 5))
        .build();

      this.viewConnection
        .start()
        .then(() => {
          this.invokeJoinPresence(viewId);
        })
        .catch((x) => {
          console.log(x);
          console.log('Error while establishing Presence connection');
        });

      this.viewConnection.onreconnected(() => {
        this.viewConnection.invoke('JoinPresence', viewId);
      });
    } else {
      this.invokeJoinPresence(viewId);

      this.viewConnection.onreconnected(() => {
        this.viewConnection.invoke('JoinView', viewId);
        this.viewConnection.invoke('JoinPresence', viewId);
      });
    }

    this.viewConnection.on('PresenceUpdate', (data: ViewPresence) => {
      const presence = this.userPresenceList.find((x) => x.id == data.id);

      if (presence != null && presence.online != data.online) {
        presence.online = data.online;
        this.userPresenceList$.next(this.userPresenceList);
      }
    });
  }

  leavePresence(viewId: string) {
    if (this.viewConnection != null) {
      this.viewConnection.invoke('LeavePresence', viewId).then();
    }
  }

  private invokeJoinPresence(viewId: string) {
    this.viewConnection.invoke('JoinPresence', viewId).then((x) => {
      this.userPresenceList = x;
      this.userPresenceList$.next(this.userPresenceList);
    });
  }
}

class RetryPolicy {
  constructor(
    private maxSeconds: number,
    private minJitterSeconds: number,
    private maxJitterSeconds: number
  ) {}

  nextRetryDelayInMilliseconds(
    retryContext: signalR.RetryContext
  ): number | null {
    let nextRetrySeconds = Math.pow(2, retryContext.previousRetryCount + 1);
    if (retryContext.elapsedMilliseconds / 1000 > this.maxSeconds) {
      location.reload();
    }

    nextRetrySeconds +=
      Math.floor(
        Math.random() * (this.maxJitterSeconds - this.minJitterSeconds + 1)
      ) + this.minJitterSeconds; // Add Jitter

    return nextRetrySeconds * 1000;
  }
}
