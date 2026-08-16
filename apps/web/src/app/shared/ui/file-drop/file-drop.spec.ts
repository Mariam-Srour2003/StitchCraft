import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FileDrop } from './file-drop';

describe('FileDrop', () => {
  let fixture: ComponentFixture<FileDrop>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FileDrop] }).compileComponents();
    fixture = TestBed.createComponent(FileDrop);
    fixture.detectChanges();
  });

  function dropZone(): HTMLElement {
    return fixture.debugElement.query(By.css('.sc-file-drop')).nativeElement;
  }

  it('is a keyboard-focusable, labeled button role', () => {
    const el = dropZone();
    expect(el.getAttribute('role')).toBe('button');
    expect(el.tabIndex).toBe(0);
    expect(el.getAttribute('aria-label')).toContain('Upload an image');
  });

  it('emits filesSelected on drop', () => {
    const spy = jest.fn();
    fixture.componentInstance.filesSelected.subscribe(spy);
    const file = new File(['data'], 'photo.png', { type: 'image/png' });

    const dropEvent = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(dropEvent, 'dataTransfer', { value: { files: [file] } });
    dropZone().dispatchEvent(dropEvent);

    expect(spy).toHaveBeenCalledWith([file]);
  });

  it('clears the drag-over state after drop', () => {
    fixture.componentInstance.onDragOver(new Event('dragover') as DragEvent);
    expect(fixture.componentInstance['isDragOver']()).toBe(true);

    const dropEvent = new Event('drop') as DragEvent;
    Object.defineProperty(dropEvent, 'dataTransfer', { value: { files: [] } });
    fixture.componentInstance.onDrop(dropEvent);

    expect(fixture.componentInstance['isDragOver']()).toBe(false);
  });

  it('emits filesSelected when a file is chosen via the hidden input', () => {
    const spy = jest.fn();
    fixture.componentInstance.filesSelected.subscribe(spy);
    const file = new File(['data'], 'photo.png', { type: 'image/png' });
    const input: HTMLInputElement = fixture.debugElement.query(By.css('input')).nativeElement;

    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));

    expect(spy).toHaveBeenCalledWith([file]);
  });
});
