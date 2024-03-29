/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditSubscriptionComponent } from './edit-subscription.component';

describe('EditSubscriptionComponent', () => {
  let component: EditSubscriptionComponent;
  let fixture: ComponentFixture<EditSubscriptionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EditSubscriptionComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(EditSubscriptionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
