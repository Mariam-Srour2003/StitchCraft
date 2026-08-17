import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { SignInComponent } from './sign-in.component';

describe('SignInComponent', () => {
  let fixture: ComponentFixture<SignInComponent>;
  let authStore: { login: jest.Mock };
  let navigateSpy: jest.SpyInstance;

  beforeEach(async () => {
    authStore = { login: jest.fn() };

    // A real (empty-route) Router rather than a bare mock object: the
    // template's routerLink directive calls router.createUrlTree()
    // internally, which a plain `{ navigate: jest.fn() }` stub doesn't have.
    await TestBed.configureTestingModule({
      imports: [SignInComponent],
      providers: [provideRouter([]), { provide: AuthStore, useValue: authStore }],
    }).compileComponents();

    fixture = TestBed.createComponent(SignInComponent);
    navigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  });

  it('does not submit an invalid form', async () => {
    await fixture.componentInstance.submit();
    expect(authStore.login).not.toHaveBeenCalled();
  });

  it('logs in and navigates to /projects on valid submit', async () => {
    authStore.login.mockResolvedValueOnce(undefined);
    fixture.componentInstance['form'].setValue({ email: 'a@b.com', password: 'secret123' });

    await fixture.componentInstance.submit();

    expect(authStore.login).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secret123' });
    expect(navigateSpy).toHaveBeenCalledWith(['/projects']);
  });

  it('shows an error message and does not navigate if login fails', async () => {
    authStore.login.mockRejectedValueOnce(new Error('401'));
    fixture.componentInstance['form'].setValue({ email: 'a@b.com', password: 'wrong' });

    await fixture.componentInstance.submit();
    fixture.detectChanges();

    expect(fixture.componentInstance['error']()).toContain('Invalid email or password');
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Invalid email or password',
    );
  });

  it('disables the submit button while submitting', async () => {
    let resolveLogin!: () => void;
    authStore.login.mockReturnValueOnce(new Promise<void>((resolve) => (resolveLogin = resolve)));
    fixture.componentInstance['form'].setValue({ email: 'a@b.com', password: 'secret123' });

    const submitPromise = fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(fixture.componentInstance['submitting']()).toBe(true);

    resolveLogin();
    await submitPromise;
    expect(fixture.componentInstance['submitting']()).toBe(false);
  });

  it('renders a link to the register page', () => {
    const link = fixture.debugElement.query(By.css('a[routerLink="/register"]'));
    expect(link).toBeTruthy();
  });
});
