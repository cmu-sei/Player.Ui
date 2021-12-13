import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserPresencePageComponent } from './user-presence-page.component';

describe('UserPresencePageComponent', () => {
  let component: UserPresencePageComponent;
  let fixture: ComponentFixture<UserPresencePageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UserPresencePageComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(UserPresencePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
