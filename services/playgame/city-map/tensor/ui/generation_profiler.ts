type ProfileRow = {
    phase: string;
    ms: string;
    detail?: string;
};

export default class GenerationProfiler {
    private rows: ProfileRow[] = [];
    private started = performance.now();

    constructor(private label: string) {}

    time<T>(phase: string, run: () => T, detail?: () => string): T {
        const start = performance.now();
        const result = run();
        this.record(phase, performance.now() - start, detail?.());
        return result;
    }

    async timeAsync<T>(phase: string, run: () => Promise<T>, detail?: () => string): Promise<T> {
        const start = performance.now();
        const result = await run();
        this.record(phase, performance.now() - start, detail?.());
        return result;
    }

    record(phase: string, ms: number, detail?: string): void {
        this.rows.push({
            phase,
            ms: ms.toFixed(1),
            detail,
        });
    }

    finish(): void {
        this.record('total', performance.now() - this.started);
        const global = globalThis as typeof globalThis & { __tensorMapProfiles?: Array<{ label: string; rows: ProfileRow[] }> };
        global.__tensorMapProfiles = global.__tensorMapProfiles ?? [];
        global.__tensorMapProfiles.push({ label: this.label, rows: this.rows });
        global.__tensorMapProfiles = global.__tensorMapProfiles.slice(-10);
        console.log(`[TensorMap profile data] ${JSON.stringify({ label: this.label, rows: this.rows })}`);
        console.groupCollapsed(`[TensorMap profile] ${this.label}`);
        console.table(this.rows);
        console.groupEnd();
    }
}
