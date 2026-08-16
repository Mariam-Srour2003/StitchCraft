import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SegmentedToggle } from './segmented-toggle';

describe('SegmentedToggle', () => {
  let fixture: ComponentFixture<SegmentedToggle>;

  const options = [
    { value: 'x-stitch', label: 'X-Stitch' },
    { value: 'block', label: 'Block' },
    { value: 'symbol', label: 'Symbol' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SegmentedToggle] }).compileComponents();
    fixture = TestBed.createComponent(SegmentedToggle);
    fixture.componentRef.setInput('options', options);
    fixture.componentRef.setInput('value', 'x-stitch');
    fixture.detectChanges();
  });

  function optionButtons(): HTMLButtonElement[] {
    return fixture.debugElement.queryAll(By.css('button')).map((el) => el.nativeElement);
  }

  it('marks the selected option with aria-checked', () => {
    const buttons = optionButtons();
    expect(buttons[0].getAttribute('aria-checked')).toBe('true');
    expect(buttons[1].getAttribute('aria-checked')).toBe('false');
  });

  it('emits valueChange when a different option is clicked', () => {
    const spy = jest.fn();
    fixture.componentInstance.valueChange.subscribe(spy);
    optionButtons()[1].click();
    expect(spy).toHaveBeenCalledWith('block');
  });

  it('does not emit when clicking the already-selected option', () => {
    const spy = jest.fn();
    fixture.componentInstance.valueChange.subscribe(spy);
    optionButtons()[0].click();
    expect(spy).not.toHaveBeenCalled();
  });

  it('moves selection with ArrowRight, wrapping to the first option', () => {
    const spy = jest.fn();
    fixture.componentInstance.valueChange.subscribe(spy);
    fixture.componentInstance.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }), 2);
    expect(spy).toHaveBeenCalledWith('x-stitch');
  });

  it('only the selected option is keyboard-tabbable (roving tabindex)', () => {
    const buttons = optionButtons();
    expect(buttons[0].tabIndex).toBe(0);
    expect(buttons[1].tabIndex).toBe(-1);
  });
});
