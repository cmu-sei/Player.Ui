// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  OnDestroy,
  OnInit,
  signal,
  inject,
  input,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import {
  ComnSettingsService,
  CrucibleDialogService,
} from '@cmusei/crucible-common';
import { NotificationDataStatus } from '../../../models/notification-data';
import { NotificationService } from '../../../services/notification/notification.service';
import { ViewService } from '../../../generated/player-api/api/view.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  MatExpansionPanel,
  MatExpansionPanelHeader,
  MatExpansionPanelTitle,
} from '@angular/material/expansion';
import { NgClass, DatePipe } from '@angular/common';
import { MatBadge } from '@angular/material/badge';
import { MatIcon } from '@angular/material/icon';
import { MatList, MatListItem } from '@angular/material/list';
import { FormsModule } from '@angular/forms';
import {
  MatFormField,
  MatInput,
  MatHint,
  MatSuffix,
} from '@angular/material/input';
import { MatButton } from '@angular/material/button';
import { TimeZoneAbbrPipe } from '../../../pipes/time-zone-abbr.pipe';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
  imports: [
    MatExpansionPanel,
    MatExpansionPanelHeader,
    NgClass,
    MatExpansionPanelTitle,
    MatBadge,
    MatIcon,
    MatList,
    MatListItem,
    FormsModule,
    MatFormField,
    MatInput,
    MatHint,
    MatButton,
    MatSuffix,
    DatePipe,
    TimeZoneAbbrPipe,
  ],
})
export class NotificationsComponent implements OnInit, OnDestroy {
  private notificationService = inject(NotificationService);
  private settingsService = inject(ComnSettingsService);
  private confirmDialogService = inject(CrucibleDialogService);
  private viewService = inject(ViewService);
  private titleService = inject(Title);

  readonly viewGuid = input<string>(undefined);
  readonly teamGuid = input<string>(undefined);
  readonly userGuid = input<string>(undefined);
  readonly userToken = input<string>(undefined);
  readonly userName = input<string>(undefined);
  public notification: NotificationDataStatus;
  public messageToSend: string;
  public userData: any;
  public showSystemNotifications: boolean;
  // Signals, because the hub sets these outside any event in this component and
  // the OnPush player view above it would otherwise skip the re-render.
  public hasViewAdmin = signal<boolean>(false);
  public sendMessagePlaceholder: string;
  public notificationsList: Array<NotificationDataStatus>;
  public notificationsHistory = signal<Array<NotificationDataStatus>>([]);
  public newNotificationCount = signal<number>(0);
  public useBadge = false;
  public useBlink = false;
  public useBeep = false;
  private unsubscribe$: Subject<null> = new Subject<null>();

  public constructor() {
    this.useBadge =
      this.settingsService.settings.NotificationsSettings.useBadge;
    this.useBlink =
      this.settingsService.settings.NotificationsSettings.useBlink;
    this.useBeep = this.settingsService.settings.NotificationsSettings.useBeep;
  }

  ngOnInit() {
    this.showSystemNotifications = false;
    this.notification = undefined;
    this.messageToSend = '';
    this.notificationsHistory.set([]);
    this.hasViewAdmin.set(false);
    this.sendMessagePlaceholder = 'Send system wide notification';

    this.notificationService.canSendMessage
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((data) => {
        this.hasViewAdmin.set(data);
      });

    this.notificationService.notificationHistory
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((data) => {
        if (data != undefined && data.length > 0) {
          this.notificationsHistory.update((history) =>
            history
              .concat(<Array<NotificationDataStatus>>data)
              .sort((a: NotificationDataStatus, b: NotificationDataStatus) =>
                a.broadcastTime < b.broadcastTime ? 1 : -1,
              ),
          );
        }
      });

    this.notificationService.viewNotification
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((msg) => {
        // Check to see if a valid notification came across.
        if (msg.broadcastTime != undefined) {
          this.notification = msg as NotificationDataStatus;
          this.notificationsHistory.update((history) => [
            this.notification,
            ...history,
          ]);
          this.setNewNotificationCount(this.newNotificationCount() + 1);
          this.playBeep();

          if ('Notification' in window) {
            if (Notification.permission == 'granted') {
              const notification = new Notification(this.notification.subject, {
                icon: this.notification.iconUrl,
                body: this.notification.text,
              });

              if (
                this.notification.link != null &&
                this.notification.link != ''
              ) {
                notification.onclick = () =>
                  this.openLink(this.notification.link);
              }
            } else {
              console.log('Notifications have not been granted by user.');
              Notification.requestPermission();
            }
          }
        }
      });

    this.notificationService.deleteNotification
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((key: string) => {
        if (key === 'all') {
          this.notificationsHistory.set([]);
        } else {
          this.removeFromHistory(+key);
        }
      });

    this.notificationService.connectToNotificationServer(
      this.viewGuid(),
      this.teamGuid(),
      this.userGuid(),
      this.userToken(),
    );
  }

  public openLink(link: string) {
    window.open(link, '_blank');
  }

  public sendMessage(): void {
    if (this.messageToSend.trim().length > 0) {
      this.confirmDialogService
        .confirm({
          title: 'Confirm Message Send',
          message:
            'Are you sure that you want to send a system wide message to all users logged into this view?',
          confirmText: 'Send',
          cancelText: 'Cancel',
        })
        .afterClosed()
        .subscribe((confirmed) => {
          if (confirmed) {
            if (this.messageToSend.trim().length > 225) {
              // Trim after 225 characters
              this.messageToSend = this.messageToSend.trim().substring(0, 225);
            }
            this.notificationService.sendNotification(
              this.viewGuid(),
              this.messageToSend,
            );
            this.messageToSend = '';
          }
        });
    }
  }

  notificationPanelToggle(state: string) {
    this.showSystemNotifications = state === 'open';
    if (state === 'close') {
      this.notificationsHistory.update((history) =>
        history.map((n) => ({ ...n, wasSeen: true })),
      );
      this.setNewNotificationCount(0);
    }
  }

  notificationDisplayClass() {
    if (
      this.useBlink &&
      !this.showSystemNotifications &&
      this.newNotificationCount() > 0
    ) {
      return 'blink';
    }
    return '';
  }

  playBeep() {
    if (this.useBeep) {
      const audio = new Audio('assets/sounds/beep.mp3');
      audio.play();
    }
  }

  deleteNotification(notification: NotificationDataStatus): void {
    this.confirmDialogService
      .confirm({
        title: 'Delete Notification',
        message:
          'This will delete this notification for EVERYONE in this view.  Are you sure that you want to delete notification:  ' +
          notification.text +
          '?',
        confirmText: 'Delete',
        cancelText: 'Cancel',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.viewService
            .deleteNotification(this.viewGuid(), notification.key)
            .subscribe(() => {
              this.removeFromHistory(notification.key);
              this.setNewNotificationCount(0);
            });
        }
      });
  }

  deleteViewNotifications(): void {
    this.confirmDialogService
      .confirm({
        title: 'DELETE ALL NOTIFICATIONS!',
        message:
          'This will delete all notifications for everyone in this view!  Are you sure that you want to delete ALL NOTIFICATIONS?',
        confirmText: 'Delete',
        cancelText: 'Cancel',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.viewService
            .deleteViewNotifications(this.viewGuid())
            .subscribe(() => {
              this.notificationsHistory.set([]);
            });
        }
      });
  }

  private removeFromHistory(key: number): void {
    this.notificationsHistory.update((history) =>
      history.filter((n) => n.key !== key),
    );
  }

  setNewNotificationCount(count: number) {
    this.newNotificationCount.set(count);
    if (count < 1) {
      this.titleService.setTitle(this.settingsService.settings.AppTitle);
    } else if (count === 1) {
      this.titleService.setTitle(
        this.settingsService.settings.AppTitle + ' (1 Alert)',
      );
    } else {
      this.titleService.setTitle(
        this.settingsService.settings.AppTitle +
          ' (' +
          count.toString() +
          ' Alerts)',
      );
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
