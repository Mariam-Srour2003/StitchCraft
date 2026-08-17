import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ColorPicker } from './color-picker';

describe('ColorPicker', () => {
  let fixture: ComponentFixture<ColorPicker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ColorPicker] }).compileComponents();
    fixture = TestBed.createComponent(ColorPicker);
    fixture.detectChanges();
  });

  it('emits colorAdded with the hex and derived rgb when submitted', () => {
    const spy = jest.fn();
    fixture.componentInstance.colorAdded.subscribe(spy);

    fixture.componentInstance['hex'].set('#00FF00');
    fixture.componentInstance.addToPalette();

    expect(spy).toHaveBeenCalledWith({ hex: '#00FF00', rgb: { r: 0, g: 255, b: 0 } });
  });

  it('includes a trimmed label when one was entered', () => {
    const spy = jest.fn();
    fixture.componentInstance.colorAdded.subscribe(spy);

    fixture.componentInstance['hex'].set('#0000FF');
    fixture.componentInstance['label'].set('  Sky accent  ');
    fixture.componentInstance.addToPalette();

    expect(spy).toHaveBeenCalledWith({
      hex: '#0000FF',
      rgb: { r: 0, g: 0, b: 255 },
      label: 'Sky accent',
    });
  });

  it('omits the label field entirely when left blank', () => {
    const spy = jest.fn();
    fixture.componentInstance.colorAdded.subscribe(spy);

    fixture.componentInstance.addToPalette();

    expect(spy.mock.calls[0][0]).not.toHaveProperty('label');
  });

  it('clears the label after adding', () => {
    fixture.componentInstance['label'].set('temp');
    fixture.componentInstance.addToPalette();
    expect(fixture.componentInstance['label']()).toBe('');
  });

  it('submits via the form (button click) and reaches addToPalette', () => {
    const spy = jest.fn();
    fixture.componentInstance.colorAdded.subscribe(spy);

    fixture.debugElement.query(By.css('form')).triggerEventHandler('submit', new Event('submit'));

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
