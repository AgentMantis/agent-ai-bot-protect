import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AllowedBotsComponent } from './allowed-bots.component';

describe('AllowedBotsComponent', () => {
  let component: AllowedBotsComponent;
  let fixture: ComponentFixture<AllowedBotsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AllowedBotsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AllowedBotsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
