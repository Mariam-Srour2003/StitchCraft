import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Slider } from './slider';

describe('Slider', () => {
  let fixture: ComponentFixture<Slider>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Slider] }).compileComponents();
    fixture = TestBed.createComponent(Slider);
    fixture.componentRef.setInput('label', 'Zoom');
    fixture.componentRef.setInput('min', 10);
    fixture.componentRef.setInput('max', 400);
    fixture.componentRef.setInput('value', 100);
    fixture.detectChanges();
  });

  function input(): HTMLInputElement {
    return fixture.debugElement.query(By.css('input')).nativeElement;
  }

  it('renders the current value', () => {
    expect(input().value).toBe('100');
    expect(fixture.nativeElement.textContent).toContain('100');
  });

  it('emits valueChange with a number when moved', () => {
    const spy = jest.fn();
    fixture.componentInstance.valueChange.subscribe(spy);

    input().value = '250';
    input().dispatchEvent(new Event('input'));

    expect(spy).toHaveBeenCalledWith(250);
  });

  it('exposes min/max for assistive tech via aria-valuemin/max', () => {
    expect(input().getAttribute('aria-valuemin')).toBe('10');
    expect(input().getAttribute('aria-valuemax')).toBe('400');
  });
});
