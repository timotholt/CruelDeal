export type GameUiDiagnosticSeverity = 'info' | 'warning' | 'error';

export interface GameUiDiagnostic {
  code: string;
  severity: GameUiDiagnosticSeverity;
  message: string;
  path?: string;
  id?: string;
  fallback?: string;
}

export const gameUiDiagnostic = (
  code: string,
  message: string,
  detail: Omit<GameUiDiagnostic, 'code' | 'message' | 'severity'> & {
    severity?: GameUiDiagnosticSeverity;
  } = {},
): GameUiDiagnostic => ({
  code,
  severity: detail.severity ?? 'warning',
  message,
  ...(detail.path ? { path: detail.path } : {}),
  ...(detail.id ? { id: detail.id } : {}),
  ...(detail.fallback ? { fallback: detail.fallback } : {}),
});

export const appendDiagnostics = (...groups: readonly GameUiDiagnostic[][]) => groups.flat();
