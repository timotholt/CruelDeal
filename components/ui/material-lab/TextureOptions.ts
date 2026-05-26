export const textureOptions = [
  {
    id: 'none',
    label: 'None',
    url: '',
  },
  {
    id: 'road012a',
    label: 'Road012A',
    url: '/art/textures/road012a/Road012A_1K-JPG_Color.jpg',
  },
  {
    id: 'stone01',
    label: 'Stone01',
    url: '/art/textures/stone-local/Stone01.png',
  },
  {
    id: 'stone02',
    label: 'Stone02',
    url: '/art/textures/stone-local/Stone02.png',
  },
  {
    id: 'stone03',
    label: 'Stone03',
    url: '/art/textures/stone-local/Stone03.png',
  },
  {
    id: 'stone04',
    label: 'Stone04',
    url: '/art/textures/stone-local/Stone04.png',
  },
  {
    id: 'background01',
    label: 'Background 01',
    url: '/art/textures/stone-local/Background01.png',
  },
  {
    id: 'background02',
    label: 'Background 02',
    url: '/art/textures/stone-local/Background02.png',
  },
  {
    id: 'background10',
    label: 'Background 10',
    url: '/art/textures/stone-local/Background10.png',
  },
  {
    id: 'blackLeather01',
    label: 'Black Leather 01',
    url: '/art/textures/stone-local/BlackLeather01.png',
  },
  {
    id: 'copper01',
    label: 'Copper 01',
    url: '/art/textures/stone-local/Copper01.png',
  },
  {
    id: 'gold01',
    label: 'Gold 01',
    url: '/art/textures/stone-local/Gold01.png',
  },
  {
    id: 'silver01',
    label: 'Silver 01',
    url: '/art/textures/stone-local/Silver01.png',
  },
  {
    id: 'asphalt001',
    label: 'Asphalt001',
    url: '/art/textures/asphalt001/Asphalt001_1K-JPG_Color.jpg',
  },
  {
    id: 'asphalt027c',
    label: 'Asphalt027C',
    url: '/art/textures/asphalt027c/Asphalt027C_1K-JPG_Color.jpg',
  },
  {
    id: 'concrete002',
    label: 'Concrete002',
    url: '/art/textures/concrete002/Concrete002_1K-JPG_Color.jpg',
  },
  {
    id: 'concrete009',
    label: 'Concrete009',
    url: '/art/textures/concrete009/Concrete009_1K-JPG_Color.jpg',
  },
  {
    id: 'concrete047a',
    label: 'Concrete047A PNG',
    url: '/art/textures/concrete047a/Concrete047A_1K-PNG_Color.png',
  },
  {
    id: 'metal046a',
    label: 'Metal046A',
    url: '/art/textures/metal046a/Metal046A_1K-JPG_Color.jpg',
  },
  {
    id: 'metal046b',
    label: 'Metal046B PNG',
    url: '/art/textures/metal046b/Metal046B_1K-PNG_Color.png',
  },
  {
    id: 'road012b',
    label: 'Road012B PNG',
    url: '/art/textures/road012b/Road012B_1K-PNG_Color.png',
  },
  {
    id: 'road012c',
    label: 'Road012C PNG',
    url: '/art/textures/road012c/Road012C_1K-PNG_Color.png',
  },
] as const;

const edgeMaskOptions = [
  {
    id: 'edge-micro-chips-fine',
    label: 'Edge Micro Chips Fine',
    url: '/art/ui/edge-micro-chips-fine.svg',
  },
  {
    id: 'edge-micro-chips-rough',
    label: 'Edge Micro Chips Rough',
    url: '/art/ui/edge-micro-chips-rough.svg',
  },
  {
    id: 'edge-bw-chips-fine',
    label: 'Edge B/W Chips Fine',
    url: '/art/ui/edge-bw-chips-fine.svg',
  },
  {
    id: 'edge-bw-chips-heavy',
    label: 'Edge B/W Chips Heavy',
    url: '/art/ui/edge-bw-chips-heavy.svg',
  },
  {
    id: 'edge-bw-noise-dense',
    label: 'Edge B/W Noise Dense',
    url: '/art/ui/edge-bw-noise-dense.svg',
  },
] as const;

const edgeMapOptions = [
  { id: 'asphalt001-displacement', label: 'Asphalt001 Displacement', url: '/art/textures/asphalt001/Asphalt001_1K-JPG_Displacement.jpg' },
  { id: 'asphalt001-normal-dx', label: 'Asphalt001 Normal DX', url: '/art/textures/asphalt001/Asphalt001_1K-JPG_NormalDX.jpg' },
  { id: 'asphalt001-normal-gl', label: 'Asphalt001 Normal GL', url: '/art/textures/asphalt001/Asphalt001_1K-JPG_NormalGL.jpg' },
  { id: 'asphalt001-roughness', label: 'Asphalt001 Roughness', url: '/art/textures/asphalt001/Asphalt001_1K-JPG_Roughness.jpg' },
  { id: 'asphalt027c-ao', label: 'Asphalt027C AO', url: '/art/textures/asphalt027c/Asphalt027C_1K-JPG_AmbientOcclusion.jpg' },
  { id: 'asphalt027c-displacement', label: 'Asphalt027C Displacement', url: '/art/textures/asphalt027c/Asphalt027C_1K-JPG_Displacement.jpg' },
  { id: 'asphalt027c-normal-dx', label: 'Asphalt027C Normal DX', url: '/art/textures/asphalt027c/Asphalt027C_1K-JPG_NormalDX.jpg' },
  { id: 'asphalt027c-normal-gl', label: 'Asphalt027C Normal GL', url: '/art/textures/asphalt027c/Asphalt027C_1K-JPG_NormalGL.jpg' },
  { id: 'asphalt027c-roughness', label: 'Asphalt027C Roughness', url: '/art/textures/asphalt027c/Asphalt027C_1K-JPG_Roughness.jpg' },
  { id: 'concrete002-displacement', label: 'Concrete002 Displacement', url: '/art/textures/concrete002/Concrete002_1K-JPG_Displacement.jpg' },
  { id: 'concrete002-normal-dx', label: 'Concrete002 Normal DX', url: '/art/textures/concrete002/Concrete002_1K-JPG_NormalDX.jpg' },
  { id: 'concrete002-normal-gl', label: 'Concrete002 Normal GL', url: '/art/textures/concrete002/Concrete002_1K-JPG_NormalGL.jpg' },
  { id: 'concrete002-roughness', label: 'Concrete002 Roughness', url: '/art/textures/concrete002/Concrete002_1K-JPG_Roughness.jpg' },
  { id: 'concrete009-ao', label: 'Concrete009 AO', url: '/art/textures/concrete009/Concrete009_1K-JPG_AmbientOcclusion.jpg' },
  { id: 'concrete009-displacement', label: 'Concrete009 Displacement', url: '/art/textures/concrete009/Concrete009_1K-JPG_Displacement.jpg' },
  { id: 'concrete009-normal-dx', label: 'Concrete009 Normal DX', url: '/art/textures/concrete009/Concrete009_1K-JPG_NormalDX.jpg' },
  { id: 'concrete009-normal-gl', label: 'Concrete009 Normal GL', url: '/art/textures/concrete009/Concrete009_1K-JPG_NormalGL.jpg' },
  { id: 'concrete009-roughness', label: 'Concrete009 Roughness', url: '/art/textures/concrete009/Concrete009_1K-JPG_Roughness.jpg' },
  { id: 'concrete047a-ao', label: 'Concrete047A AO', url: '/art/textures/concrete047a/Concrete047A_1K-PNG_AmbientOcclusion.png' },
  { id: 'concrete047a-displacement', label: 'Concrete047A Displacement', url: '/art/textures/concrete047a/Concrete047A_1K-PNG_Displacement.png' },
  { id: 'concrete047a-normal-dx', label: 'Concrete047A Normal DX', url: '/art/textures/concrete047a/Concrete047A_1K-PNG_NormalDX.png' },
  { id: 'concrete047a-normal-gl', label: 'Concrete047A Normal GL', url: '/art/textures/concrete047a/Concrete047A_1K-PNG_NormalGL.png' },
  { id: 'concrete047a-roughness', label: 'Concrete047A Roughness', url: '/art/textures/concrete047a/Concrete047A_1K-PNG_Roughness.png' },
  { id: 'metal046a-displacement', label: 'Metal046A Displacement', url: '/art/textures/metal046a/Metal046A_1K-JPG_Displacement.jpg' },
  { id: 'metal046a-metalness', label: 'Metal046A Metalness', url: '/art/textures/metal046a/Metal046A_1K-JPG_Metalness.jpg' },
  { id: 'metal046a-normal-dx', label: 'Metal046A Normal DX', url: '/art/textures/metal046a/Metal046A_1K-JPG_NormalDX.jpg' },
  { id: 'metal046a-normal-gl', label: 'Metal046A Normal GL', url: '/art/textures/metal046a/Metal046A_1K-JPG_NormalGL.jpg' },
  { id: 'metal046a-roughness', label: 'Metal046A Roughness', url: '/art/textures/metal046a/Metal046A_1K-JPG_Roughness.jpg' },
  { id: 'metal046b-displacement', label: 'Metal046B Displacement', url: '/art/textures/metal046b/Metal046B_1K-PNG_Displacement.png' },
  { id: 'metal046b-metalness', label: 'Metal046B Metalness', url: '/art/textures/metal046b/Metal046B_1K-PNG_Metalness.png' },
  { id: 'metal046b-normal-dx', label: 'Metal046B Normal DX', url: '/art/textures/metal046b/Metal046B_1K-PNG_NormalDX.png' },
  { id: 'metal046b-normal-gl', label: 'Metal046B Normal GL', url: '/art/textures/metal046b/Metal046B_1K-PNG_NormalGL.png' },
  { id: 'metal046b-roughness', label: 'Metal046B Roughness', url: '/art/textures/metal046b/Metal046B_1K-PNG_Roughness.png' },
  { id: 'road012a-ao', label: 'Road012A AO', url: '/art/textures/road012a/Road012A_1K-JPG_AmbientOcclusion.jpg' },
  { id: 'road012a-displacement', label: 'Road012A Displacement', url: '/art/textures/road012a/Road012A_1K-JPG_Displacement.jpg' },
  { id: 'road012a-normal-dx', label: 'Road012A Normal DX', url: '/art/textures/road012a/Road012A_1K-JPG_NormalDX.jpg' },
  { id: 'road012a-normal-gl', label: 'Road012A Normal GL', url: '/art/textures/road012a/Road012A_1K-JPG_NormalGL.jpg' },
  { id: 'road012a-roughness', label: 'Road012A Roughness', url: '/art/textures/road012a/Road012A_1K-JPG_Roughness.jpg' },
  { id: 'road012b-ao', label: 'Road012B AO', url: '/art/textures/road012b/Road012B_1K-PNG_AmbientOcclusion.png' },
  { id: 'road012b-displacement', label: 'Road012B Displacement', url: '/art/textures/road012b/Road012B_1K-PNG_Displacement.png' },
  { id: 'road012b-normal-dx', label: 'Road012B Normal DX', url: '/art/textures/road012b/Road012B_1K-PNG_NormalDX.png' },
  { id: 'road012b-normal-gl', label: 'Road012B Normal GL', url: '/art/textures/road012b/Road012B_1K-PNG_NormalGL.png' },
  { id: 'road012b-roughness', label: 'Road012B Roughness', url: '/art/textures/road012b/Road012B_1K-PNG_Roughness.png' },
  { id: 'road012c-ao', label: 'Road012C AO', url: '/art/textures/road012c/Road012C_1K-PNG_AmbientOcclusion.png' },
  { id: 'road012c-displacement', label: 'Road012C Displacement', url: '/art/textures/road012c/Road012C_1K-PNG_Displacement.png' },
  { id: 'road012c-normal-dx', label: 'Road012C Normal DX', url: '/art/textures/road012c/Road012C_1K-PNG_NormalDX.png' },
  { id: 'road012c-normal-gl', label: 'Road012C Normal GL', url: '/art/textures/road012c/Road012C_1K-PNG_NormalGL.png' },
  { id: 'road012c-roughness', label: 'Road012C Roughness', url: '/art/textures/road012c/Road012C_1K-PNG_Roughness.png' },
] as const;

export const edgeTextureOptions = [
  textureOptions[0],
  ...edgeMaskOptions,
  ...textureOptions.slice(1),
  ...edgeMapOptions,
] as const;

export type TextureKind = typeof textureOptions[number]['id'];
export type EdgeTextureKind = typeof edgeTextureOptions[number]['id'];

export const getTextureOption = (id: TextureKind) => (
  textureOptions.find((option) => option.id === id) || textureOptions[0]
);

export const getEdgeTextureOption = (id: EdgeTextureKind) => (
  edgeTextureOptions.find((option) => option.id === id) || edgeTextureOptions[0]
);
