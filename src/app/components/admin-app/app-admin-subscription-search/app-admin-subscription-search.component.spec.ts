import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppAdminSubscriptionSearchComponent } from './app-admin-subscription-search.component';

describe('AppAdminSubscriptionSearchComponent', () => {
  let component: AppAdminSubscriptionSearchComponent;
  let fixture: ComponentFixture<AppAdminSubscriptionSearchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AppAdminSubscriptionSearchComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AppAdminSubscriptionSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
