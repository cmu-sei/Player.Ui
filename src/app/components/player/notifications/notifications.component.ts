// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ComnSettingsService } from '@cmusei/crucible-common';
import { PushNotificationsService } from 'ng-push-ivy';
import { NotificationDataStatus } from '../../../models/notification-data';
import { DialogService } from '../../../services/dialog/dialog.service';
import { NotificationService } from '../../../services/notification/notification.service';
import { ViewService } from '../../../generated/player-api/api/view.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
})
export class NotificationsComponent implements OnInit, OnDestroy {
  @Input() viewGuid: string;
  @Input() teamGuid: string;
  @Input() userGuid: string;
  @Input() userToken: string;
  @Input() userName: string;
  @Input() topbarColor: string;

  public notification: NotificationDataStatus;
  public messageToSend: string;
  public userData: any;
  public showSystemNotifications: boolean;
  public hasViewAdmin: boolean;
  public sendMessagePlaceholder: string;
  public notificationsList: Array<NotificationDataStatus>;
  public notificationsHistory: Array<NotificationDataStatus>;
  public newNotificationCount = 0;
  public useBadge = false;
  public useBlink = false;
  public useBeep = false;
  private unsubscribe$: Subject<null> = new Subject<null>();

  public constructor(
    private notificationService: NotificationService,
    private pushNotificationService: PushNotificationsService,
    private settingsService: ComnSettingsService,
    private dialogService: DialogService,
    private viewService: ViewService,
    private titleService: Title
  ) {
    this.useBadge = this.settingsService.settings.NotificationsSettings.useBadge;
    this.useBlink = this.settingsService.settings.NotificationsSettings.useBlink;
    this.useBeep = this.settingsService.settings.NotificationsSettings.useBeep;
  }

  ngOnInit() {
    this.showSystemNotifications = false;
    this.notification = undefined;
    this.messageToSend = '';
    this.notificationsHistory = new Array<NotificationDataStatus>();
    this.hasViewAdmin = false;
    this.sendMessagePlaceholder = 'Send system wide notification';

    this.notificationService.canSendMessage.pipe(takeUntil(this.unsubscribe$)).subscribe((data) => {
      this.hasViewAdmin = data;
    });

    this.notificationService.notificationHistory.pipe(takeUntil(this.unsubscribe$)).subscribe((data) => {
      if (data != undefined && data.length > 0) {
        this.notificationsHistory = this.notificationsHistory.concat(
          <Array<NotificationDataStatus>>data
        );
        this.notificationsHistory = this.notificationsHistory.sort(
          (a: NotificationDataStatus, b: NotificationDataStatus) => a.broadcastTime < b.broadcastTime ? 1 : -1
        );
      }
    });

    this.notificationService.viewNotification.pipe(takeUntil(this.unsubscribe$)).subscribe((msg) => {
      // Check to see if a valid notification came across.
      if (msg.broadcastTime != undefined) {
        this.notification = msg as NotificationDataStatus;
        this.notificationsHistory.unshift(this.notification);
        this.setNewNotificationCount(this.newNotificationCount + 1);
        this.playBeep();

        if (this.pushNotificationService.permission == 'granted') {
          this.pushNotificationService
            .create(this.notification.subject, {
              icon: this.notification.iconUrl,
              body: this.notification.text,
            })
            .pipe(takeUntil(this.unsubscribe$)).subscribe(
              (res) => {
                if (
                  this.notification.link != null &&
                  this.notification.link != ''
                ) {
                  if (res.event.type === 'click') {
                    this.openLink(this.notification.link);
                  }
                }
                console.log(res);
              },
              (err) => console.log(err)
            );
        } else {
          console.log('Notifications have not been granted by user.');
          this.pushNotificationService.requestPermission();
        }
      }
    });

    this.notificationService.deleteNotification.pipe(takeUntil(this.unsubscribe$)).subscribe((key: string) => {
      if (key === 'all') {
        this.notificationsHistory.length = 0;
      } else {
        const index = this.notificationsHistory.findIndex(n => n.key === +key);
        if (index > -1) {
          this.notificationsHistory.splice(index, 1);
        }
      }
    });

    this.notificationService.connectToNotificationServer(
      this.viewGuid,
      this.teamGuid,
      this.userGuid,
      this.userToken
    );

  }

  public openLink(link: string) {
    window.open(link, '_blank');
  }

  public sendMessage(): void {
    if (this.messageToSend.trim().length > 0) {
      this.dialogService
        .confirm(
          'Confirm Message Send',
          'Are you sure that you want to send a system wide message to all users logged into this view?',
          null
        )
        .subscribe((result) => {
          if (result['confirm'] == true) {
            if (this.messageToSend.trim().length > 225) {
              // Trim after 225 characters
              this.messageToSend = this.messageToSend.trim().substring(0, 225);
            }
            this.notificationService.sendNotification(
              this.viewGuid,
              this.messageToSend
            );
            this.messageToSend = '';
          }
        });
    }
  }

  notificationPanelToggle(state: string) {
    this.showSystemNotifications = state === 'open';
    if (state === 'close') {
      this.notificationsHistory.forEach(n => {
        n.wasSeen = true;
      });
      this.setNewNotificationCount(0);
    }
  }

  notificationDisplayClass() {
    if (this.useBlink && !this.showSystemNotifications && this.newNotificationCount > 0) {
      return 'blink'
    }
    return '';
  }

  playBeep() {
    if (this.useBeep) {
      var audio = new Audio('assets/sounds/beep.mp3');
      audio.play();
    }
  }

  deleteNotification(notification: NotificationDataStatus): void {
    this.dialogService
      .confirm(
        'Delete Notification',
        'This will delete this notification for EVERYONE in this view.  Are you sure that you want to delete notification:  ' + notification.text + '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.viewService.deleteNotification(this.viewGuid, notification.key).subscribe((deleted) => {
            const index = this.notificationsHistory.findIndex(n => n.key === notification.key);
            if (index > -1) {
              this.notificationsHistory.splice(index, 1);
            }
            this.setNewNotificationCount(0);
          });
        }
      });
  }

  deleteViewNotifications(): void {
    this.dialogService
      .confirm(
        'DELETE ALL NOTIFICATIONS!',
        'This will delete all notifications for everyone in this view!  Are you sure that you want to delete ALL NOTIFICATIONS?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.viewService.deleteViewNotifications(this.viewGuid).subscribe((deleted) => {
            this.notificationsHistory.length = 0;
          });
        }
      });
  }

  setNewNotificationCount(count: number) {
    this.newNotificationCount = count;
    if (count < 1) {
      this.titleService.setTitle(this.settingsService.settings.AppTitle);
    } else if (count === 1) {
      this.titleService.setTitle(this.settingsService.settings.AppTitle + ' (1 Alert)');
    } else {
      this.titleService.setTitle(this.settingsService.settings.AppTitle + ' (' + count.toString() + ' Alerts)');
    }
  }

  public onSubmit() {
    const message = this.userData;
    message.message = this.sendMessage;
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

}
