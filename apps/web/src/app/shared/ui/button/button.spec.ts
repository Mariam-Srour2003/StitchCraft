import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Button } from './button';

describe('Button', () => {
  let fixture: ComponentFixture<Button>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Button] }).compileComponents();
    fixture = TestBed.createComponent(Button);
    fixture.detectChanges();
  });

  function nativeButton(): HTMLButtonElement {
    return fixture.debugElement.query(By.css('button')).nativeElement;
  }

  it('defaults to the primary variant', () => {
    expect(nativeButton().className).toContain('sc-button--primary');
  });

  it('reflects the variant input in its class list', () => {
    fixture.componentRef.setInput('variant', 'danger');
    fixture.detectChanges();
    expect(nativeButton().className).toContain('sc-button--danger');
  });

  it('emits `pressed` when clicked', () => {
    const spy = jest.fn();
    fixture.componentInstance.pressed.subscribe(spy);

    nativeButton().click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not emit `pressed` when disabled', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    const spy = jest.fn();
    fixture.componentInstance.pressed.subscribe(spy);

    nativeButton().click();

    expect(spy).not.toHaveBeenCalled();
    expect(nativeButton().disabled).toBe(true);
  });
});
