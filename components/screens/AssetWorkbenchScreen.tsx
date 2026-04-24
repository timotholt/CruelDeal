import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query';
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from 'solid-js';
import {
  AssetCandidateRecord,
  AssetProvider,
  buildPromptForAsset,
  buildWorkbenchAssets,
  CandidateStatus,
  WorkbenchAsset,
  WorkbenchState,
} from '@/services/assets/workbench';

const apiJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Asset API failed with ${response.status}`);
  }
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

  const dataUrl = canvas.toDataURL('image/webp', 0.86);
  await apiJson('/api/assets/normalize', {
    method: 'POST',
    body: JSON.stringify({ id: candidate.id, dataUrl }),
  });
};

const statusTone = (status: string): string => {
  if (status === 'promoted') return 'border-emerald-400/60 bg-emerald-500/12 text-emerald-200';
  if (status === 'approved') return 'border-cyan-300/60 bg-cyan-400/12 text-cyan-100';
  if (status === 'generated') return 'border-amber-300/60 bg-amber-400/12 text-amber-100';
  if (status === 'rejected') return 'border-red-400/60 bg-red-500/12 text-red-100';
  if (status === 'deprecated') return 'border-fuchsia-300/60 bg-fuchsia-500/12 text-fuchsia-100';
  return 'border-slate-500/60 bg-slate-800/70 text-slate-200';
};

const apiProviderLinks = [
  { label: 'OpenAI Keys', href: 'https://platform.openai.com/api-keys' },
  { label: 'OpenAI Images', href: 'https://platform.openai.com/docs/guides/image-generation' },
  { label: 'Leonardo API', href: 'https://docs.leonardo.ai/docs/getting-started' },
  { label: 'Leonardo App', href: 'https://app.leonardo.ai/' },
];

export const AssetWorkbenchScreen = () => {
  const assets = createMemo(() => buildWorkbenchAssets());
  const [selectedId, setSelectedId] = createSignal<string>(assets()[0]?.id ?? '');
  const [provider, setProvider] = createSignal<AssetProvider>('openai');
  const [prompt, setPrompt] = createSignal('');
  const [notes, setNotes] = createSignal('');
  const [kindFilter, setKindFilter] = createSignal<'all' | WorkbenchAsset['kind']>('all');
  const [statusFilter, setStatusFilter] = createSignal<'all' | CandidateStatus | 'missing' | 'deprecated'>('all');
  const [message, setMessage] = createSignal<string | null>(null);
  const queryClient = useQueryClient();

  const stateQuery = createQuery(() => ({
    queryKey: ['asset-workbench-state'],
    queryFn: () => apiJson<WorkbenchState>('/api/assets/state'),
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

  const assetStatus = (asset: WorkbenchAsset): CandidateStatus | 'missing' | 'deprecated' | 'ready' => {
    const latest = latestCandidateFor(asset);
    if (latest) return latest.status;
    return asset.statusHint;
  };

  const filteredAssets = createMemo(() => assets().filter((asset) => {
    if (kindFilter() !== 'all' && asset.kind !== kindFilter()) return false;
    if (statusFilter() !== 'all' && assetStatus(asset) !== statusFilter()) return false;
    return true;
  }));

  const counts = createMemo(() => {
    const base = {
      missing: 0,
      deprecated: 0,
      generated: 0,
      approved: 0,
      promoted: 0,
      rejected: 0,
    };
    for (const asset of assets()) {
      const status = assetStatus(asset);
      if (status in base) base[status as keyof typeof base] += 1;
    }
    return base;
  });

  createEffect(() => {
    const asset = selectedAsset();
    if (!asset) return;
    const latest = latestCandidateFor(asset);
    setPrompt(latest?.finalPrompt || buildPromptForAsset(asset));
    setNotes(latest?.reviewerNotes || '');
  });

  createEffect(() => {
    if (selectedAsset()) return;
    setSelectedId(assets()[0]?.id ?? '');
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
      setMessage('Normalizing to final WebP dimensions...');
      await normalizeCandidateImage(result.candidate);
      return result.candidate;
    },
    onSuccess: async () => {
      setMessage('Candidate generated and normalized.');
      await queryClient.invalidateQueries({ queryKey: ['asset-workbench-state'] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : String(error)),
  }));

  const statusMutation = createMutation(() => ({
    mutationFn: ({ id, status }: { id: string; status: CandidateStatus }) => apiJson('/api/assets/status', {
      method: 'POST',
      body: JSON.stringify({ id, status, reviewerNotes: notes() || undefined }),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['asset-workbench-state'] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : String(error)),
  }));

  const promoteMutation = createMutation(() => ({
    mutationFn: (id: string) => apiJson('/api/assets/promote', {
      method: 'POST',
      body: JSON.stringify({ id }),
    }),
    onSuccess: async () => {
      setMessage('Promoted into build assets.');
      await queryClient.invalidateQueries({ queryKey: ['asset-workbench-state'] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : String(error)),
  }));

  const selectedCandidates = createMemo(() => {
    const asset = selectedAsset();
    return asset ? candidatesFor(asset) : [];
  });

  const selectedApproved = createMemo(() => {
    const asset = selectedAsset();
    return asset ? approvedCandidateFor(asset) : undefined;
  });

  const handleGenerate = () => {
    const asset = selectedAsset();
    if (asset) generateMutation.mutate(asset);
  };

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
    const list = filteredAssets();
    const currentIndex = list.findIndex((asset) => asset.id === selectedId());
    const next = list[Math.max(0, Math.min(list.length - 1, currentIndex + delta))];
    if (next) setSelectedId(next.id);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) return;
    if (event.key.toLowerCase() === 'g') handleGenerate();
    if (event.key.toLowerCase() === 'a') {
      const candidate = selectedCandidates()[0];
      if (candidate) approveCandidate(candidate);
    }
    if (event.key.toLowerCase() === 'r') {
      const candidate = selectedCandidates()[0];
      if (candidate) rejectCandidate(candidate);
    }
    if (event.key.toLowerCase() === 'p') promoteApproved();
    if (event.key.toLowerCase() === 'n' || event.key.toLowerCase() === 'j') selectRelative(1);
    if (event.key.toLowerCase() === 'k') selectRelative(-1);
  };

  window.addEventListener('keydown', onKeyDown);
  onCleanup(() => window.removeEventListener('keydown', onKeyDown));

  return (
    <div class="h-full w-full overflow-hidden bg-[#0b0d10] text-stone-100">
      <div class="grid h-full grid-cols-[280px_minmax(0,1fr)_430px] gap-0">
        <aside class="border-r border-stone-700/50 bg-[#14130f] p-5 overflow-y-auto">
          <div class="text-[0.65rem] uppercase tracking-[0.35em] text-amber-300">Cruel Deal</div>
          <h1 class="mt-2 font-condensed text-3xl font-bold uppercase leading-none text-stone-50">
            Asset Print Shop
          </h1>
          <p class="mt-3 text-sm leading-relaxed text-stone-400">
            Local-only AI generation, approval, and promotion. Metadata stays outside the engine until you promote a final file.
          </p>

          <div class="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/8 p-4">
            <div class="text-xs font-bold uppercase tracking-[0.22em] text-amber-200">Keys & Credits</div>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <For each={apiProviderLinks}>
                {(link) => (
                  <a
                    class="rounded-lg border border-stone-600/60 bg-stone-950/40 px-3 py-2 text-[0.65rem] font-bold uppercase tracking-wide text-stone-200 hover:border-amber-300/70"
                    href={link.href}
                    target="_blank"
                  >
                    {link.label}
                  </a>
                )}
              </For>
            </div>
          </div>

          <div class="mt-6 space-y-3">
            <label class="block text-xs font-bold uppercase tracking-[0.22em] text-stone-400">Provider</label>
            <select
              class="w-full rounded-xl border border-stone-600 bg-stone-950 px-3 py-2 text-sm text-stone-100"
              value={provider()}
              onChange={(event) => setProvider(event.currentTarget.value as AssetProvider)}
            >
              <option value="openai">OpenAI</option>
              <option value="leonardo">Leonardo</option>
            </select>
            <p class="text-xs leading-relaxed text-stone-500">
              Put `OPENAI_API_KEY` or `LEONARDO_API_KEY` in `.env.local`. Leonardo can also use `LEONARDO_MODEL_ID`.
            </p>
          </div>

          <div class="mt-6 grid grid-cols-2 gap-3">
            <For each={[
              ['Missing', counts().missing],
              ['Deprecated', counts().deprecated],
              ['Generated', counts().generated],
              ['Approved', counts().approved],
              ['Promoted', counts().promoted],
              ['Rejected', counts().rejected],
            ]}>
              {(item) => (
                <div class="rounded-xl border border-stone-700/60 bg-stone-950/50 p-3">
                  <div class="text-2xl font-black text-stone-50">{item[1]}</div>
                  <div class="mt-1 text-[0.6rem] uppercase tracking-[0.18em] text-stone-500">{item[0]}</div>
                </div>
              )}
            </For>
          </div>

          <div class="mt-6 space-y-3">
            <label class="block text-xs font-bold uppercase tracking-[0.22em] text-stone-400">Filters</label>
            <select
              class="w-full rounded-xl border border-stone-600 bg-stone-950 px-3 py-2 text-sm"
              value={kindFilter()}
              onChange={(event) => setKindFilter(event.currentTarget.value as typeof kindFilter extends () => infer T ? T : never)}
            >
              <option value="all">All assets</option>
              <option value="location-lane">Locations</option>
              <option value="card-front">Card fronts</option>
              <option value="card-back">Card backs</option>
            </select>
            <select
              class="w-full rounded-xl border border-stone-600 bg-stone-950 px-3 py-2 text-sm"
              value={statusFilter()}
              onChange={(event) => setStatusFilter(event.currentTarget.value as typeof statusFilter extends () => infer T ? T : never)}
            >
              <option value="all">Any status</option>
              <option value="missing">Missing</option>
              <option value="deprecated">Deprecated</option>
              <option value="generated">Generated</option>
              <option value="approved">Approved</option>
              <option value="promoted">Promoted</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </aside>

        <main class="overflow-y-auto p-6">
          <div class="mb-5 flex items-end justify-between gap-4">
            <div>
              <div class="text-xs uppercase tracking-[0.3em] text-stone-500">Contact Sheet</div>
              <h2 class="font-condensed text-4xl font-bold uppercase text-stone-50">Needs Art</h2>
            </div>
            <div class="text-sm text-stone-500">{filteredAssets().length} visible assets</div>
          </div>

          <div class="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4 pb-24">
            <For each={filteredAssets()}>
              {(asset) => {
                const latest = () => latestCandidateFor(asset);
                const status = () => assetStatus(asset);
                return (
                  <button
                    type="button"
                    class={`group rounded-2xl border p-3 text-left transition-all ${selectedId() === asset.id ? 'border-amber-300 bg-amber-300/12' : 'border-stone-700/70 bg-[#171915] hover:border-stone-400/80'}`}
                    onClick={() => setSelectedId(asset.id)}
                  >
                    <div class={`relative overflow-hidden rounded-xl border border-stone-700/60 bg-stone-950 ${asset.kind === 'location-lane' ? 'aspect-[4/15]' : 'aspect-[5/7]'}`}>
                      <Show
                        when={latest()?.normalizedPath || latest()?.rawPath || asset.currentPath}
                        fallback={<div class="flex h-full items-center justify-center text-4xl text-stone-800">+</div>}
                      >
                        {(src) => <img class="h-full w-full object-cover" src={src()} alt="" />}
                      </Show>
                      <div class={`absolute left-2 top-2 rounded-md border px-2 py-1 text-[0.55rem] font-black uppercase tracking-wide ${statusTone(status())}`}>
                        {status()}
                      </div>
                    </div>
                    <div class="mt-3 flex items-start justify-between gap-3">
                      <div>
                        <div class="line-clamp-2 text-sm font-black uppercase leading-tight text-stone-100">{asset.displayName}</div>
                        <div class="mt-1 text-[0.62rem] uppercase tracking-[0.15em] text-stone-500">{asset.defId}</div>
                      </div>
                    </div>
                    <div class="mt-3 rounded-lg bg-stone-950/70 px-2 py-1 text-[0.6rem] font-bold uppercase tracking-wide text-stone-400">
                      {asset.spec.width}x{asset.spec.height} · {asset.spec.aspectRatio}
                    </div>
                  </button>
                );
              }}
            </For>
          </div>
        </main>

        <aside class="border-l border-stone-700/50 bg-[#101216] p-5 overflow-y-auto">
          <Show when={selectedAsset()} keyed>
            {(asset) => (
              <div>
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <div class="text-[0.65rem] uppercase tracking-[0.28em] text-amber-300">{asset.kind}</div>
                    <h2 class="mt-2 font-condensed text-3xl font-bold uppercase leading-none">{asset.displayName}</h2>
                    <div class="mt-2 text-xs text-stone-500">{asset.defId}</div>
                  </div>
                  <div class={`rounded-lg border px-2 py-1 text-[0.6rem] font-black uppercase tracking-wide ${statusTone(assetStatus(asset))}`}>
                    {assetStatus(asset)}
                  </div>
                </div>

                <div class="mt-5 rounded-2xl border border-stone-700/70 bg-stone-950/50 p-4">
                  <div class="text-xs font-bold uppercase tracking-[0.22em] text-stone-400">Build Target</div>
                  <div class="mt-2 break-all font-mono text-xs text-stone-200">{asset.targetPath}</div>
                  <div class="mt-3 font-mono text-xs text-stone-500">
                    {asset.spec.width}x{asset.spec.height} · {asset.spec.aspectRatio} · divisible by 8
                  </div>
                </div>

                <div class="mt-5">
                  <label class="text-xs font-bold uppercase tracking-[0.22em] text-stone-400">Final Prompt</label>
                  <textarea
                    class="mt-2 h-64 w-full resize-none rounded-2xl border border-stone-700 bg-stone-950/80 p-4 font-mono text-xs leading-relaxed text-stone-100 outline-none focus:border-amber-300/70"
                    value={prompt()}
                    onInput={(event) => setPrompt(event.currentTarget.value)}
                  />
                </div>

                <div class="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    class="rounded-xl bg-amber-300 px-4 py-3 text-sm font-black uppercase tracking-wide text-stone-950 disabled:opacity-50"
                    disabled={generateMutation.isPending}
                    onClick={handleGenerate}
                  >
                    Generate
                  </button>
                  <button
                    type="button"
                    class="rounded-xl border border-stone-600 px-4 py-3 text-sm font-black uppercase tracking-wide text-stone-200"
                    onClick={() => setPrompt(buildPromptForAsset(asset))}
                  >
                    Reset Prompt
                  </button>
                </div>

                <Show when={message()}>
                  {(text) => (
                    <div class="mt-4 rounded-xl border border-stone-700 bg-stone-950/70 p-3 text-xs text-stone-300">
                      {text()}
                    </div>
                  )}
                </Show>

                <div class="mt-6">
                  <div class="mb-3 flex items-center justify-between">
                    <div class="text-xs font-bold uppercase tracking-[0.22em] text-stone-400">Candidates</div>
                    <button
                      type="button"
                      class="text-xs font-bold uppercase tracking-wide text-cyan-200 disabled:text-stone-600"
                      disabled={!selectedApproved() || promoteMutation.isPending}
                      onClick={promoteApproved}
                    >
                      Promote Approved
                    </button>
                  </div>

                  <div class="space-y-4">
                    <For each={selectedCandidates()}>
                      {(candidate) => (
                        <div class="rounded-2xl border border-stone-700/70 bg-stone-950/50 p-3">
                          <div class="flex gap-3">
                            <div class={`shrink-0 overflow-hidden rounded-xl border border-stone-700 bg-black ${candidate.assetKind === 'location-lane' ? 'h-40 aspect-[4/15]' : 'h-40 aspect-[5/7]'}`}>
                              <img class="h-full w-full object-cover" src={`${candidate.normalizedPath}?v=${candidate.updatedAt}`} alt="" />
                            </div>
                            <div class="min-w-0 flex-1">
                              <div class={`inline-flex rounded-md border px-2 py-1 text-[0.55rem] font-black uppercase tracking-wide ${statusTone(candidate.status)}`}>
                                {candidate.status}
                              </div>
                              <div class="mt-2 text-xs text-stone-400">{candidate.provider} · {candidate.providerModel}</div>
                              <div class="mt-1 font-mono text-[0.62rem] text-stone-600">{candidate.id.slice(0, 8)}</div>
                              <div class="mt-3 grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  class="rounded-lg border border-cyan-300/40 px-2 py-2 text-[0.65rem] font-black uppercase text-cyan-100"
                                  onClick={() => approveCandidate(candidate)}
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  class="rounded-lg border border-red-300/40 px-2 py-2 text-[0.65rem] font-black uppercase text-red-100"
                                  onClick={() => rejectCandidate(candidate)}
                                >
                                  Reject
                                </button>
                              </div>
                            </div>
                          </div>
                          <textarea
                            class="mt-3 h-16 w-full resize-none rounded-xl border border-stone-800 bg-black/40 p-2 font-mono text-[0.65rem] text-stone-400"
                            value={notes()}
                            placeholder="Reviewer notes for approve/reject..."
                            onInput={(event) => setNotes(event.currentTarget.value)}
                          />
                        </div>
                      )}
                    </For>
                    <Show when={selectedCandidates().length === 0}>
                      <div class="rounded-2xl border border-dashed border-stone-700 p-6 text-center text-sm text-stone-500">
                        No candidates yet. Tune the prompt and generate one.
                      </div>
                    </Show>
                  </div>
                </div>
              </div>
            )}
          </Show>
        </aside>
      </div>
    </div>
  );
};
