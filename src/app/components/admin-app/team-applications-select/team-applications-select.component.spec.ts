// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamApplicationsSelectComponent } from './team-applications-select.component';

describe('ApplicationsSelectComponent', () => {
  let component: TeamApplicationsSelectComponent;
  let fixture: ComponentFixture<TeamApplicationsSelectComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [TeamApplicationsSelectComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TeamApplicationsSelectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
