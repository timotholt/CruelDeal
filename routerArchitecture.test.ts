import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { router, supportedRoutePaths } from './router';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('router architecture', () => {
  it('keeps App free of route-selection policy', () => {
    const app = source('./App.tsx');

    expect(app).not.toContain('window.location.pathname');
    expect(app).not.toContain('startsWith(');
    expect(app).not.toContain('components/screens/');
    expect(app).toContain('<RouterProvider router={router} />');
  });

  it('defines every supported route exactly once', () => {
    const paths = [...supportedRoutePaths];

    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) {
      expect(router.routesByPath[path], `missing router route for ${path}`).toBeDefined();
    }
  });

  it('assigns route-owned layout metadata to representative surfaces', () => {
    expect(router.routesByPath['/']?.options.staticData).toMatchObject({
      screen: 'MENU',
      surface: 'authenticated',
    });
    expect(router.routesByPath['/play']?.options.staticData).toMatchObject({
      screen: 'PLAY',
      surface: 'play',
    });
    expect(router.routesByPath['/deck']?.options.staticData).toMatchObject({
      screen: 'DECK',
      surface: 'authenticated',
    });
    expect(router.routesByPath['/login']?.options.staticData).toMatchObject({
      surface: 'public',
    });
    expect(router.routesByPath['/dev/shiny']?.options.staticData).toMatchObject({
      screen: 'GAME',
      surface: 'development',
    });
  });

  it('isolates mounted route surfaces from descendant reactive state', () => {
    const routeSource = source('./router.tsx');

    expect(routeSource).toContain('component: () => untrack(() => (');
    expect(routeSource).toContain('<ClassicPlayScreen');
    expect(routeSource).not.toContain(
      "component: () => <ClassicPlayScreen allowDebugSetup={import.meta.env.DEV}",
    );
  });

  it('isolates development screens behind the Vite lazy module catalog', () => {
    const routeSource = source('./router.tsx');
    const splitScreens = [
      'TensorMapView',
      'TensorPlayScreen',
      'CardFrameLabScreen',
      'UiMaterialLabScreen',
      'MainMaterialPreviewScreen',
      'GameTextTestScreen',
      'ShinyAuthoringScreen',
      'ShinyPerformanceScreen',
      'GameUiSkinProofScreen',
    ];

    expect(routeSource).toContain('const experimentalScreenModules = import.meta.glob<LazyScreenModule>([');
    expect(routeSource).not.toContain('lazy(() => import(');

    for (const screen of splitScreens) {
      expect(routeSource, `${screen} must remain behind the glob catalog`).toContain(
        `const ${screen} = lazyScreen`,
      );
      expect(routeSource).not.toMatch(
        new RegExp(`import\\s+\\{?\\s*${screen}\\s*\\}?\\s+from`),
      );
    }
  });
});
