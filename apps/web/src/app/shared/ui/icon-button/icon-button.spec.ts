import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { IconButton } from './icon-button';

describe('IconButton', () => {
  let fixture: ComponentFixture<IconButton>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [IconButton] }).compileComponents();
    fixture = TestBed.createComponent(IconButton);
    fixture.componentRef.setInput('label', 'Undo');
    fixture.detectChanges();
  });

  function nativeButton(): HTMLButtonElement {
    return fixture.debugElement.query(By.css('button')).nativeElement;
  }

  it('exposes the label as an accessible name via aria-label', () => {
    expect(nativeButton().getAttribute('aria-label')).toBe('Undo');
  });

  it('reflects the toggled state via aria-pressed', () => {
    expect(nativeButton().getAttribute('aria-pressed')).toBe('false');
    fixture.componentRef.setInput('toggled', true);
    fixture.detectChanges();
    expect(nativeButton().getAttribute('aria-pressed')).toBe('true');
  });

  it('emits `pressed` on click', () => {
    const spy = jest.fn();
    fixture.componentInstance.pressed.subscribe(spy);
    nativeButton().click();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
