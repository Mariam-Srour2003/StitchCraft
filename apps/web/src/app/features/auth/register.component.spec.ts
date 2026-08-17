import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { RegisterComponent } from './register.component';

describe('RegisterComponent', () => {
  let fixture: ComponentFixture<RegisterComponent>;
  let authStore: { register: jest.Mock };
  let navigateSpy: jest.SpyInstance;

  beforeEach(async () => {
    authStore = { register: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [provideRouter([]), { provide: AuthStore, useValue: authStore }],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    navigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  });

  it('does not submit an invalid form (e.g. password too short)', async () => {
    fixture.componentInstance['form'].setValue({ name: 'Ada', email: 'a@b.com', password: 'short' });
    await fixture.componentInstance.submit();
    expect(authStore.register).not.toHaveBeenCalled();
  });

  it('registers and navigates to /projects on valid submit', async () => {
    authStore.register.mockResolvedValueOnce(undefined);
    fixture.componentInstance['form'].setValue({ name: 'Ada', email: 'a@b.com', password: 'password123' });

    await fixture.componentInstance.submit();

    expect(authStore.register).toHaveBeenCalledWith({ name: 'Ada', email: 'a@b.com', password: 'password123' });
    expect(navigateSpy).toHaveBeenCalledWith(['/projects']);
  });

  it('shows an error message if registration fails (e.g. email already taken)', async () => {
    authStore.register.mockRejectedValueOnce(new Error('409'));
    fixture.componentInstance['form'].setValue({ name: 'Ada', email: 'a@b.com', password: 'password123' });

    await fixture.componentInstance.submit();
    fixture.detectChanges();

    expect(fixture.componentInstance['error']()).toContain('Could not create an account');
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('renders a link back to sign-in', () => {
    const link = fixture.debugElement.query(By.css('a[routerLink="/sign-in"]'));
    expect(link).toBeTruthy();
  });
});
