import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query';
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from 'solid-js';
import {
  AssetCandidateRecord,
  AssetKind,
  GenerationProvider,
  buildPromptForAsset,
  buildWorkbenchAssets,
  CandidateStatus,
  WorkbenchAsset,
  WorkbenchState,
} from '@/services/assets/workbench';

interface ProviderStatus {
  openai: boolean;
  leonardo: boolean;
  openaiSource: string;
  leonardoSource: string;
  source: string;
}

interface TreeGroup {
  kind: AssetKind;
  label: string;
  detail: string;
  assets: WorkbenchAsset[];
}

const apiJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Asset API failed with ${response.status}`);
  return data as T;
};

const normalizeCandidateImage = async (candidate: AssetCandidateRecord): Promise<void> => {
  const img = new Image();
  img.decoding = 'async';
  img.src = `${candidate.rawPath}?v=${candidate.updatedAt}`;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Could not load ${candidate.rawPath}`));
  });

  const canvas = document.createElement('canvas');
  canvas.width = candidate.committedSize.w;
  canvas.height = candidate.committedSize.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create image normalization canvas');

  const scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
  const sourceWidth = canvas.width / scale;
  const sourceHeight = canvas.height / scale;
  const sourceX = (img.naturalWidth - sourceWidth) / 2;
  const sourceY = (img.naturalHeight - sourceHeight) / 2;
  ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);

  await apiJson('/api/assets/normalize', {
    method: 'POST',
    body: JSON.stringify({ id: candidate.id, dataUrl: canvas.toDataURL('image/webp', 0.88) }),
  });
};

const statusClass = (status: string): string => {
  if (status === 'promoted') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (status === 'approved') return 'text-sky-700 bg-sky-50 border-sky-200';
  if (status === 'generated') return 'text-amber-800 bg-amber-50 border-amber-200';
  if (status === 'rejected') return 'text-rose-700 bg-rose-50 border-rose-200';
  if (status === 'deprecated') return 'text-orange-800 bg-orange-50 border-orange-200';
  return 'text-slate-600 bg-slate-100 border-slate-200';
};

const kindLabel = (kind: AssetKind): string => {
  if (kind === 'location-lane') return 'Locations';
  if (kind === 'card-front') return 'Card Fronts';
  return 'Card Backs';
};

const providerLinks = [
  { label: 'OpenAI keys', href: 'https://platform.openai.com/api-keys' },
  { label: 'Image docs', href: 'https://platform.openai.com/docs/guides/image-generation' },
  { label: 'Leonardo API', href: 'https://docs.leonardo.ai/docs/getting-started' },
  { label: 'Leonardo app', href: 'https://app.leonardo.ai/' },
];

export const AssetWorkbenchScreen = () => {
  const assets = createMemo(() => buildWorkbenchAssets());
  const [selectedId, setSelectedId] = createSignal(assets()[0]?.id ?? '');
  const [provider, setProvider] = createSignal<GenerationProvider>('openai');
  const [prompt, setPrompt] = createSignal('');
  const [notes, setNotes] = createSignal('');
  const [message, setMessage] = createSignal<string | null>(null);
  const [showProviderInfo, setShowProviderInfo] = createSignal(false);
  const [expanded, setExpanded] = createSignal<Record<AssetKind, boolean>>({
    'location-lane': true,
    'card-back': true,
    'card-front': true,
  });
  const queryClient = useQueryClient();

  const stateQuery = createQuery(() => ({
    queryKey: ['asset-workbench-state'],
    queryFn: () => apiJson<WorkbenchState>('/api/assets/state'),
  }));

  const providerQuery = createQuery(() => ({
    queryKey: ['asset-provider-status'],
    queryFn: () => apiJson<ProviderStatus>('/api/assets/provider-status'),
  }));

  const candidates = createMemo(() => stateQuery.data?.candidates ?? []);
  const selectedAsset = createMemo(() => assets().find((asset) => asset.id === selectedId()) ?? assets()[0]);

  const candidatesFor = (asset: WorkbenchAsset): AssetCandidateRecord[] => (
    candidates().filter((candidate) => candidate.assetKind === asset.kind && candidate.assetId === asset.defId)
  );

  const latestCandidateFor = (asset: WorkbenchAsset): AssetCandidateRecord | undefined => candidatesFor(asset)[0];
  const approvedCandidateFor = (asset: WorkbenchAsset): AssetCandidateRecord | undefined => (
    candidatesFor(asset).find((candidate) => candidate.status === 'approved' || candidate.status === 'promoted')
  );

  const assetStatus = (asset: WorkbenchAsset): CandidateStatus | 'missing' | 'deprecated' | 'ready' => (
    latestCandidateFor(asset)?.status ?? asset.statusHint
  );

  const selectedCandidates = createMemo(() => {
    const asset = selectedAsset();
    return asset ? candidatesFor(asset) : [];
  });

  const selectedApproved = createMemo(() => {
    const asset = selectedAsset();
    return asset ? approvedCandidateFor(asset) : undefined;
  });

  const treeGroups = createMemo<TreeGroup[]>(() => {
    const byKind = new Map<AssetKind, WorkbenchAsset[]>();
    for (const asset of assets()) {
      const list = byKind.get(asset.kind) ?? [];
      list.push(asset);
      byKind.set(asset.kind, list);
    }
    return (['location-lane', 'card-back', 'card-front'] as AssetKind[]).map((kind) => {
      const list = byKind.get(kind) ?? [];
      const open = list.filter((asset) => assetStatus(asset) !== 'promoted').length;
      return {
        kind,
        label: kindLabel(kind),
        detail: `${open}/${list.length} open`,
        assets: list,
      };
    });
  });

  const counts = createMemo(() => {
    const out = { open: 0, generated: 0, approved: 0, promoted: 0 };
    for (const asset of assets()) {
      const status = assetStatus(asset);
      if (status !== 'promoted') out.open += 1;
      if (status === 'generated') out.generated += 1;
      if (status === 'approved') out.approved += 1;
      if (status === 'promoted') out.promoted += 1;
    }
    return out;
  });

  createEffect(() => {
    const asset = selectedAsset();
    if (!asset) return;
    const latest = latestCandidateFor(asset);
    setPrompt(latest?.finalPrompt || buildPromptForAsset(asset));
    setNotes(latest?.reviewerNotes || '');
  });

  const generateMutation = createMutation(() => ({
    mutationFn: async (asset: WorkbenchAsset) => {
      setMessage('Generating candidate...');
      const result = await apiJson<{ candidate: AssetCandidateRecord }>('/api/assets/generate', {
        method: 'POST',
        body: JSON.stringify({
          assetKind: asset.kind,
          assetId: asset.defId,
          displayName: asset.displayName,
          provider: provider(),
          prompt: prompt(),
          promptInputs: asset.promptInputs,
          committedSize: { w: asset.spec.width, h: asset.spec.height },
          aspectRatio: asset.spec.aspectRatio,
          engineTargetPath: asset.targetPath,
          manifestPath: asset.manifestFile,
        }),
      });
      setMessage('Normalizing image...');
      await normalizeCandidateImage(result.candidate);
      return result.candidate;
    },
    onSuccess: async () => {
      setMessage('Generation saved.');
      await queryClient.invalidateQueries({ queryKey: ['asset-workbench-state'] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : String(error)),
  }));

  const statusMutation = createMutation(() => ({
    mutationFn: ({ id, status }: { id: string; status: CandidateStatus }) => apiJson('/api/assets/status', {
      method: 'POST',
      body: JSON.stringify({ id, status, reviewerNotes: notes() || undefined }),
    }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['asset-workbench-state'] }),
    onError: (error) => setMessage(error instanceof Error ? error.message : String(error)),
  }));

  const promoteMutation = createMutation(() => ({
    mutationFn: (id: string) => apiJson('/api/assets/promote', {
      method: 'POST',
      body: JSON.stringify({ id }),
    }),
    onSuccess: async () => {
      setMessage('Promoted into game assets.');
      await queryClient.invalidateQueries({ queryKey: ['asset-workbench-state'] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : String(error)),
  }));

  const approveCandidate = (candidate: AssetCandidateRecord) => {
    statusMutation.mutate({ id: candidate.id, status: 'approved' });
  };

  const rejectCandidate = (candidate: AssetCandidateRecord) => {
    statusMutation.mutate({ id: candidate.id, status: 'rejected' });
  };

  const promoteApproved = () => {
    const candidate = selectedApproved();
    if (candidate) promoteMutation.mutate(candidate.id);
  };

  const selectRelative = (delta: number) => {
    const flat = treeGroups().flatMap((group) => group.assets);
    const currentIndex = flat.findIndex((asset) => asset.id === selectedId());
    const next = flat[Math.max(0, Math.min(flat.length - 1, currentIndex + delta))];
    if (next) setSelectedId(next.id);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) return;
    if (event.key.toLowerCase() === 'g') {
      const asset = selectedAsset();
      if (asset) generateMutation.mutate(asset);
    }
    if (event.key.toLowerCase() === 'a' && selectedCandidates()[0]) approveCandidate(selectedCandidates()[0]);
    if (event.key.toLowerCase() === 'r' && selectedCandidates()[0]) rejectCandidate(selectedCandidates()[0]);
    if (event.key.toLowerCase() === 'p') promoteApproved();
    if (event.key.toLowerCase() === 'j' || event.key.toLowerCase() === 'n') selectRelative(1);
    if (event.key.toLowerCase() === 'k') selectRelative(-1);
  };

  window.addEventListener('keydown', onKeyDown);
  onCleanup(() => window.removeEventListener('keydown', onKeyDown));

  return (
    <div class="asset-foundry-app h-[100vh] w-full overflow-hidden bg-[#e7e2d8] text-[12px] text-slate-900">
      <style>{`
        html, body, #root { height: 100%; overflow: hidden; }
        .asset-foundry-app * { scrollbar-width: thin; scrollbar-color: #a99f90 #e8e1d6; }
        .asset-foundry-app *::-webkit-scrollbar { display: block; width: 10px; height: 10px; }
        .asset-foundry-app *::-webkit-scrollbar-track { background: #e8e1d6; }
        .asset-foundry-app *::-webkit-scrollbar-thumb { background: #a99f90; border: 2px solid #e8e1d6; border-radius: 999px; }
        .asset-foundry-app *::-webkit-scrollbar-thumb:hover { background: #83786a; }
        .asset-foundry-scroll { overflow-y: scroll; scrollbar-gutter: stable; }
      `}</style>
      <div class="flex h-full flex-col">
        <header class="flex h-9 shrink-0 items-center justify-between border-b border-[#c8c0b2] bg-[#f5f1e8] px-3 shadow-sm">
          <div class="flex items-center gap-3">
            <div class="flex gap-1.5">
              <span class="h-2 w-2 rounded-full bg-[#ff5f57]" />
              <span class="h-2 w-2 rounded-full bg-[#ffbd2e]" />
              <span class="h-2 w-2 rounded-full bg-[#28c840]" />
            </div>
            <div class="h-5 w-px bg-[#d2cabe]" />
            <div>
              <div class="text-[12px] font-semibold tracking-tight">Cruel Deal Asset Foundry</div>
              <div class="text-[9px] text-slate-500">Standalone local production tool</div>
            </div>
          </div>
          <div class="flex items-center gap-4 text-[10px] text-slate-600">
            <a class="rounded border border-[#c8c0b2] bg-white/60 px-2 py-1 font-semibold text-slate-700 no-underline hover:bg-white" href="/tools/asset-foundry/?tool=card-backs">Card Back Foundry</a>
            <span>Open {counts().open}</span>
            <span>Generated {counts().generated}</span>
            <span>Approved {counts().approved}</span>
            <span>Promoted {counts().promoted}</span>
          </div>
        </header>

        <div class="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)_370px]">
          <aside class="flex min-h-0 flex-col border-r border-[#c8c0b2] bg-[#eee9df]">
            <div class="shrink-0 border-b border-[#d5cec1] p-1.5">
              <div class="rounded border border-[#cec5b8] bg-white/60 px-2 py-1 text-[10px] text-slate-600 shadow-inner">
                Source tree from active manifest
              </div>
            </div>
            <div class="asset-foundry-scroll min-h-0 flex-1 px-1 py-1">
              <For each={treeGroups()}>
                {(group) => (
                  <section class="mb-0.5">
                    <button
                      type="button"
                      class="flex h-[19px] w-full items-center gap-1 rounded px-1 text-left text-[11px] font-semibold hover:bg-white/50"
                      onClick={() => setExpanded((prev) => ({ ...prev, [group.kind]: !prev[group.kind] }))}
                    >
                      <span class="w-3 text-slate-500">{expanded()[group.kind] ? '▾' : '▸'}</span>
                      <span class="flex-1">{group.label}</span>
                      <span class="text-[9px] font-medium text-slate-500">{group.detail}</span>
                    </button>
                    <Show when={expanded()[group.kind]}>
                      <div class="space-y-0 pl-4">
                        <For each={group.assets}>
                          {(asset) => (
                            <button
                              type="button"
                              class={`flex h-[19px] w-full items-center gap-1.5 rounded px-1 text-left text-[11px] leading-none ${selectedId() === asset.id ? 'bg-[#2f6fed] text-white shadow-sm' : 'hover:bg-white/60'}`}
                              onClick={() => setSelectedId(asset.id)}
                            >
                              <span class={`h-1.5 w-1.5 rounded-full ${assetStatus(asset) === 'promoted' ? 'bg-emerald-500' : assetStatus(asset) === 'approved' ? 'bg-sky-500' : assetStatus(asset) === 'generated' ? 'bg-amber-500' : assetStatus(asset) === 'rejected' ? 'bg-rose-500' : 'bg-slate-400'}`} />
                              <span class="min-w-0 flex-1 truncate">{asset.displayName}</span>
                            </button>
                          )}
                        </For>
                      </div>
                    </Show>
                  </section>
                )}
              </For>
            </div>
          </aside>

          <main class="asset-foundry-scroll min-h-0 bg-[#f7f4ee] p-3">
            <Show when={selectedAsset()} keyed>
              {(asset) => (
                <div class="mx-auto max-w-5xl">
                  <div class="mb-3 flex items-start justify-between gap-4">
                    <div>
                      <div class="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">{kindLabel(asset.kind)}</div>
                      <h1 class="mt-0.5 text-2xl font-semibold tracking-tight">{asset.displayName}</h1>
                      <div class="mt-1 font-mono text-xs text-slate-500">{asset.defId}</div>
                    </div>
                    <div class={`rounded-md border px-2.5 py-1 text-xs font-semibold ${statusClass(assetStatus(asset))}`}>
                      {assetStatus(asset)}
                    </div>
                  </div>

                  <div class="grid grid-cols-[minmax(210px,300px)_1fr] gap-4">
                    <section class="rounded-lg border border-[#d6cec0] bg-white p-3 shadow-sm">
                      <div class="mb-3 flex items-center justify-between">
                        <h2 class="text-[13px] font-semibold">Current / Target</h2>
                        <span class="rounded bg-slate-100 px-2 py-1 font-mono text-[0.65rem] text-slate-600">
                          {asset.spec.width}×{asset.spec.height}
                        </span>
                      </div>
                      <div class={`mx-auto overflow-hidden rounded-lg border border-slate-200 bg-slate-100 ${asset.kind === 'location-lane' ? 'aspect-[4/15] max-h-[520px]' : 'aspect-[5/7] max-h-[420px]'}`}>
                        <Show when={selectedCandidates()[0]?.normalizedPath || asset.currentPath} fallback={
                          <div class="flex h-full items-center justify-center text-sm text-slate-400">No promoted art</div>
                        }>
                          {(src) => <img class="h-full w-full object-cover" src={src()} alt="" />}
                        </Show>
                      </div>
                      <div class="mt-3 break-all font-mono text-[0.68rem] leading-relaxed text-slate-500">
                        {asset.targetPath}
                      </div>
                    </section>

                    <section class="rounded-lg border border-[#d6cec0] bg-white p-3 shadow-sm">
                      <div class="mb-3 flex items-center justify-between">
                        <h2 class="text-[13px] font-semibold">Generations</h2>
                        <button
                          type="button"
                          class="rounded-md bg-[#2f6fed] px-3 py-1.5 text-xs font-semibold text-white shadow-sm disabled:opacity-50"
                          disabled={generateMutation.isPending}
                          onClick={() => generateMutation.mutate(asset)}
                        >
                          {generateMutation.isPending ? 'Generating...' : 'Generate'}
                        </button>
                      </div>

                      <div class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
                        <For each={selectedCandidates()}>
                          {(candidate) => (
                            <article class="rounded-lg border border-slate-200 bg-slate-50 p-2">
                              <div class={`overflow-hidden rounded-md border border-slate-200 bg-white ${candidate.assetKind === 'location-lane' ? 'aspect-[4/15]' : 'aspect-[5/7]'}`}>
                                <img class="h-full w-full object-cover" src={`${candidate.normalizedPath}?v=${candidate.updatedAt}`} alt="" />
                              </div>
                              <div class="mt-2 flex items-center justify-between gap-2">
                                <span class={`rounded border px-1.5 py-0.5 text-[0.62rem] font-semibold ${statusClass(candidate.status)}`}>
                                  {candidate.status}
                                </span>
                                <span class="truncate text-[0.62rem] text-slate-500">{candidate.provider}</span>
                              </div>
                              <div class="mt-2 grid grid-cols-2 gap-1.5">
                                <button class="rounded border border-sky-200 bg-sky-50 px-2 py-1 text-[0.68rem] font-semibold text-sky-700" onClick={() => approveCandidate(candidate)}>Approve</button>
                                <button class="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[0.68rem] font-semibold text-rose-700" onClick={() => rejectCandidate(candidate)}>Reject</button>
                              </div>
                            </article>
                          )}
                        </For>
                        <Show when={selectedCandidates().length === 0}>
                          <div class="col-span-full rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                            No generations yet. The first one will appear here with its exact prompt and metadata stored in the ledger.
                          </div>
                        </Show>
                      </div>
                    </section>
                  </div>
                </div>
              )}
            </Show>
          </main>

          <aside class="asset-foundry-scroll min-h-0 border-l border-[#c8c0b2] bg-[#f1ece2] p-3">
            <Show when={selectedAsset()} keyed>
              {(asset) => (
                <div class="space-y-3">
                  <section class="rounded-lg border border-[#d6cec0] bg-white p-3 shadow-sm">
                    <div class="mb-2 flex items-center justify-between">
                      <h2 class="text-[13px] font-semibold">Prompt Setup</h2>
                      <button
                        type="button"
                        class="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-white"
                        onClick={() => setShowProviderInfo(true)}
                      >
                        Provider info
                      </button>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                      <label class="block">
                        <span class="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Provider</span>
                        <select
                          class="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[12px]"
                          value={provider()}
                          onChange={(event) => setProvider(event.currentTarget.value as GenerationProvider)}
                        >
                          <option value="openai">OpenAI {providerQuery.data?.openai ? '✓' : 'empty/missing'}</option>
                          <option value="leonardo">Leonardo {providerQuery.data?.leonardo ? '✓' : 'empty/missing'}</option>
                        </select>
                      </label>
                      <label class="block">
                        <span class="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Model</span>
                        <select class="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[12px]" disabled>
                          <option>{provider() === 'openai' ? 'gpt-image-1' : 'Default / LEONARDO_MODEL_ID'}</option>
                        </select>
                      </label>
                    </div>
                  </section>

                  <section class="rounded-lg border border-[#d6cec0] bg-white p-3 shadow-sm">
                    <div class="mb-3 flex items-center justify-between">
                      <h2 class="text-[13px] font-semibold">Prompt</h2>
                      <button class="text-xs font-medium text-[#2f6fed]" type="button" onClick={() => setPrompt(buildPromptForAsset(asset))}>Reset</button>
                    </div>
                    <textarea
                      class="h-72 w-full resize-none overflow-y-scroll rounded-lg border border-slate-300 bg-[#fbfaf7] p-2.5 font-mono text-[11px] leading-relaxed outline-none focus:border-[#2f6fed] focus:ring-2 focus:ring-blue-100"
                      value={prompt()}
                      onInput={(event) => setPrompt(event.currentTarget.value)}
                    />
                  </section>

                  <section class="rounded-lg border border-[#d6cec0] bg-white p-3 shadow-sm">
                    <h2 class="text-[13px] font-semibold">Approval Status</h2>
                    <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div class="rounded-md bg-slate-50 p-2">
                        <div class="text-slate-500">Output</div>
                        <div class="mt-1 font-mono">{asset.spec.width}×{asset.spec.height}</div>
                      </div>
                      <div class="rounded-md bg-slate-50 p-2">
                        <div class="text-slate-500">Ratio</div>
                        <div class="mt-1 font-mono">{asset.spec.aspectRatio}</div>
                      </div>
                    </div>
                    <textarea
                      class="mt-3 h-16 w-full resize-none overflow-y-scroll rounded-lg border border-slate-300 bg-[#fbfaf7] p-2 text-xs"
                      placeholder="Approval or rejection notes..."
                      value={notes()}
                      onInput={(event) => setNotes(event.currentTarget.value)}
                    />
                    <button
                      class="mt-3 w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm disabled:bg-slate-300"
                      disabled={!selectedApproved() || promoteMutation.isPending}
                      onClick={promoteApproved}
                    >
                      Promote Approved Asset
                    </button>
                    <Show when={message()}>
                      {(text) => <div class="mt-3 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">{text()}</div>}
                    </Show>
                  </section>
                </div>
              )}
            </Show>
          </aside>
        </div>
      </div>
      <Show when={showProviderInfo()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-6" onClick={() => setShowProviderInfo(false)}>
          <div class="w-full max-w-md rounded-xl border border-[#c8c0b2] bg-[#f7f4ee] p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div class="mb-3 flex items-center justify-between">
              <h2 class="text-base font-semibold">Provider Info</h2>
              <button type="button" class="rounded px-2 py-1 text-sm hover:bg-slate-200" onClick={() => setShowProviderInfo(false)}>Close</button>
            </div>
            <div class="space-y-3 text-sm text-slate-700">
              <div class="rounded-lg border border-slate-200 bg-white p-3">
                <div class="font-semibold">Key status</div>
                <div class="mt-1 text-xs">OpenAI: {providerQuery.data?.openai ? 'found' : 'empty or missing'}</div>
                <div class="text-xs">Leonardo: {providerQuery.data?.leonardo ? 'found' : 'empty or missing'}</div>
                <div class="mt-1 text-xs text-slate-500">OpenAI source: {providerQuery.data?.openaiSource}</div>
                <div class="text-xs text-slate-500">Leonardo source: {providerQuery.data?.leonardoSource}</div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <For each={providerLinks}>
                  {(link) => <a class="rounded-md border border-slate-200 bg-white px-2 py-2 text-center text-xs font-medium text-slate-600 hover:bg-slate-50" href={link.href} target="_blank">{link.label}</a>}
                </For>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};
