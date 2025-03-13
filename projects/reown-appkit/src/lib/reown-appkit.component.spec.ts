import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReownAppkitComponent } from './reown-appkit.component';

describe('ReownAppkitComponent', () => {
  let component: ReownAppkitComponent;
  let fixture: ComponentFixture<ReownAppkitComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReownAppkitComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ReownAppkitComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
