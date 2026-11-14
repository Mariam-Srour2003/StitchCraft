import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HelpComponent } from './help.component';

describe('HelpComponent', () => {
  it('renders the guide sections, glossary and shortcuts', async () => {
    await TestBed.configureTestingModule({
      imports: [HelpComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(HelpComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Getting started');
    expect(text).toContain('Aida');
    expect(text).toContain('How big will my finished piece be?');
    expect(text).toContain('Ctrl/⌘ Z');
  });
});
