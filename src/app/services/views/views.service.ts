// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ComnSettingsService } from '@cmusei/crucible-common';
import {
  BehaviorSubject,
  Observable,
  throwError as observableThrowError,
} from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { TeamData } from '../../models/team-data';
import { ViewData } from '../../models/view-data';
import {
  CreateViewCommand,
  TeamService,
  View,
  ViewService,
  ViewStatus,
} from '../../generated/player-api';

const httpOptions = {
  headers: new HttpHeaders({
    'Content-Type': 'application/json',
  }),
};

@Injectable()
export class ViewsService {
  private viewsApi = inject(ViewService);
  private teamsApi = inject(TeamService);

  viewsSubject = new BehaviorSubject<View[]>([]);
  views$ = this.viewsSubject.asObservable();

  loadMyViews() {
    return this.viewsApi
      .getMyViews()
      .pipe(tap((x) => this.viewsSubject.next(x)));
  }

  createView(command: CreateViewCommand) {
    return this.viewsApi.createView(command).pipe(
      tap((x) => {
        this.upsert(x.id, x);
      })
    );
  }

  upsert(id: string, role: Partial<View>) {
    const views = this.viewsSubject.getValue();
    let viewToUpdate = views.find((x) => x.id === id);

    if (viewToUpdate != null) {
      Object.assign(viewToUpdate, role);
    } else {
      views.push({ ...role, id } as View);
    }

    this.viewsSubject.next(views);
  }

  remove(id: string) {
    let views = this.viewsSubject.getValue();
    views = views.filter((x) => x.id != id);
    this.viewsSubject.next(views);
  }

  public setPrimaryTeamId(userId: string, teamId: string): Observable<any> {
    return this.teamsApi.setUserPrimaryTeam(userId, teamId);
  }
}
