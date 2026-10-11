import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ProjectsApiService } from '../projects/projects-api.service';
import { PatternLibraryService } from './pattern-library.service';
import { PatternsApiService } from './patterns-api.service';

describe('PatternLibraryService', () => {
  it('flattens patterns across projects, newest first, skipping empty projects', async () => {
    const projects = [
      { id: 'a', name: 'A', patternIds: ['p1'] },
      { id: 'b', name: 'B', patternIds: ['p2'] },
      { id: 'c', name: 'C', patternIds: [] },
    ];
    const listForProject = jest.fn((id: string) =>
      of(
        id === 'a'
          ? [{ id: 'p1', updatedAt: '2026-01-01T00:00:00Z' }]
          : [{ id: 'p2', updatedAt: '2026-02-01T00:00:00Z' }],
      ),
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: ProjectsApiService, useValue: { list: () => of(projects) } },
        { provide: PatternsApiService, useValue: { listForProject } },
      ],
    });

    const result = await TestBed.inject(PatternLibraryService).loadAll();

    expect(result.patterns.map((p) => p.pattern.id)).toEqual(['p2', 'p1']);
    expect(result.patterns[0].project.name).toBe('B');
    expect(listForProject).toHaveBeenCalledTimes(2);
  });
});
