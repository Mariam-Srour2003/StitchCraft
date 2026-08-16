import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Pattern, Project } from '@stitchcraft/types';
import { of } from 'rxjs';
import { PatternsApiService } from '../patterns/patterns-api.service';
import { ProjectsListComponent } from './projects-list.component';
import { ProjectsApiService } from './projects-api.service';

const project: Project = {
  id: 'proj-1',
  userId: 'user-1',
  name: 'My sampler',
  patternIds: ['pattern-1'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const pattern: Pattern = {
  id: 'pattern-1',
  projectId: 'proj-1',
  name: 'Blank',
  type: 'cross_stitch',
  width: 40,
  height: 40,
  palette: [],
  grid: [],
  meta: { createdFrom: 'blank' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('ProjectsListComponent', () => {
  let fixture: ComponentFixture<ProjectsListComponent>;
  let projectsApi: { list: jest.Mock; create: jest.Mock; remove: jest.Mock };
  let patternsApi: { listForProject: jest.Mock; create: jest.Mock };
  let router: { navigate: jest.Mock };

  beforeEach(async () => {
    projectsApi = { list: jest.fn().mockReturnValue(of([project])), create: jest.fn(), remove: jest.fn() };
    patternsApi = { listForProject: jest.fn().mockReturnValue(of([pattern])), create: jest.fn() };
    router = { navigate: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [ProjectsListComponent],
      providers: [
        { provide: ProjectsApiService, useValue: projectsApi },
        { provide: PatternsApiService, useValue: patternsApi },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectsListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('loads and displays the project list', () => {
    expect(fixture.nativeElement.textContent).toContain('My sampler');
  });

  it('lazily loads a project\'s patterns only on first expand', async () => {
    await fixture.componentInstance.toggleExpand('proj-1');
    fixture.detectChanges();
    expect(patternsApi.listForProject).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Blank');

    await fixture.componentInstance.toggleExpand('proj-1'); // collapse
    await fixture.componentInstance.toggleExpand('proj-1'); // expand again
    expect(patternsApi.listForProject).toHaveBeenCalledTimes(1); // still cached, not refetched
  });

  it('creates a pattern and navigates to its editor route', async () => {
    patternsApi.create.mockReturnValueOnce(of(pattern));
    fixture.componentInstance.openNewPattern('proj-1');
    fixture.componentInstance.newPatternForm.patchValue({ name: 'Cat', type: 'diamond', width: 50, height: 60 });

    await fixture.componentInstance.createPattern();

    expect(patternsApi.create).toHaveBeenCalledWith({
      projectId: 'proj-1',
      name: 'Cat',
      type: 'diamond',
      width: 50,
      height: 60,
    });
    expect(router.navigate).toHaveBeenCalledWith(['/editor', 'pattern-1']);
    expect(fixture.componentInstance.newPatternProjectId()).toBeNull();
  });

  it('does not create a pattern when the form is invalid', async () => {
    fixture.componentInstance.openNewPattern('proj-1');
    fixture.componentInstance.newPatternForm.patchValue({ width: 0 });

    await fixture.componentInstance.createPattern();

    expect(patternsApi.create).not.toHaveBeenCalled();
  });

  it('opening an existing pattern navigates straight to its editor route', () => {
    fixture.componentInstance.openPattern('pattern-1');
    expect(router.navigate).toHaveBeenCalledWith(['/editor', 'pattern-1']);
  });
});
