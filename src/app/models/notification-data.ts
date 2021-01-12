// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

export interface NotificationData {
  fromId: string;
  fromName: string;
  fromType: string;
  toId: string;
  toName: string;
  toType: string;
  broadcastTime: string;
  subject: string;
  text: string;
  iconUrl: string;
  link: string;
  priority: string;
  wasSuccess: boolean;
  canPost: boolean;
}
