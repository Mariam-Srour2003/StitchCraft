import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Project } from '@stitchcraft/types';
import { firstValueFrom } from 'rxjs';
import { Button } from '../../shared/ui/button/button';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { ProjectsApiService } from './projects-api.service';

@Component({
  selector: 'sc-projects-list',
  standalone: true,
  imports: [ReactiveFormsModule, Button, EmptyState],
  templateUrl: './projects-list.component.html',
  styleUrl: './projects-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsListComponent {
  private readonly projectsApi = inject(ProjectsApiService);

  protected readonly projects = signal<Project[]>([]);
  protected readonly loading = signal(true);
  protected readonly createForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
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
}
