// Copyright 2023 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  OnInit,
  EventEmitter,
  Output,
  NgZone,
  ViewChild,
} from '@angular/core';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatStepper } from '@angular/material/stepper';
import {
  UntypedFormControl,
  FormGroupDirective,
  NgForm,
  Validators,
} from '@angular/forms';
import {
  View,
  ViewStatus,
  Team,
  TeamService,
  ViewService,
  UserService,
  FileService,
  FileModel,
} from '../../../../generated/player-api';
import {
  TeamForm,
  ApplicationTemplate,
  ApplicationService,
  Application,
} from '../../../../generated/player-api';
import { User } from '../../../../generated/player-api';
import { DialogService } from '../../../../services/dialog/dialog.service';
import { take } from 'rxjs/operators';
import { ViewApplicationsSelectComponent } from '../../view-applications-select/view-applications-select.component';
import { Clipboard } from '@angular/cdk/clipboard';
import { EditFileDialogComponent } from '../../../shared/edit-file-dialog/edit-file-dialog.component';
import { HttpEventType, HttpResponse } from '@angular/common/http';

/** Team node with related user and application information */
export class TeamUserApp {
  constructor(
    public name: string,
    public team: Team,
    public users: Array<User>
  ) {}
}

@Component({
  selector: 'app-admin-view-edit',
  templateUrl: './admin-view-edit.component.html',
  styleUrls: ['./admin-view-edit.component.scss'],
})
export class AdminViewEditComponent implements OnInit {
  @Output() editComplete = new EventEmitter<string>();
  @ViewChild(ViewApplicationsSelectComponent)
  viewApplicationsSelectComponent: ViewApplicationsSelectComponent;
  @ViewChild(AdminViewEditComponent) child;
  @ViewChild('stepper') stepper: MatStepper;
  @ViewChild(EditFileDialogComponent)
  editFileComponent: EditFileDialogComponent;

  public viewNameFormControl = new UntypedFormControl('', [
    Validators.required,
    Validators.minLength(4),
  ]);

  public teamNameFormControl = new UntypedFormControl('', [
    Validators.required,
    Validators.minLength(3),
  ]);

  public descriptionFormControl = new UntypedFormControl('', [
    Validators.required,
  ]);
  public matcher = new UserErrorStateMatcher();
  public viewStates = Object.values(ViewStatus);
  public isLinear = false;
  public view: View;
  public teams: Array<TeamUserApp>;
  public currentTeam: TeamUserApp;
  public isLoadingTeams: boolean;
  public applicationTemplates: Array<ApplicationTemplate>;
  public BLANK_TEMPLATE = <ApplicationTemplate>{
    name: 'New Application',
    viewId: '',
  };

  public staged: PlayerFile[];
  public teamsForFile: string[];
  public uploadProgess: number;
  public uploading: boolean;
  public viewFiles: FileModel[];
  public currentFile: FileModel;
  public appNames: string[];

  constructor(
    public viewService: ViewService,
    public teamService: TeamService,
    public dialogService: DialogService,
    public userService: UserService,
    public fileService: FileService,
    public applicationService: ApplicationService,
    public zone: NgZone,
    public clipboard: Clipboard
  ) {}

  /**
   * Initialize component
   */
  ngOnInit() {
    this.isLoadingTeams = false;
    this.view = undefined;
    this.teams = new Array<TeamUserApp>();
    this.staged = new Array<PlayerFile>();
    this.teamsForFile = new Array<string>();
    this.appNames = new Array<string>();
    this.viewFiles = new Array<FileModel>();
  }

  /**
   * Updates the list of available app templates
   */
  updateApplicationTemplates() {
    this.applicationService
      .getApplicationTemplates()
      .pipe(take(1))
      .subscribe((templates) => {
        this.applicationTemplates = templates;
      });
  }

  /**
   * Updates the contents of the current view
   */
  updateViewTeams(): void {
    if (this.view !== undefined && this.view.id !== undefined) {
      // Update the teams arrays
      this.isLoadingTeams = true;
      this.teams = new Array<TeamUserApp>();
      this.teamService
        .getViewTeams(this.view.id)
        .pipe(take(1))
        .subscribe((tms) => {
          tms.forEach((tm) => {
            this.userService
              .getTeamUsers(tm.id)
              .pipe(take(1))
              .subscribe((usrs) => {
                this.teams.push(new TeamUserApp(tm.name, tm, usrs));
                this.teams.sort((t1, t2) => {
                  if (t1.name === null || t2.name === null) {
                    return 0;
                  }
                  if (t1.name.toLowerCase() < t2.name.toLowerCase()) {
                    return -1;
                  }
                  if (t1.name.toLowerCase() > t2.name.toLowerCase()) {
                    return 1;
                  }
                  return 0;
                });
                if (this.teams.length === tms.length) {
                  this.isLoadingTeams = false;
                }
              });
          });
        });
    }
  }

  /**
   * Sets the contents of the current view
   */
  setView(view: View): void {
    if (view) {
      this.view = view;
      this.viewNameFormControl.setValue(view.name);
      this.descriptionFormControl.setValue(view.description);
    } else {
      this.view = {};
      this.viewNameFormControl.setValue('');
      this.descriptionFormControl.setValue('');
    }
  }

  /**
   * Updates the contents of the current view
   */
  updateView(): void {
    if (this.view !== undefined && this.view.id !== undefined) {
      this.viewApplicationsSelectComponent.view = this.view;
      this.viewApplicationsSelectComponent.updateApplications();
      this.viewApplicationsSelectComponent.currentApp = undefined;
    }
  }

  /**
   * Returns the stepper to zero index
   */
  resetStepper() {
    if (this.stepper) {
      this.stepper.selectedIndex = 0;
      this.view = undefined;
    }
  }

  /**
   * Closes the edit screen
   */
  returnToViewSearch(): void {
    this.currentTeam = undefined;
    this.editComplete.emit(this.view.id);
  }

  addViewApplication(template: ApplicationTemplate) {
    console.log(template);
    let app = <Application>{};
    if (template.id == null) {
      app = <Application>{
        name: template.name,
        viewId: this.view.id,
      };
    } else {
      app = <Application>{
        viewId: this.view.id,
        applicationTemplateId: template.id,
      };
    }

    console.log(app);
    this.applicationService
      .createApplication(this.view.id, app)
      .pipe(take(1))
      .subscribe((rslt) => {
        console.log('Application added');
        this.viewApplicationsSelectComponent.updateApplications();
        this.viewApplicationsSelectComponent.currentApp = rslt;
      });
  }

  /**
   * Delete an view after confirmation
   */
  deleteView(): void {
    this.dialogService
      .confirm(
        'Delete View',
        'Are you sure that you want to delete view ' + this.view.name + '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.viewService
            .deleteView(this.view.id)
            .pipe(take(1))
            .subscribe(() => {
              console.log('successfully deleted view');
              this.returnToViewSearch();
            });
        }
      });
  }

  /**
   * Saves the current view
   */
  saveView(): void {
    if (
      !this.viewNameFormControl.hasError('minlength') &&
      !this.viewNameFormControl.hasError('required')
    ) {
      if (this.view.name !== this.viewNameFormControl.value) {
        this.view.name = this.viewNameFormControl.value;
        this.viewService
          .updateView(this.view.id, this.view)
          .pipe(take(1))
          .subscribe((updatedView) => {
            this.view = updatedView;
          });
      }
    }

    if (!this.descriptionFormControl.hasError('required')) {
      if (this.view.description !== this.descriptionFormControl.value) {
        this.view.description = this.descriptionFormControl.value;
        this.viewService
          .updateView(this.view.id, this.view)
          .pipe(take(1))
          .subscribe((updatedView) => {
            this.view = updatedView;
          });
      }
    }
  }

  /**
   * Updates the view status
   */
  saveViewStatus(): void {
    console.log(this.view.status);
    this.viewService
      .updateView(this.view.id, this.view)
      .subscribe((updatedView) => {
        this.view = updatedView;
      });
  }

  /**
   * Delete a team after confirmation
   * @param tm The team to delete
   */
  deleteTeam(tm: Team): void {
    this.dialogService
      .confirm(
        'Delete View',
        'Are you sure that you want to delete team ' + tm.name + '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.teamService.deleteTeam(tm.id).subscribe(() => {
            console.log('successfully deleted team');
            this.updateViewTeams();
          });
        }
      });
  }

  /**
   * Saves the team name
   * @param name New name of the team
   * @param id team Guid
   */
  saveTeamName(name: string, id: string): void {
    this.teamService
      .getTeam(id)
      .pipe(take(1))
      .subscribe((tm) => {
        tm.name = name;
        this.teamService.updateTeam(id, tm).subscribe((updatedTeam) => {
          this.teams.find((t) => t.team.id === id).team = updatedTeam;
          console.log('Team updated:  ' + updatedTeam.name);
        });
      });
  }

  /**
   * Opens the Add/Remove Users dialog for a specific team
   * @param team The team to add/remove users to
   */
  openUsersDialog(team: Team): void {
    if (team !== undefined) {
      this.dialogService
        .addRemoveUsersToTeam('Add or Remove Users for team ' + team.name, team)
        .subscribe((result) => {
          this.teams.find((t) => t.team.id === team.id).users =
            result['teamUsers'];
        });
    }
  }

  /**
   * Called when the mat-step index has changed to signal an update to the view
   * @param event SelectionChange event
   */
  onViewStepChange(event: any) {
    // Index 3 is the files step. Grab the files already in the view.
    if (event.selectedIndex === 3) {
      this.staged = new Array<PlayerFile>();
      this.getViewFiles();
      this.getExistingApps();
      this.updateViewTeams();
    } else if (event.selectedIndex === 2) {
      // index 2 is the Teams step.  Refresh when selected to ensure latest information updated
      this.currentTeam = undefined;
      this.updateViewTeams();
    } else if (event.selectedIndex === 1) {
      // Clicked away from teams
      this.updateApplicationTemplates();
      this.viewApplicationsSelectComponent.updateApplications();
    }
  }

  /**
   * Adds a new Team to the view
   */
  addNewTeam() {
    this.teamService
      .createTeam(this.view.id, <TeamForm>{ name: 'New Team' })
      .pipe(take(1))
      .subscribe((newTeam) => {
        const team = new TeamUserApp('New Team', newTeam, new Array<User>());
        this.teams.unshift(team);
        this.currentTeam = team;
        // This uses the rxjs take and ngZone to determine when the html is rendered
        this.zone.onMicrotaskEmpty
          .asObservable()
          .pipe(take(1))
          .subscribe(() => {
            const nameElement = <HTMLInputElement>(
              document.getElementById('teamName' + newTeam.id)
            );
            if (nameElement) {
              nameElement.focus();
              nameElement.select();
            }
          });
      });
  }

  /**
   * Selects the file(s) to be uploaded. Called when file selection is changed
   */
  selectFile(files: FileList) {
    const filesToUpload = Array.from(files);
    this.uploading = false;
    for (const fp of filesToUpload) {
      this.staged.push(new PlayerFile(fp));
    }
  }

  /**
   * Uploads file(s) to specified team(s) in this view
   */
  uploadFile() {
    this.uploadProgess = 0;
    this.uploading = true;
    this.fileService
      .uploadMultipleFiles(
        this.view.id,
        this.teamsForFile,
        this.staged.map((f) => f.file),
        'events',
        true
      )
      .subscribe((event) => {
        if (event.type === HttpEventType.UploadProgress) {
          this.uploadProgess = Math.round((100 * event.loaded) / event.total);
          console.log(this.uploadProgess);
        } else if (event instanceof HttpResponse) {
          this.uploading = false;
          if (event.status === 201) {
            for (const elem of event.body) {
              if (!this.viewFiles.some((f) => f.name === elem.name)) {
                this.viewFiles.push(elem);
              }
            }
            this.staged = new Array<PlayerFile>();
          } else {
            this.uploading = false;
            console.log('Error uploading files: ' + event.status);
          }
        }
      });
  }

  /**
   * Removes a file from the list of file staged for upload
   *
   * @param file: The file to remove from the list
   */
  removeFile(file: PlayerFile) {
    console.log(file);
    this.staged = this.staged.filter((f) => f.file.name !== file.file.name);
  }

  /**
   * Returns a link to the download endpoint for a particular file
   */
  getDownloadLink(file: FileModel) {
    this.clipboard.copy(this.getFileUri(file));
  }

  /**
   * Get the files in this view that can be accessed by the user
   */
  getViewFiles() {
    this.fileService
      .getViewFiles(this.view.id)
      .pipe(take(1))
      .subscribe(
        (data) => {
          for (const elem of data) {
            if (!this.viewFiles.some((f) => f.name === elem.name)) {
              this.viewFiles.push(elem);
            }
          }
        },
        (err) => {
          console.log('Error getting files ' + err);
        }
      );
  }

  /**
   * Trigger a download for a file. This will open the file in the broswer if it is an image or pdf
   *
   * @param id: The GUID of the file to download
   * @param name: The name to use when triggering the download
   */
  downloadFile(id: string, name: string) {
    this.fileService
      .download(id)
      .pipe(take(1))
      .subscribe({
        next: (data) => {
          const url = window.URL.createObjectURL(data);
          const link = document.createElement('a');
          link.href = url;
          link.target = '_blank';
          if (!this.isImageOrPdf(name)) {
            link.download = name;
          }
          link.click();
        },
        error: (err) => {
          window.alert('Error downloading file');
          console.log(err);
        },
        complete: () => {
          console.log('Got a next value');
        },
      });
  }

  /**
   * Delete the file with the specified id.
   *
   * @param id: The GUID of the file to delete
   * @param name: The name of the file
   */
  deleteFile(id: string, name: string) {
    this.dialogService
      .confirm('Delete File?', 'Are you sure you want to delete file ' + name)
      .subscribe((result) => {
        if (result['confirm']) {
          this.fileService.deleteFile(id).subscribe((resp) => {
            if (resp != null) {
              window.alert('Error deleting file');
            } else {
              this.viewFiles = this.viewFiles.filter((f) => f.id !== id);
            }
          });
        }
      });
  }

  /**
   * Rename or assign this file to different teams.
   *
   * @param id: The GUID of the file
   * @param name: The current name of the file
   */
  editFile(id: string, name: string, teams: string[]) {
    this.dialogService
      .editFile(id, this.view.id, name, teams)
      .subscribe((val) => {
        if (val !== undefined) {
          const index = this.viewFiles.findIndex((f) => f.id === id);
          this.viewFiles[index].name = val['name'];
        }
      });
  }

  /**
   *
   * @param file Creates a player application pointing to this file
   */
  createApplication(file: FileModel) {
    const payload: Application = {
      name: file.name,
      url: this.getFileUri(file),
      embeddable: true,
      loadInBackground: false,
      viewId: this.view.id,
      icon: '/assets/img/SP_Icon_Intel.png', // Default icon rather than no icon
    };

    this.applicationService
      .createApplication(this.view.id, payload)
      .pipe(take(1))
      .subscribe(
        (application) => {
          this.appNames.push(application.name);
          this.dialogService
            .createApplication(application.id, file, this.view.name, this.teams)
            .subscribe((val) => {
              if (val !== undefined) {
                console.log('Create app for teams:  ', val);
              }
            });
        },
        (err) => {
          console.log('Error creating application ' + err);
        }
      );
  }

  /**
   * Gets the names of the apps already in this view so we don't duplicate an application
   */
  getExistingApps() {
    this.applicationService
      .getViewApplications(this.view.id)
      .pipe(take(1))
      .subscribe({
        next: (data) => {
          this.appNames = new Array<string>();
          for (const app of data) {
            this.appNames.push(app.name);
          }
        },
        error: (err) => {
          console.log('Error fetching apps');
          console.log(err);
        },
      });
  }

  /**
   * Called when the Teams select box for a file is changed.
   * @param event The event from the select box
   * @param file The file to update the teams for
   */
  teamsForFileUpdated(event: any, file: FileModel) {
    file.teamIds = event.value;
    this.fileService
      .updateFile(file.id, file.name, file.teamIds, null)
      .pipe(take(1))
      .subscribe();
  }

  /**
   * Returns true if the file is an image or pdf. If we want to support more image type, will have to modify this function
   *
   * @param file: The file to consider
   */
  private isImageOrPdf(file: string): boolean {
    return (
      file.endsWith('.pdf') ||
      file.endsWith('.jpeg') ||
      file.endsWith('.jpg') ||
      file.endsWith('.png') ||
      file.endsWith('.bmp') ||
      file.endsWith('.heic') ||
      file.endsWith('.gif')
    );
  }

  private getFileUri(file: FileModel) {
    let baseURI = document.baseURI;

    if (baseURI.endsWith('/')) {
      baseURI = baseURI.slice(0, baseURI.length - 1);
    }

    return `${baseURI}/file?id=${file.id}&name=${file.name}`;
  }
} // End Class

/** Error when invalid control is dirty, touched, or submitted. */
export class UserErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(
    control: UntypedFormControl | null,
    form: FormGroupDirective | NgForm | null
  ): boolean {
    const isSubmitted = form && form.submitted;
    return !!(control && control.invalid && (control.dirty || isSubmitted));
  }
}

class PlayerFile {
  file: File;
  id: string;

  constructor(file: File) {
    this.file = file;
  }
}
