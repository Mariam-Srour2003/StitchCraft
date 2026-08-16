import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Pattern, PatternType, Project } from '@stitchcraft/types';
import { firstValueFrom } from 'rxjs';
import { PatternsApiService } from '../patterns/patterns-api.service';
import { Button } from '../../shared/ui/button/button';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { Modal } from '../../shared/ui/modal/modal';
import { ProjectsApiService } from './projects-api.service';

const PATTERN_TYPES: PatternType[] = ['cross_stitch', 'color_by_number', 'diamond'];

@Component({
  selector: 'sc-projects-list',
  standalone: true,
  imports: [ReactiveFormsModule, Button, EmptyState, Modal],
  templateUrl: './projects-list.component.html',
  styleUrl: './projects-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsListComponent {
  private readonly projectsApi = inject(ProjectsApiService);
  private readonly patternsApi = inject(PatternsApiService);
  private readonly router = inject(Router);

  protected readonly patternTypes = PATTERN_TYPES;

  protected readonly projects = signal<Project[]>([]);
  protected readonly loading = signal(true);
  protected readonly createForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly expandedProjectId = signal<string | null>(null);
  protected readonly patternsByProject = signal<Record<string, Pattern[]>>({});
  protected readonly newPatternProjectId = signal<string | null>(null);
  protected readonly newPatternForm = new FormGroup({
    name: new FormControl('New pattern', { nonNullable: true, validators: [Validators.required] }),
    type: new FormControl<PatternType>('cross_stitch', { nonNullable: true }),
    width: new FormControl(40, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    height: new FormControl(40, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
  });

  constructor() {
    this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      const projects = await firstValueFrom(this.projectsApi.list());
      this.projects.set(projects);
    } finally {
      this.loading.set(false);
    }
  }

  async createProject(): Promise<void> {
    if (this.createForm.invalid) return;
    const name = this.createForm.controls.name.value;
    await firstValueFrom(this.projectsApi.create({ name }));
    this.createForm.reset();
    await this.refresh();
  }

  async deleteProject(id: string): Promise<void> {
    await firstValueFrom(this.projectsApi.remove(id));
    await this.refresh();
  }

  async toggleExpand(projectId: string): Promise<void> {
    if (this.expandedProjectId() === projectId) {
      this.expandedProjectId.set(null);
      return;
    }
    this.expandedProjectId.set(projectId);
    if (!this.patternsByProject()[projectId]) {
      const patterns = await firstValueFrom(this.patternsApi.listForProject(projectId));
      this.patternsByProject.update((byProject) => ({ ...byProject, [projectId]: patterns }));
    }
  }

  openNewPattern(projectId: string): void {
    this.newPatternProjectId.set(projectId);
  }

  closeNewPattern(): void {
    this.newPatternProjectId.set(null);
  }

  async createPattern(): Promise<void> {
    const projectId = this.newPatternProjectId();
    if (!projectId || this.newPatternForm.invalid) return;

    const { name, type, width, height } = this.newPatternForm.getRawValue();
    const pattern = await firstValueFrom(this.patternsApi.create({ projectId, name, type, width, height }));
    this.closeNewPattern();
    await this.router.navigate(['/editor', pattern.id]);
  }

  openPattern(patternId: string): void {
    this.router.navigate(['/editor', patternId]);
  }
}
