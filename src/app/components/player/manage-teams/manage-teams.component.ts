// Copyright 2025 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, map, switchMap } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';
import {
  Team,
  TeamService,
  UserService,
  ViewService,
} from '../../../generated/player-api';
import { DialogService } from '../../../services/dialog/dialog.service';
import { UserPermissionsService } from '../../../services/permissions/user-permissions.service';

/** Data passed to the dialog when opened. */
export interface ManageTeamsDialogData {
  viewId: string;
}

/** A team the current user can manage along with its member count (null if unknown). */
interface ManageableTeam {
  team: Team;
  userCount: number | null;
}

@Component({
  selector: 'app-manage-teams',
  templateUrl: './manage-teams.component.html',
  styleUrls: ['./manage-teams.component.scss'],
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatIconModule,
    MatListModule,
    MatProgressSpinnerModule,
  ],
})
export class ManageTeamsComponent {
  private readonly data = inject<ManageTeamsDialogData>(MAT_DIALOG_DATA);
  private readonly viewService = inject(ViewService);
  private readonly teamService = inject(TeamService);
  private readonly userService = inject(UserService);
  private readonly dialogService = inject(DialogService);
  private readonly permissionsService = inject(UserPermissionsService);

  private readonly viewId = this.data.viewId;

  // Dialog title. catchError so a failed title fetch can't throw on signal read
  // (the template uses view()?.name).
  protected readonly view = toSignal(
    this.viewService.getView(this.viewId).pipe(catchError(() => of(null))),
  );

  // Teams the user can manage, with member counts. Loads team-permission claims
  // FIRST and derives the manageable ids from them, so there is no race against a
  // seeded-empty permission stream. Teams are filtered to manageable ones BEFORE
  // fetching user counts, so getTeamUsers is never called on a team the user lacks
  // ViewTeam/ManageTeam on (which would 403). rxResource captures any stream error
  // into error() rather than throwing on read, and reload() refreshes counts.
  protected readonly teamsResource = rxResource({
    stream: () =>
      this.permissionsService
        .loadTeamPermissions(this.viewId, undefined, true)
        .pipe(
          switchMap((claims) => {
            const manageableIds =
              this.permissionsService.getManageableTeamIds(claims);
            return this.teamService.getMyViewTeams(this.viewId).pipe(
              switchMap((teams) => {
                const manageable = teams.filter(
                  (t): t is Team & { id: string } =>
                    !!t.id && t.isMember && manageableIds.includes(t.id),
                );
                if (manageable.length === 0) {
                  return of([] as ManageableTeam[]);
                }
                return forkJoin(
                  manageable.map((team) =>
                    this.userService.getTeamUsers(team.id).pipe(
                      map((users) => ({ team, userCount: users.length })),
                      // ManageTeam does not imply ViewTeam, so getTeamUsers may
                      // 403 if the custom role lacks ViewTeam. Degrade to no count
                      // rather than failing the whole stream.
                      catchError(() =>
                        of({ team, userCount: null as number | null }),
                      ),
                    ),
                  ),
                );
              }),
            );
          }),
        ),
  });

  protected readonly teams = computed<ManageableTeam[]>(() =>
    (this.teamsResource.value() ?? [])
      .slice()
      .sort((a, b) => (a.team.name ?? '').localeCompare(b.team.name ?? '')),
  );

  /** Opens the add/remove users dialog in restricted (ManageTeam) mode. */
  openUsersDialog(team: Team): void {
    this.dialogService
      .addRemoveUsersToTeam(
        'Add or Remove Users for team ' + team.name,
        team,
        { maxWidth: '100vw', width: 'auto', restoreFocus: false },
        false,
      )
      // Member counts came from getTeamUsers at load; refresh them after the
      // user adds/removes members so the badges stay accurate.
      .subscribe(() => this.teamsResource.reload());
  }
}
