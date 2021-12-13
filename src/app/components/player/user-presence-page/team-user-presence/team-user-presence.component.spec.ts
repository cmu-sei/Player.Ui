import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamUserPresenceComponent } from './team-user-presence.component';

describe('TeamUserPresenceComponent', () => {
  let component: TeamUserPresenceComponent;
  let fixture: ComponentFixture<TeamUserPresenceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TeamUserPresenceComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TeamUserPresenceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
