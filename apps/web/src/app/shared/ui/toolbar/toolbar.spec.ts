import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Toolbar } from './toolbar';

describe('Toolbar', () => {
  let fixture: ComponentFixture<Toolbar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Toolbar] }).compileComponents();
    fixture = TestBed.createComponent(Toolbar);
    fixture.detectChanges();
  });

  it('exposes role="toolbar" with a default accessible name', () => {
    const el = fixture.debugElement.query(By.css('[role="toolbar"]')).nativeElement as HTMLElement;
    expect(el.getAttribute('aria-label')).toBe('Toolbar');
  });

  it('reflects a custom aria-label', () => {
    fixture.componentRef.setInput('ariaLabel', 'Editing tools');
    fixture.detectChanges();
    const el = fixture.debugElement.query(By.css('[role="toolbar"]')).nativeElement as HTMLElement;
    expect(el.getAttribute('aria-label')).toBe('Editing tools');
  });
});
