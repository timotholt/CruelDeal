export const paintMaskAssetIds = ['fingerprint-svgrepo-v1'] as const;
export type PaintMaskAssetId = typeof paintMaskAssetIds[number];

export interface PaintMaskAssetDefinition {
  id: PaintMaskAssetId;
  cssUrl: string;
  publicPath: string;
  sha256: string;
}

export const paintMaskAssets: Readonly<Record<PaintMaskAssetId, PaintMaskAssetDefinition>> = {
  'fingerprint-svgrepo-v1': {
    id: 'fingerprint-svgrepo-v1',
    cssUrl: 'url("/art/ui/fingerprint-svgrepo-v1.svg")',
    publicPath: '/art/ui/fingerprint-svgrepo-v1.svg',
    sha256: '114106a40b58a4728893fbb5799aed998e462ac240126a3c8f275d61a5f114f8',
  },
};

export const resolvePaintMaskAsset = (id: PaintMaskAssetId) => paintMaskAssets[id];
