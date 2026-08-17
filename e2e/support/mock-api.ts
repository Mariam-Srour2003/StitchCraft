import { Page } from '@playwright/test';
import {
  AuthResponse,
  EncodedRow,
  ExportResponse,
  Pattern,
  Project,
  User,
} from '@stitchcraft/types';

export const TEST_USER: User = {
  id: 'user-1',
  email: 'e2e@stitchcraft.dev',
  name: 'E2E Tester',
  createdAt: '2026-01-01T00:00:00.000Z',
};

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function blankGrid(width: number, height: number): EncodedRow[] {
  return Array.from({ length: height }, () => [[null, width]]);
}

/**
 * Mocks the whole /api surface used by the two critical-path e2e flows via
 * page.route() rather than a real backend - see playwright.config.ts for
 * why. State (projects/patterns) lives in-memory per test, keyed like the
 * real API, so a create -> load -> paint -> save -> export sequence behaves
 * consistently within one test run.
 */
export async function mockApi(page: Page): Promise<void> {
  const projects = new Map<string, Project>();
  const patterns = new Map<string, Pattern>();

  await page.route('**/api/auth/login', (route) =>
    route.fulfill({
      json: {
        user: TEST_USER,
        accessToken: 'fake-access-token',
        refreshToken: 'fake-refresh-token',
      } satisfies AuthResponse,
    }),
  );

  await page.route('**/api/users/me', (route) => route.fulfill({ json: TEST_USER }));

  await page.route('**/api/projects', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { name: string };
      const now = new Date().toISOString();
      const project: Project = {
        id: nextId('proj'),
        userId: TEST_USER.id,
        name: body.name,
        patternIds: [],
        createdAt: now,
        updatedAt: now,
      };
      projects.set(project.id, project);
      return route.fulfill({ json: project });
    }
    return route.fulfill({ json: Array.from(projects.values()) });
  });

  // GET /patterns?projectId=... (list) - matched separately from the
  // path-param routes below since Playwright glob patterns match the full
  // URL including the query string.
  await page.route('**/api/patterns?*', (route) => {
    const url = new URL(route.request().url());
    const projectId = url.searchParams.get('projectId');
    const list = Array.from(patterns.values()).filter((p) => p.projectId === projectId);
    return route.fulfill({ json: list });
  });

  await page.route('**/api/patterns', async (route) => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: [] });
    const body = route.request().postDataJSON();
    const now = new Date().toISOString();
    const pattern: Pattern = {
      id: nextId('pattern'),
      projectId: body.projectId,
      name: body.name,
      type: body.type,
      width: body.width,
      height: body.height,
      palette: body.palette ?? [],
      grid: blankGrid(body.width, body.height),
      meta: { createdFrom: 'blank', ...body.meta },
      createdAt: now,
      updatedAt: now,
    };
    patterns.set(pattern.id, pattern);
    return route.fulfill({ json: pattern });
  });

  await page.route(/\/api\/patterns\/[^/?]+$/, async (route) => {
    const id = new URL(route.request().url()).pathname.split('/').pop()!;
    const method = route.request().method();

    if (method === 'GET') {
      const pattern = patterns.get(id);
      return pattern
        ? route.fulfill({ json: pattern })
        : route.fulfill({ status: 404, json: { message: 'Pattern not found' } });
    }
    if (method === 'PATCH') {
      const existing = patterns.get(id);
      const body = route.request().postDataJSON();
      const updated: Pattern = {
        ...(existing as Pattern),
        ...body,
        meta: { ...(existing?.meta as Pattern['meta']), ...body.meta },
        updatedAt: new Date().toISOString(),
      };
      patterns.set(id, updated);
      return route.fulfill({ json: updated });
    }
    return route.fulfill({ json: {} });
  });

  await page.route(/\/api\/exports\/[^/?]+$/, (route) =>
    route.fulfill({
      json: {
        pdfUrl: 'http://localhost/mock-export/chart.pdf',
        pngUrl: 'http://localhost/mock-export/chart.png',
        svgUrl: 'http://localhost/mock-export/chart.svg',
        materialsListUrl: 'http://localhost/mock-export/materials.csv',
      } satisfies ExportResponse,
    }),
  );

  // Conversion job: first poll reports "processing", second reports
  // "completed" with a fresh pattern - exercises the frontend's polling
  // loop against a real state transition, not just a single fixed response.
  let conversionPollCount = 0;
  const conversionJobId = 'job-1';

  await page.route('**/api/conversions', async (route) => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: {} });
    return route.fulfill({ json: { jobId: conversionJobId } });
  });

  await page.route(new RegExp(`/api/conversions/${conversionJobId}$`), (route) => {
    conversionPollCount += 1;
    const now = new Date().toISOString();

    if (conversionPollCount < 2) {
      return route.fulfill({
        json: {
          id: conversionJobId,
          userId: TEST_USER.id,
          status: 'processing',
          progress: 45,
          params: {
            sourceImageRef: 'x',
            targetType: 'cross_stitch',
            width: 10,
            height: 10,
            colorCount: 4,
          },
          createdAt: now,
          updatedAt: now,
        },
      });
    }

    const resultPattern: Pattern = {
      id: nextId('pattern'),
      projectId: Array.from(projects.keys())[0],
      name: 'Converted pattern',
      type: 'cross_stitch',
      width: 10,
      height: 10,
      palette: [
        {
          index: 0,
          symbol: 'A',
          color: {
            code: '310',
            name: 'Black',
            hex: '#000000',
            rgb: { r: 0, g: 0, b: 0 },
            lab: { l: 0, a: 0, b: 0 },
          },
        },
      ],
      grid: blankGrid(10, 10),
      meta: { createdFrom: 'conversion', sourceConversionJobId: conversionJobId },
      createdAt: now,
      updatedAt: now,
    };
    patterns.set(resultPattern.id, resultPattern);

    return route.fulfill({
      json: {
        id: conversionJobId,
        userId: TEST_USER.id,
        status: 'completed',
        progress: 100,
        resultPatternId: resultPattern.id,
        params: {
          sourceImageRef: 'x',
          targetType: 'cross_stitch',
          width: 10,
          height: 10,
          colorCount: 4,
        },
        createdAt: now,
        updatedAt: now,
      },
    });
  });
}

/** Seeds localStorage with fake tokens so the app treats us as already signed in, skipping the login form. */
export async function signInDirectly(page: Page): Promise<void> {
  await page.addInitScript(
    ([accessToken, refreshToken]) => {
      localStorage.setItem('stitchcraft.accessToken', accessToken);
      localStorage.setItem('stitchcraft.refreshToken', refreshToken);
    },
    ['fake-access-token', 'fake-refresh-token'],
  );
}
