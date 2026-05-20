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

export type TextureKind = typeof textureOptions[number]['id'];

export const getTextureOption = (id: TextureKind) => (
  textureOptions.find((option) => option.id === id) || textureOptions[0]
);
