import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { Button } from '../../shared/ui/button/button';

@Component({
  selector: 'sc-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, Button],
  templateUrl: './register.component.html',
  styleUrl: './auth-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent {
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly error = signal<string | null>(null);
  protected readonly submitting = signal(false);

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
  });

  async submit(): Promise<void> {
    if (this.form.invalid) return;
    this.submitting.set(true);
    this.error.set(null);
    try {
      await this.authStore.register(this.form.getRawValue());
      await this.router.navigate(['/projects']);
    } catch {
      this.error.set('Could not create an account with those details.');
    } finally {
      this.submitting.set(false);
    }
  }
}
