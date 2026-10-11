import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import type { Project } from '@stitchcraft/types';
import { encodeGrid } from '@stitchcraft/types';

import { AuthStore } from '@app/core/auth/auth.store';
import { SettingsStore } from '@app/core/settings/settings.store';
import { PatternsApiService } from '@app/data-access/patterns-api.service';
import { ProjectsApiService } from '@app/data-access/projects-api.service';
import { PATTERN_TYPE_LABELS, sizingMeta } from '@app/domain/pattern/pattern-rules';
import { PatternThumbnail } from '@app/shared/pattern/pattern-thumbnail';
import { Button } from '@app/shared/ui/button/button';
import { Modal } from '@app/shared/ui/modal/modal';

import {
  PatternTemplate,
  TEMPLATE_CATEGORIES,
  TemplateCategory,
  TemplateDesign,
  TEMPLATES,
} from './template-library';

interface TemplateCard {
  template: PatternTemplate;
  design: TemplateDesign;
}

const NEW_PROJECT = '__new__';

@Component({
  selector: 'sc-templates',
  standalone: true,
  imports: [FormsModule, RouterLink, Button, Modal, PatternThumbnail],
  templateUrl: './templates.component.html',
  styleUrl: './templates.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplatesComponent {
  protected readonly auth = inject(AuthStore);
  private readonly projectsApi = inject(ProjectsApiService);
  private readonly patternsApi = inject(PatternsApiService);
  private readonly settings = inject(SettingsStore);
  private readonly router = inject(Router);

  protected readonly categories = TEMPLATE_CATEGORIES;
  protected readonly typeLabels = PATTERN_TYPE_LABELS;
  protected readonly newProject = NEW_PROJECT;

  /** Built once: templates are deterministic, so previews never change. */
  private readonly cards: TemplateCard[] = TEMPLATES.map((template) => ({
    template,
    design: template.build(),
  }));

  protected readonly category = signal<TemplateCategory | 'All'>('All');
  protected readonly visible = computed(() => {
    const category = this.category();
    return category === 'All'
      ? this.cards
      : this.cards.filter((c) => c.template.category === category);
  });

  protected readonly chosen = signal<TemplateCard | null>(null);
  protected readonly projects = signal<Project[]>([]);
  protected readonly projectId = signal<string>(NEW_PROJECT);
  protected readonly newProjectName = signal('My templates');
  protected readonly patternName = signal('');
  protected readonly creating = signal(false);
  protected readonly error = signal<string | null>(null);

  async choose(card: TemplateCard): Promise<void> {
    this.chosen.set(card);
    this.patternName.set(card.template.name);
    this.error.set(null);
    try {
      const projects = await firstValueFrom(this.projectsApi.list());
      this.projects.set(projects);
      this.projectId.set(projects[0]?.id ?? NEW_PROJECT);
    } catch {
      this.projects.set([]);
      this.projectId.set(NEW_PROJECT);
    }
  }

  close(): void {
    this.chosen.set(null);
  }

  /** Creates the pattern (and a project, if asked), fills in the design, and opens the editor. */
  async create(): Promise<void> {
    const card = this.chosen();
    if (!card) return;
    this.creating.set(true);
    this.error.set(null);
    try {
      let projectId = this.projectId();
      if (projectId === NEW_PROJECT) {
        const project = await firstValueFrom(
          this.projectsApi.create({ name: this.newProjectName().trim() || 'My templates' }),
        );
        projectId = project.id;
      }
      const { template, design } = card;
      const meta = sizingMeta(template.type, {
        fabricCount: this.settings.fabricCount(),
        drillSizeMm: this.settings.drillSizeMm(),
      });
      const pattern = await firstValueFrom(
        this.patternsApi.create({
          projectId,
          name: this.patternName().trim() || template.name,
          type: template.type,
          width: design.width,
          height: design.height,
          palette: design.palette,
          meta,
        }),
      );
      await firstValueFrom(
        this.patternsApi.update(pattern.id, {
          grid: encodeGrid(design.rows.map((row) => row.map((v) => (v < 0 ? null : v)))),
        }),
      );
      this.chosen.set(null);
      await this.router.navigate(['/editor', pattern.id]);
    } catch {
      this.error.set('Could not create the pattern. Please try again.');
    } finally {
      this.creating.set(false);
    }
  }
}
