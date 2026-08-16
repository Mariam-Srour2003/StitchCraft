import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Modal } from './modal';

describe('Modal', () => {
  let fixture: ComponentFixture<Modal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Modal] }).compileComponents();
    fixture = TestBed.createComponent(Modal);
    fixture.componentRef.setInput('heading', 'Confirm');
    fixture.detectChanges();
  });

  it('renders the heading and marks the dialog as modal', () => {
    const dialog = fixture.debugElement.query(By.css('[role="dialog"]')).nativeElement as HTMLElement;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain('Confirm');
  });

  it('emits closed when the close button is clicked', () => {
    const spy = jest.fn();
    fixture.componentInstance.closed.subscribe(spy);
    fixture.debugElement.query(By.css('.sc-modal__close')).nativeElement.click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('emits closed on Escape', () => {
    const spy = jest.fn();
    fixture.componentInstance.closed.subscribe(spy);
    fixture.componentInstance.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('emits closed when the backdrop itself is clicked, not the panel', () => {
    const spy = jest.fn();
    fixture.componentInstance.closed.subscribe(spy);

    const backdrop = fixture.debugElement.query(By.css('.sc-modal-backdrop')).nativeElement as HTMLElement;
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not emit closed when clicking inside the panel content', () => {
    const spy = jest.fn();
    fixture.componentInstance.closed.subscribe(spy);

    const panel = fixture.debugElement.query(By.css('.sc-modal')).nativeElement as HTMLElement;
    panel.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(spy).not.toHaveBeenCalled();
  });
});
