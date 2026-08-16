import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  let fixture: ComponentFixture<EmptyState>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EmptyState] }).compileComponents();
    fixture = TestBed.createComponent(EmptyState);
    fixture.componentRef.setInput('title', 'No projects yet');
    fixture.detectChanges();
  });

  it('renders the title', () => {
    expect(fixture.nativeElement.textContent).toContain('No projects yet');
  });

  it('renders the description only when provided', () => {
    expect(fixture.nativeElement.querySelector('.sc-empty-state__description')).toBeNull();

    fixture.componentRef.setInput('description', 'Create your first pattern to get started.');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Create your first pattern');
  });
});
