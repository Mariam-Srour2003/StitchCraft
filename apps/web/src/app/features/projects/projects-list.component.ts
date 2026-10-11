import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Pattern, PatternType, Project } from '@stitchcraft/types';

import { SettingsStore } from '@app/core/settings/settings.store';
import { PatternsApiService } from '@app/data-access/patterns-api.service';
import { ProjectsApiService } from '@app/data-access/projects-api.service';
import { PATTERN_TYPE_LABELS, PATTERN_TYPES, sizingMeta } from '@app/domain/pattern/pattern-rules';
import { Button } from '@app/shared/ui/button/button';
import { EmptyState } from '@app/shared/ui/empty-state/empty-state';
import { Modal } from '@app/shared/ui/modal/modal';

@Component({
  selector: 'sc-projects-list',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, Button, EmptyState, Modal],
  templateUrl: './projects-list.component.html',
  styleUrl: './projects-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsListComponent {
  private readonly projectsApi = inject(ProjectsApiService);
  private readonly patternsApi = inject(PatternsApiService);
  private readonly router = inject(Router);
  private readonly settings = inject(SettingsStore);

  protected readonly patternTypes = PATTERN_TYPES;
  protected readonly typeLabels = PATTERN_TYPE_LABELS;

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
    width: new FormControl(40, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    height: new FormControl(40, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    // Physical sizing: fabric count applies to cross-stitch/color-by-number,
    // drill size (mm) to diamond - only one is relevant per pattern type, see template.
    fabricCount: new FormControl(this.settings.fabricCount(), {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    drillSizeMm: new FormControl(this.settings.drillSizeMm(), {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0.1)],
    }),
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

    const { name, type, width, height, fabricCount, drillSizeMm } =
      this.newPatternForm.getRawValue();
    const meta = sizingMeta(type, { fabricCount, drillSizeMm });
    const pattern = await firstValueFrom(
      this.patternsApi.create({ projectId, name, type, width, height, meta }),
    );
    this.closeNewPattern();
    await this.router.navigate(['/editor', pattern.id]);
  }

  /** Copies a pattern into the same project and refreshes that project's list. */
  async duplicatePattern(projectId: string, patternId: string): Promise<void> {
    await firstValueFrom(this.patternsApi.duplicate(patternId));
    const patterns = await firstValueFrom(this.patternsApi.listForProject(projectId));
    this.patternsByProject.update((byProject) => ({ ...byProject, [projectId]: patterns }));
    await this.refresh();
  }

  openPattern(patternId: string): void {
    this.router.navigate(['/editor', patternId]);
  }

  openConverter(projectId: string): void {
    this.router.navigate(['/converter', projectId]);
  }
}
