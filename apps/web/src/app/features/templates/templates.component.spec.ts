import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter,Router } from '@angular/router';
import { of } from 'rxjs';

import { AuthStore } from '@app/core/auth/auth.store';
import { PatternsApiService } from '@app/data-access/patterns-api.service';
import { ProjectsApiService } from '@app/data-access/projects-api.service';

import { TEMPLATES } from './template-library';
import { TemplatesComponent } from './templates.component';

describe('TemplatesComponent', () => {
  let projectsApi: { list: jest.Mock; create: jest.Mock };
  let patternsApi: { create: jest.Mock; update: jest.Mock };

  const setup = async (authenticated = true) => {
    HTMLCanvasElement.prototype.getContext = jest.fn(() => null);
    projectsApi = {
      list: jest.fn().mockReturnValue(of([{ id: 'proj-1', name: 'Gifts', patternIds: [] }])),
      create: jest.fn().mockReturnValue(of({ id: 'proj-new', name: 'New', patternIds: [] })),
    };
    patternsApi = {
      create: jest.fn().mockReturnValue(of({ id: 'pat-1' })),
      update: jest.fn().mockReturnValue(of({ id: 'pat-1' })),
    };
    await TestBed.configureTestingModule({
      imports: [TemplatesComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: { isAuthenticated: signal(authenticated) } },
        { provide: ProjectsApiService, useValue: projectsApi },
        { provide: PatternsApiService, useValue: patternsApi },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(TemplatesComponent);
    fixture.detectChanges();
    return fixture;
  };

  it('lists every template and filters by category', async () => {
    const fixture = await setup();
    expect(fixture.nativeElement.querySelectorAll('.templates__card')).toHaveLength(
      TEMPLATES.length,
    );
    fixture.componentInstance['category'].set('Paint by number');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.templates__card')).toHaveLength(1);
  });

  it('asks signed-out visitors to sign in instead of creating', async () => {
    const fixture = await setup(false);
    expect(fixture.nativeElement.textContent).toContain('Sign in to use this template');
  });

  it('creates the pattern in an existing project, fills the grid and opens the editor', async () => {
    const fixture = await setup();
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const card = fixture.componentInstance['visible']()[0];
    await fixture.componentInstance.choose(card);
    await fixture.componentInstance.create();

    const dto = patternsApi.create.mock.calls[0][0];
    expect(dto).toMatchObject({
      projectId: 'proj-1',
      type: card.template.type,
      width: card.design.width,
      height: card.design.height,
    });
    expect(dto.palette).toHaveLength(card.design.palette.length);
    const [, update] = patternsApi.update.mock.calls[0];
    expect(update.grid).toHaveLength(card.design.height);
    expect(navigate).toHaveBeenCalledWith(['/editor', 'pat-1']);
    expect(projectsApi.create).not.toHaveBeenCalled();
  });

  it('can create a new project for the template', async () => {
    const fixture = await setup();
    jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await fixture.componentInstance.choose(fixture.componentInstance['visible']()[0]);
    fixture.componentInstance['projectId'].set('__new__');
    fixture.componentInstance['newProjectName'].set('Christmas');
    await fixture.componentInstance.create();
    expect(projectsApi.create).toHaveBeenCalledWith({ name: 'Christmas' });
    expect(patternsApi.create.mock.calls[0][0].projectId).toBe('proj-new');
  });
});
