import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import type {
  AssetCandidateRecord,
  AssetKind,
  GenerationProvider,
  CandidateStatus,
  WorkbenchState,
} from '../../services/assets/workbench';

interface AssetWorkbenchPluginOptions {
  root: string;
  env: Record<string, string>;
}

interface GenerateRequest {
  assetKind: AssetKind;
  assetId: string;
  displayName: string;
  provider: GenerationProvider;
  prompt: string;
  promptInputs: Record<string, string | number | string[] | null>;
  committedSize: { w: number; h: number };
  aspectRatio: '5:7' | '4:15';
  engineTargetPath: string;
  manifestPath?: string;
}

interface AuthorCardBackRequest {
  dataUrl: string;
  displayName: string;
  committedSize: { w: number; h: number };
  engineTargetPath: string;
}

const STATE_PATH = 'asset-workbench/state.json';
const PRESETS_PATH = 'asset-workbench/presets.json';
const KEY_DIR = 'documents/keys';

const defaultState = (): WorkbenchState => ({
  version: 1,
  candidates: [],
});

const readJsonBody = async <T>(req: IncomingMessage): Promise<T> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) as T : {} as T;
};

const sendJson = (res: ServerResponse, status: number, body: unknown): void => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body, null, 2));
};

const safeJoin = (root: string, relativePath: string): string => {
  const out = path.resolve(root, relativePath);
  const resolvedRoot = path.resolve(root);
  if (!out.startsWith(resolvedRoot)) {
    throw new Error(`Refusing to write outside workspace: ${relativePath}`);
  }
  return out;
};

const publicPathToFile = (root: string, publicPath: string): string => {
  const clean = publicPath.replace(/^\/+/, '');
  return safeJoin(root, path.join('public', clean));
};

const ensureParent = async (filePath: string): Promise<void> => {
  await mkdir(path.dirname(filePath), { recursive: true });
};

const readState = async (root: string): Promise<WorkbenchState> => {
  const filePath = safeJoin(root, STATE_PATH);
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as WorkbenchState;
  } catch {
    return defaultState();
  }
};

const writeState = async (root: string, state: WorkbenchState): Promise<void> => {
  const filePath = safeJoin(root, STATE_PATH);
  await ensureParent(filePath);
  await writeFile(filePath, JSON.stringify(state, null, 2) + '\n');
};

const writeDefaultPresets = async (root: string): Promise<void> => {
  const filePath = safeJoin(root, PRESETS_PATH);
  try {
    await readFile(filePath, 'utf8');
  } catch {
    await ensureParent(filePath);
    await writeFile(filePath, JSON.stringify({
      version: 1,
      presets: [
        {
          id: 'cyberpunk-default',
          name: 'Cyberpunk Default',
          negativePrompt: 'readable text, logos, watermark, card border, UI, frame, copyrighted character',
        },
      ],
    }, null, 2) + '\n');
  }
};

const normalizeSecret = (raw: string): string => {
  const trimmed = raw.trim();
  const envStyle = trimmed.match(/^[A-Z0-9_]+\s*=\s*(.+)$/);
  return (envStyle?.[1] ?? trimmed).trim().replace(/^['"]|['"]$/g, '');
};

const readSecretFile = async (root: string, filename: string): Promise<string> => {
  try {
    return normalizeSecret(await readFile(safeJoin(root, path.join(KEY_DIR, filename)), 'utf8'));
  } catch {
    return '';
  }
};

const providerKeys = async (root: string, env: Record<string, string>): Promise<{
  openai: string;
  leonardo: string;
}> => ({
  openai: env.OPENAI_API_KEY || await readSecretFile(root, 'open.ai'),
  leonardo: env.LEONARDO_API_KEY || await readSecretFile(root, 'leonardo.ai'),
});

const providerSizeFor = (assetKind: AssetKind): string => {
  if (assetKind === 'location-lane') return '1024x1536';
  return '1024x1536';
};

const saveBytes = async (
  root: string,
  publicPath: string,
  bytes: Buffer,
): Promise<void> => {
  const filePath = publicPathToFile(root, publicPath);
  await ensureParent(filePath);
  await writeFile(filePath, bytes);
};

const generateWithOpenAI = async (
  root: string,
  env: Record<string, string>,
  req: GenerateRequest,
): Promise<{ bytes: Buffer; model: string; requestId?: string; requestedSize: { w: number; h: number } }> => {
  const apiKey = (await providerKeys(root, env)).openai;
  if (!apiKey) throw new Error('Missing OpenAI key. Expected OPENAI_API_KEY or documents/keys/open.ai');

  const model = env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
  const size = providerSizeFor(req.assetKind);
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt: req.prompt,
      size,
      n: 1,
    }),
  });

  const requestId = response.headers.get('x-request-id') ?? undefined;
  const data = await response.json() as {
    data?: { b64_json?: string; url?: string }[];
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(data.error?.message || `OpenAI image request failed with ${response.status}`);
  }

  const image = data.data?.[0];
  if (!image) throw new Error('OpenAI returned no image data');
  if (image.b64_json) {
    return {
      bytes: Buffer.from(image.b64_json, 'base64'),
      model,
      requestId,
      requestedSize: { w: 1024, h: 1536 },
    };
  }
  if (image.url) {
    const imageResponse = await fetch(image.url);
    if (!imageResponse.ok) throw new Error(`Could not download OpenAI image: ${imageResponse.status}`);
    return {
      bytes: Buffer.from(await imageResponse.arrayBuffer()),
      model,
      requestId,
      requestedSize: { w: 1024, h: 1536 },
    };
  }
  throw new Error('OpenAI returned an unsupported image payload');
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const generateWithLeonardo = async (
  root: string,
  env: Record<string, string>,
  req: GenerateRequest,
): Promise<{ bytes: Buffer; model: string; requestId?: string; requestedSize: { w: number; h: number } }> => {
  const apiKey = (await providerKeys(root, env)).leonardo;
  if (!apiKey) throw new Error('Missing Leonardo key. Expected LEONARDO_API_KEY or documents/keys/leonardo.ai');

  const modelId = env.LEONARDO_MODEL_ID;
  const width = req.assetKind === 'location-lane' ? 1024 : 1024;
  const height = req.assetKind === 'location-lane' ? 1536 : 1536;
  const createResponse = await fetch('https://cloud.leonardo.ai/api/rest/v1/generations', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      prompt: req.prompt,
      width,
      height,
      num_images: 1,
      ...(modelId ? { modelId } : {}),
    }),
  });

  const created = await createResponse.json() as {
    sdGenerationJob?: { generationId?: string };
    error?: string;
    message?: string;
  };
  if (!createResponse.ok) {
    throw new Error(created.message || created.error || `Leonardo generation request failed with ${createResponse.status}`);
  }

  const generationId = created.sdGenerationJob?.generationId;
  if (!generationId) throw new Error('Leonardo returned no generation id');

  for (let attempt = 0; attempt < 40; attempt++) {
    await sleep(1500);
    const pollResponse = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`, {
      headers: {
        authorization: `Bearer ${apiKey}`,
        accept: 'application/json',
      },
    });
    const polled = await pollResponse.json() as {
      generations_by_pk?: {
        status?: string;
        generated_images?: { url?: string }[];
      };
      message?: string;
    };
    if (!pollResponse.ok) {
      throw new Error(polled.message || `Leonardo poll failed with ${pollResponse.status}`);
    }
    const imageUrl = polled.generations_by_pk?.generated_images?.[0]?.url;
    if (imageUrl) {
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) throw new Error(`Could not download Leonardo image: ${imageResponse.status}`);
      return {
        bytes: Buffer.from(await imageResponse.arrayBuffer()),
        model: modelId || 'leonardo-default',
        requestId: generationId,
        requestedSize: { w: width, h: height },
      };
    }
  }

  throw new Error('Leonardo generation timed out before an image was available');
};

const updateCardManifestPath = async (root: string, assetId: string, targetPath: string): Promise<void> => {
  const filePath = safeJoin(root, 'services/playgame/engine/manifest/content/cyberpunk-cards.ts');
  const content = await readFile(filePath, 'utf8');
  const start = content.indexOf(`defId: '${assetId}'`);
  if (start === -1) throw new Error(`Could not find card defId ${assetId}`);
  const end = content.indexOf('\n  },', start + 1);
  const blockEnd = end === -1 ? content.length : end;
  const before = content.slice(0, start);
  const block = content.slice(start, blockEnd);
  const after = content.slice(blockEnd);
  const nextBlock = block.replace(
    /(art:\s*\{\s*portrait:\s*\{\s*path:\s*)'[^']*'(\s*\}\s*\})/,
    `$1'${targetPath}'$2`,
  );
  if (nextBlock === block) throw new Error(`Could not update portrait path for ${assetId}`);
  await writeFile(filePath, before + nextBlock + after);
};

const updateLocationManifestPath = async (root: string, assetId: string, targetPath: string): Promise<void> => {
  const filePath = safeJoin(
    root,
    `services/playgame/engine/manifest/location-sets/core-v1/locations/${assetId}/location.json`,
  );
  const parsed = JSON.parse(await readFile(filePath, 'utf8')) as {
    defId?: unknown;
    cosmetic?: { art?: { map?: { path?: unknown } } };
  };
  if (parsed.defId !== assetId) throw new Error(`Could not find location defId ${assetId}`);
  const map = parsed.cosmetic?.art?.map;
  if (!map || typeof map.path !== 'string') {
    throw new Error(`Could not update map path for ${assetId}`);
  }
  map.path = targetPath;
  await writeFile(filePath, `${JSON.stringify(parsed, null, 2)}\n`);
};

const promoteCandidate = async (
  root: string,
  candidate: AssetCandidateRecord,
): Promise<AssetCandidateRecord> => {
  const sourcePath = publicPathToFile(root, candidate.normalizedPath || candidate.rawPath);
  const targetPath = publicPathToFile(root, candidate.engineTargetPath);
  await ensureParent(targetPath);
  await copyFile(sourcePath, targetPath);

  if (candidate.assetKind === 'card-front') {
    await updateCardManifestPath(root, candidate.assetId, candidate.engineTargetPath);
  } else if (candidate.assetKind === 'location-lane') {
    await updateLocationManifestPath(root, candidate.assetId, candidate.engineTargetPath);
  }

  return {
    ...candidate,
    status: 'promoted',
    promotedPath: candidate.engineTargetPath,
    manifestPath: candidate.manifestPath,
    updatedAt: new Date().toISOString(),
  };
};

export const assetWorkbenchPlugin = ({ root, env }: AssetWorkbenchPluginOptions): Plugin => ({
  name: 'cruel-deal-asset-workbench',
  configureServer(server) {
    server.middlewares.use('/api/assets', async (req, res) => {
      try {
        await writeDefaultPresets(root);
        const url = new URL(req.url || '/', 'http://asset-workbench.local');
        const state = await readState(root);

        if (req.method === 'GET' && url.pathname === '/state') {
          sendJson(res, 200, state);
          return;
        }

        if (req.method === 'GET' && url.pathname === '/provider-status') {
          const keys = await providerKeys(root, env);
          sendJson(res, 200, {
            openai: Boolean(keys.openai),
            leonardo: Boolean(keys.leonardo),
            openaiSource: keys.openai ? 'documents/keys/open.ai or .env.local' : 'missing or empty',
            leonardoSource: keys.leonardo ? 'documents/keys/leonardo.ai or .env.local' : 'missing or empty',
            source: 'documents/keys or .env.local',
          });
          return;
        }

        if (req.method === 'POST' && url.pathname === '/generate') {
          const body = await readJsonBody<GenerateRequest>(req);
          const id = randomUUID();
          const batchId = randomUUID();
          const providerResult = body.provider === 'openai'
            ? await generateWithOpenAI(root, env, body)
            : await generateWithLeonardo(root, env, body);
          const rawPath = `/art/generated/${body.provider}/${body.assetId}/${id}.png`;
          const normalizedPath = `/art/generated/${body.provider}/${body.assetId}/${id}.webp`;
          await saveBytes(root, rawPath, providerResult.bytes);

          const now = new Date().toISOString();
          const candidate: AssetCandidateRecord = {
            id,
            batchId,
            assetKind: body.assetKind,
            assetId: body.assetId,
            displayName: body.displayName,
            provider: body.provider,
            providerModel: providerResult.model,
            providerRequestId: providerResult.requestId,
            generatedAt: now,
            updatedAt: now,
            status: 'generated',
            promptTemplateId: `${body.assetKind}-default`,
            promptTemplateVersion: 1,
            promptInputs: body.promptInputs,
            finalPrompt: body.prompt,
            requestedSize: providerResult.requestedSize,
            committedSize: body.committedSize,
            aspectRatio: body.aspectRatio,
            dimensionsDivisibleBy8: true,
            rawPath,
            normalizedPath,
            manifestPath: body.manifestPath,
            engineTargetPath: body.engineTargetPath,
          };
          const nextState = {
            ...state,
            candidates: [candidate, ...state.candidates],
          };
          await writeState(root, nextState);
          sendJson(res, 200, { candidate });
          return;
        }

        if (req.method === 'POST' && url.pathname === '/author-card-back') {
          const body = await readJsonBody<AuthorCardBackRequest>(req);
          if (body.committedSize.w !== 640 || body.committedSize.h !== 896) {
            throw new Error('Card-back authoring output must be exactly 640x896.');
          }
          if (!body.dataUrl.startsWith('data:image/webp;base64,')) {
            throw new Error('Card-back authoring output must be a WebP data URL.');
          }

          const id = randomUUID();
          const now = new Date().toISOString();
          const normalizedPath = `/art/generated/authoring/default/${id}.webp`;
          await saveBytes(root, normalizedPath, Buffer.from(body.dataUrl.slice('data:image/webp;base64,'.length), 'base64'));
          const candidate: AssetCandidateRecord = {
            id,
            batchId: randomUUID(),
            assetKind: 'card-back',
            assetId: 'default',
            displayName: body.displayName,
            provider: 'authoring',
            providerModel: 'card-back-foundry-v1',
            generatedAt: now,
            updatedAt: now,
            status: 'generated',
            promptTemplateId: 'card-back-foundry',
            promptTemplateVersion: 1,
            promptInputs: {},
            finalPrompt: 'Deterministic card-back authoring render.',
            requestedSize: body.committedSize,
            providerOutputSize: body.committedSize,
            committedSize: body.committedSize,
            aspectRatio: '5:7',
            dimensionsDivisibleBy8: true,
            rawPath: normalizedPath,
            normalizedPath,
            engineTargetPath: body.engineTargetPath,
          };
          await writeState(root, { ...state, candidates: [candidate, ...state.candidates] });
          sendJson(res, 200, { candidate });
          return;
        }

        if (req.method === 'POST' && url.pathname === '/normalize') {
          const body = await readJsonBody<{ id: string; dataUrl: string }>(req);
          const candidate = state.candidates.find((item) => item.id === body.id);
          if (!candidate) throw new Error(`Unknown candidate ${body.id}`);
          const base64 = body.dataUrl.replace(/^data:image\/webp;base64,/, '');
          await saveBytes(root, candidate.normalizedPath, Buffer.from(base64, 'base64'));
          const nextState = {
            ...state,
            candidates: state.candidates.map((item) => (
              item.id === candidate.id
                ? { ...item, updatedAt: new Date().toISOString() }
                : item
            )),
          };
          await writeState(root, nextState);
          sendJson(res, 200, { ok: true });
          return;
        }

        if (req.method === 'POST' && url.pathname === '/status') {
          const body = await readJsonBody<{ id: string; status: CandidateStatus; reviewerNotes?: string }>(req);
          const candidate = state.candidates.find((item) => item.id === body.id);
          if (!candidate) throw new Error(`Unknown candidate ${body.id}`);
          const now = new Date().toISOString();
          const nextState = {
            ...state,
            candidates: state.candidates.map((item) => {
              if (body.status === 'approved' && item.assetKind === candidate.assetKind && item.assetId === candidate.assetId && item.status === 'approved') {
                return { ...item, status: 'generated' as const, updatedAt: now };
              }
              if (item.id !== body.id) return item;
              return {
                ...item,
                status: body.status,
                reviewerNotes: body.reviewerNotes,
                updatedAt: now,
              };
            }),
          };
          await writeState(root, nextState);
          sendJson(res, 200, { ok: true });
          return;
        }

        if (req.method === 'POST' && url.pathname === '/promote') {
          const body = await readJsonBody<{ id: string }>(req);
          const candidate = state.candidates.find((item) => item.id === body.id);
          if (!candidate) throw new Error(`Unknown candidate ${body.id}`);
          const promoted = await promoteCandidate(root, candidate);
          const nextState = {
            ...state,
            candidates: state.candidates.map((item) => item.id === promoted.id ? promoted : item),
          };
          await writeState(root, nextState);
          sendJson(res, 200, { candidate: promoted });
          return;
        }

        sendJson(res, 404, { error: `Unknown asset API route ${url.pathname}` });
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
      }
    });
  },
});
