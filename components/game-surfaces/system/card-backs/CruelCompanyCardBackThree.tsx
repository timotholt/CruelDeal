import { createEffect, onCleanup, onMount } from 'solid-js';
import * as THREE from 'three';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getCardBackFont } from './cardBackTypeface';
import type {
  CardBackFont,
  CardBackLayerVisibility,
  CardBackLight,
  CardBackRelief,
  CardBackTypography,
  CardBackVariant,
} from './cardBackTypes';
import { DEFAULT_CARD_BACK_TYPOGRAPHY } from './cardBackTypes';
import {
  CARD_BACK_IDENTITY_DISCS,
  CARD_BACK_PERIMETER_PATH,
  getCardBackInternalPaths,
} from './ProceduralCardBackPrimitives';

const ALBEDO = {
  onyx: '/art/card-backs/cruel-company-substrate-onyx-albedo-v5.png',
  ivory: '/art/card-backs/cruel-company-substrate-ivory-albedo-v5.png',
} as const;

const CARD_WIDTH = 1000;
const CARD_HEIGHT = 1400;
const CARD_DEPTH = 18;
interface CruelCompanyCardBackThreeProps {
  variant: CardBackVariant;
  font: CardBackFont;
  emblemFont: CardBackFont;
  layers: CardBackLayerVisibility;
  light: CardBackLight;
  relief: CardBackRelief;
  typography: CardBackTypography;
  caption: string;
  emblem: string;
  microTextA: string;
  microTextB: string;
  class?: string;
}

interface SceneGroups {
  substrate: THREE.Group;
  grooves: THREE.Group;
  structuralGold: THREE.Group;
  caption: THREE.Group;
  emblem: THREE.Group;
  microText: THREE.Group;
  identityDiscs: THREE.Group;
}

interface SceneMaterials {
  substrate: THREE.MeshStandardMaterial;
  cardEdge: THREE.MeshStandardMaterial;
  groove: THREE.MeshStandardMaterial;
  goldFace: THREE.MeshPhysicalMaterial;
  goldSide: THREE.MeshStandardMaterial;
}

const disposeObject = (object: THREE.Object3D) => {
  object.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
  });
  object.removeFromParent();
};

const replaceGroup = (parent: THREE.Scene, previous: THREE.Group, next: THREE.Group) => {
  const visible = previous.visible;
  disposeObject(previous);
  next.visible = visible;
  parent.add(next);
  return next;
};

const roundedCardShape = (inset = 0) => {
  const width = CARD_WIDTH - inset * 2;
  const height = CARD_HEIGHT - inset * 2;
  const radius = Math.max(8, 48 - inset * 0.25);
  const left = -width / 2;
  const right = width / 2;
  const bottom = -height / 2;
  const top = height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(left + radius, bottom);
  shape.lineTo(right - radius, bottom);
  shape.quadraticCurveTo(right, bottom, right, bottom + radius);
  shape.lineTo(right, top - radius);
  shape.quadraticCurveTo(right, top, right - radius, top);
  shape.lineTo(left + radius, top);
  shape.quadraticCurveTo(left, top, left, top - radius);
  shape.lineTo(left, bottom + radius);
  shape.quadraticCurveTo(left, bottom, left + radius, bottom);
  return shape;
};

const transformSvgPoint = (x: number, y: number, transform?: THREE.Matrix3) => {
  const point = new THREE.Vector2(x, y);
  if (transform) point.applyMatrix3(transform);
  point.set(point.x - CARD_WIDTH / 2, CARD_HEIGHT / 2 - point.y);
  return point;
};

/**
 * SVGLoader triangulates a canonical stroked path. This turns those triangles
 * into a closed prism, adding true side walls along every boundary edge.
 */
const extrudeStrokeGeometry = (
  pathData: string,
  width: number,
  depth: number,
  transform?: THREE.Matrix3,
) => {
  const parsed = new SVGLoader().parse(
    `<svg xmlns="http://www.w3.org/2000/svg"><path d="${pathData}" fill="none" stroke="#fff" stroke-width="${width}" stroke-linecap="butt" stroke-linejoin="bevel"/></svg>`,
  );
  const path = parsed.paths[0];
  if (!path) return [];
  const style = SVGLoader.getStrokeStyle(width, '#fff', 'bevel', 'butt', 4);

  return path.subPaths.flatMap(subPath => {
    const face = SVGLoader.pointsToStroke(subPath.getPoints(12), style, 12, 0.02);
    if (!face) return [];
    const welded = mergeVertices(face, 0.001);
    const sourcePositions = welded.getAttribute('position');
    const sourceIndices = welded.index?.array;
    if (!sourceIndices) {
      welded.dispose();
      face.dispose();
      return [];
    }

    const points = Array.from({ length: sourcePositions.count }, (_, index) =>
      transformSvgPoint(sourcePositions.getX(index), sourcePositions.getY(index), transform),
    );
    const top: number[] = [];
    const bottom: number[] = [];
    const sides: number[] = [];
    const boundaryEdges = new Map<string, { a: number; b: number; count: number }>();

    const addVertex = (target: number[], index: number, z: number) => {
      const point = points[index];
      target.push(point.x, point.y, z);
    };
    const noteEdge = (a: number, b: number) => {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      const edge = boundaryEdges.get(key);
      if (edge) edge.count += 1;
      else boundaryEdges.set(key, { a, b, count: 1 });
    };

    for (let index = 0; index < sourceIndices.length; index += 3) {
      const a = Number(sourceIndices[index]);
      const b = Number(sourceIndices[index + 1]);
      const c = Number(sourceIndices[index + 2]);
      // Flipping SVG Y reverses winding, so the cap order is reversed here.
      addVertex(top, a, depth); addVertex(top, c, depth); addVertex(top, b, depth);
      addVertex(bottom, a, 0); addVertex(bottom, b, 0); addVertex(bottom, c, 0);
      noteEdge(a, b); noteEdge(b, c); noteEdge(c, a);
    }

    for (const edge of boundaryEdges.values()) {
      if (edge.count !== 1) continue;
      addVertex(sides, edge.a, 0); addVertex(sides, edge.b, 0); addVertex(sides, edge.b, depth);
      addVertex(sides, edge.a, 0); addVertex(sides, edge.b, depth); addVertex(sides, edge.a, depth);
    }

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([...top, ...bottom, ...sides]);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.addGroup(0, top.length / 3, 0);
    geometry.addGroup(top.length / 3, (bottom.length + sides.length) / 3, 1);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    welded.dispose();
    face.dispose();
    return [geometry];
  });
};

const addStrokePrisms = (
  group: THREE.Group,
  pathData: string,
  width: number,
  depth: number,
  faceMaterial: THREE.Material,
  sideMaterial: THREE.Material,
  z = 0,
  transform?: THREE.Matrix3,
) => {
  for (const geometry of extrudeStrokeGeometry(pathData, width, depth, transform)) {
    const mesh = new THREE.Mesh(geometry, [faceMaterial, sideMaterial]);
    mesh.position.z = z;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
};

const createTextMesh = (
  font: CardBackFont,
  text: string,
  size: number,
  depth: number,
  faceMaterial: THREE.Material,
  sideMaterial: THREE.Material,
  x: number,
  baselineY: number,
  align: 'left' | 'center' | 'right',
  spacing = 0,
) => {
  const anchor = new THREE.Group();
  const glyphs = new THREE.Group();
  const loadedFont = getCardBackFont(font);
  let cursor = 0;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  for (const character of Array.from(text || ' ')) {
    const geometry = new TextGeometry(character, {
      font: loadedFont,
      size,
      depth,
      curveSegments: size > 30 ? 10 : 5,
      bevelEnabled: true,
      bevelThickness: Math.min(depth * 0.22, size * 0.045),
      bevelSize: Math.min(depth * 0.18, size * 0.035),
      bevelSegments: 3,
    });
    geometry.computeBoundingBox();
    if (geometry.boundingBox) {
      minX = Math.min(minX, cursor + geometry.boundingBox.min.x);
      maxX = Math.max(maxX, cursor + geometry.boundingBox.max.x);
    }
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, [faceMaterial, sideMaterial]);
    mesh.position.x = cursor;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    glyphs.add(mesh);
    const glyph = loadedFont.data.glyphs[character] ?? loadedFont.data.glyphs['?'];
    cursor += (glyph?.ha ?? loadedFont.data.resolution * 0.5) * size / loadedFont.data.resolution + spacing;
  }
  if (!Number.isFinite(minX)) minX = 0;
  if (!Number.isFinite(maxX)) maxX = 0;
  const offset = align === 'center' ? -(minX + maxX) / 2 : align === 'right' ? -maxX : -minX;
  glyphs.position.x = offset;
  anchor.position.set(x, CARD_HEIGHT / 2 - baselineY, 0);
  anchor.add(glyphs);
  return anchor;
};

const createDisc = (
  x: number,
  svgY: number,
  radius: number,
  depth: number,
  faceMaterial: THREE.Material,
  sideMaterial: THREE.Material,
) => {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius, 0, Math.PI * 2, false);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: Math.min(3, depth * 0.18),
    bevelSize: 2,
    bevelSegments: 3,
    curveSegments: 48,
  });
  const mesh = new THREE.Mesh(geometry, [faceMaterial, sideMaterial]);
  mesh.position.set(x - CARD_WIDTH / 2, CARD_HEIGHT / 2 - svgY, 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

const buildSubstrate = (materials: SceneMaterials, texture: THREE.Texture) => {
  const group = new THREE.Group();
  const bodyGeometry = new THREE.ExtrudeGeometry(roundedCardShape(3), {
    depth: CARD_DEPTH,
    bevelEnabled: true,
    bevelThickness: 7,
    bevelSize: 7,
    bevelSegments: 5,
    curveSegments: 8,
  });
  const body = new THREE.Mesh(bodyGeometry, materials.cardEdge);
  body.position.z = -CARD_DEPTH - 3;
  body.receiveShadow = true;
  group.add(body);

  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_WIDTH - 18, CARD_HEIGHT - 18),
    materials.substrate,
  );
  materials.substrate.map = texture;
  materials.substrate.needsUpdate = true;
  surface.position.z = 0;
  surface.receiveShadow = true;
  group.add(surface);
  return group;
};

const buildGrooves = (relief: CardBackRelief, material: THREE.Material) => {
  const group = new THREE.Group();
  const railDelta = relief.railWidth - 14;
  for (const path of getCardBackInternalPaths(relief.curveRadius)) {
    const goldWidth = path.role === 'hex' ? relief.hexWidth : path.width + railDelta;
    addStrokePrisms(
      group,
      path.d,
      Math.max(3, goldWidth + relief.grooveWidth),
      1.2,
      material,
      material,
      0.15,
    );
  }
  return group;
};

const buildStructuralGold = (relief: CardBackRelief, materials: SceneMaterials) => {
  const group = new THREE.Group();
  const depth = Math.max(3, relief.goldHeight * 150);
  addStrokePrisms(
    group,
    CARD_BACK_PERIMETER_PATH.d,
    relief.outerBorderWidth,
    depth,
    materials.goldFace,
    materials.goldSide,
    0.6,
  );
  const railDelta = relief.railWidth - 14;
  for (const path of getCardBackInternalPaths(relief.curveRadius)) {
    const pathDepth = Math.max(3, (path.role === 'hex' ? relief.hexHeight : relief.goldHeight) * 150);
    const pathWidth = path.role === 'hex' ? relief.hexWidth : path.width + railDelta;
    addStrokePrisms(
      group,
      path.d,
      Math.max(3, pathWidth),
      pathDepth,
      materials.goldFace,
      materials.goldSide,
      0.6,
    );
  }
  return group;
};

const identityDepth = (relief: CardBackRelief) => Math.max(4, relief.identityHeight * 150);

const buildCaption = (
  font: CardBackFont,
  relief: CardBackRelief,
  placement: CardBackTypography['caption'],
  materials: SceneMaterials,
  caption: string,
) => createTextMesh(font, caption, placement.size, identityDepth(relief), materials.goldFace, materials.goldSide, placement.x, 202 + placement.y, 'center', placement.spacing);

const buildEmblem = (
  font: CardBackFont,
  relief: CardBackRelief,
  placement: CardBackTypography['emblem'],
  materials: SceneMaterials,
  emblem: string,
) => createTextMesh(font, emblem, placement.size, identityDepth(relief), materials.goldFace, materials.goldSide, placement.x, 785 + placement.y, 'center', placement.spacing);

const buildMicroText = (
  font: CardBackFont,
  relief: CardBackRelief,
  materials: SceneMaterials,
  microTextA: string,
  microTextB: string,
) => {
  const group = new THREE.Group();
  const depth = identityDepth(relief);
  group.add(createTextMesh(font, microTextA, 17, depth * 0.42, materials.goldFace, materials.goldSide, -410, 1305, 'left'));
  group.add(createTextMesh(font, microTextB, 17, depth * 0.42, materials.goldFace, materials.goldSide, 290, 1305, 'right'));
  return group;
};

const buildIdentityDiscs = (relief: CardBackRelief, materials: SceneMaterials) => {
  const group = new THREE.Group();
  const depth = identityDepth(relief);
  for (const disc of CARD_BACK_IDENTITY_DISCS) {
    group.add(createDisc(disc.x, disc.y, disc.radius, depth, materials.goldFace, materials.goldSide));
  }
  return group;
};

export const CruelCompanyCardBackThree = (props: CruelCompanyCardBackThreeProps) => {
  let canvas: HTMLCanvasElement | undefined;
  let render: (() => void) | undefined;
  let updatePresentation: (() => void) | undefined;
  let rebuildGrooves: (() => void) | undefined;
  let rebuildStructuralGold: (() => void) | undefined;
  let rebuildCaption: (() => void) | undefined;
  let rebuildEmblem: (() => void) | undefined;
  let rebuildMicroText: (() => void) | undefined;
  let rebuildIdentityDiscs: (() => void) | undefined;
  let updateTypographyPositions: (() => void) | undefined;
  let lastGrooveKey = '';
  let lastStructuralKey = '';
  let lastCaptionKey = '';
  let lastEmblemKey = '';
  let lastMicroTextKey = '';
  let lastDiscKey = '';
  let lastPositionKey = '';
  let geometryFrame: number | undefined;
  const pendingGeometryUpdates = new Map<string, () => void>();
  const typography = () => props.typography ?? DEFAULT_CARD_BACK_TYPOGRAPHY;
  const queueGeometryUpdate = (key: string, update: () => void) => {
    pendingGeometryUpdates.set(key, update);
    if (geometryFrame !== undefined) return;
    geometryFrame = requestAnimationFrame(() => {
      geometryFrame = undefined;
      const updates = [...pendingGeometryUpdates.values()];
      pendingGeometryUpdates.clear();
      updates.forEach(run => run());
      render?.();
    });
  };

  createEffect(() => {
    void [
      props.variant,
      props.light.color,
      props.layers.substrate,
      props.layers.grooves,
      props.layers.structuralGold,
      props.layers.identity,
      props.layers.finish,
      props.layers.keyLight,
      props.light.ambient,
      props.light.x,
      props.light.y,
      props.light.height,
      props.light.intensity,
      props.light.falloff,
      props.light.shadowSoftness,
    ];
    updatePresentation?.();
    render?.();
  });

  createEffect(() => {
    const key = [props.relief.railWidth, props.relief.hexWidth, props.relief.grooveWidth, props.relief.grooveDepth, props.relief.curveRadius].join('|');
    if (key === lastGrooveKey) return;
    lastGrooveKey = key;
    if (rebuildGrooves) queueGeometryUpdate('grooves', rebuildGrooves);
  });

  createEffect(() => {
    const key = [props.relief.outerBorderWidth, props.relief.railWidth, props.relief.hexWidth, props.relief.goldHeight, props.relief.hexHeight, props.relief.bevelSoftness, props.relief.curveRadius].join('|');
    if (key === lastStructuralKey) return;
    lastStructuralKey = key;
    if (rebuildStructuralGold) queueGeometryUpdate('structuralGold', rebuildStructuralGold);
  });

  createEffect(() => {
    const key = [props.font, props.caption, typography().caption.size, typography().caption.spacing, props.relief.identityHeight, props.relief.bevelSoftness].join('|');
    if (key === lastCaptionKey) return;
    lastCaptionKey = key;
    if (rebuildCaption) queueGeometryUpdate('caption', rebuildCaption);
  });

  createEffect(() => {
    const key = [props.emblemFont, props.emblem, typography().emblem.size, typography().emblem.spacing, props.relief.identityHeight, props.relief.bevelSoftness].join('|');
    if (key === lastEmblemKey) return;
    lastEmblemKey = key;
    if (rebuildEmblem) queueGeometryUpdate('emblem', rebuildEmblem);
  });

  createEffect(() => {
    const key = [props.font, props.microTextA, props.microTextB, props.relief.identityHeight, props.relief.bevelSoftness].join('|');
    if (key === lastMicroTextKey) return;
    lastMicroTextKey = key;
    if (rebuildMicroText) queueGeometryUpdate('microText', rebuildMicroText);
  });

  createEffect(() => {
    const key = [props.relief.identityHeight, props.relief.bevelSoftness].join('|');
    if (key === lastDiscKey) return;
    lastDiscKey = key;
    if (rebuildIdentityDiscs) queueGeometryUpdate('identityDiscs', rebuildIdentityDiscs);
  });

  createEffect(() => {
    const key = [typography().caption.x, typography().caption.y, typography().emblem.x, typography().emblem.y].join('|');
    if (key === lastPositionKey) return;
    lastPositionKey = key;
    updateTypographyPositions?.();
    render?.();
  });

  onMount(() => {
    if ((import.meta as ImportMeta & { env?: { MODE?: string } }).env?.MODE === 'test') return;
    const target = canvas;
    if (!target) return;
    const host = target.closest<HTMLElement>('.card-back-material');
    const renderer = new THREE.WebGLRenderer({
      canvas: target,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    // The reconstruction canvas is the authoring/export source. Tiny gameplay
    // proofs do not need their own costly shadow atlas on every slider tick.
    renderer.shadowMap.enabled = target.clientWidth >= 300;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-500, 500, 700, -700, 1, 5000);
    camera.position.set(0, 0, 2200);
    camera.lookAt(0, 0, 0);

    const materials: SceneMaterials = {
      substrate: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.04 }),
      cardEdge: new THREE.MeshStandardMaterial({ color: 0x161713, roughness: 0.7, metalness: 0.12 }),
      groove: new THREE.MeshStandardMaterial({ color: 0x090a09, roughness: 0.94, metalness: 0.02, side: THREE.DoubleSide }),
      goldFace: new THREE.MeshPhysicalMaterial({ color: 0xc9a456, roughness: 0.28, metalness: 0.82, clearcoat: 0.2, clearcoatRoughness: 0.34 }),
      goldSide: new THREE.MeshStandardMaterial({ color: 0x6c4d25, roughness: 0.48, metalness: 0.66, side: THREE.DoubleSide }),
    };

    const ambient = new THREE.AmbientLight(0xffffff, 1);
    // A spotlight preserves a controllable studio key while providing actual
    // spatial attenuation. DirectionalLight has no falloff, which previously
    // forced the falloff control to masquerade as shadow blur.
    const key = new THREE.SpotLight(0xffffff, 2.2);
    key.castShadow = true;
    key.angle = THREE.MathUtils.degToRad(65);
    key.distance = 0;
    key.decay = 0;
    // This is already more than 2x the final 640x896 bitmap in each axis.
    // A 4096 atlas adds slider latency without surviving the downsample.
    const shadowResolution = target.clientWidth >= 300 ? 2048 : 1024;
    key.shadow.mapSize.set(shadowResolution, shadowResolution);
    key.shadow.bias = -0.00008;
    key.shadow.normalBias = 0.12;
    key.shadow.radius = 1;
    key.shadow.camera.near = 100;
    key.shadow.camera.far = 4200;
    key.shadow.camera.left = -620;
    key.shadow.camera.right = 620;
    key.shadow.camera.top = 820;
    key.shadow.camera.bottom = -820;
    key.target.position.set(0, 0, 0);
    scene.add(ambient, key, key.target);

    let disposed = false;
    let resizeObserver: ResizeObserver | undefined;
    let renderFrame: number | undefined;
    let textures: Record<CardBackVariant, THREE.Texture> | undefined;
    let groups: SceneGroups | undefined;

    const textureLoader = new THREE.TextureLoader();
    void Promise.all([
      textureLoader.loadAsync(ALBEDO.onyx),
      textureLoader.loadAsync(ALBEDO.ivory),
    ]).then(([onyx, ivory]) => {
      if (disposed) {
        onyx.dispose();
        ivory.dispose();
        return;
      }
      onyx.colorSpace = THREE.SRGBColorSpace;
      ivory.colorSpace = THREE.SRGBColorSpace;
      onyx.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      ivory.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      textures = { onyx, ivory };
      groups = {
        substrate: buildSubstrate(materials, textures[props.variant]),
        grooves: buildGrooves(props.relief, materials.groove),
        structuralGold: buildStructuralGold(props.relief, materials),
        caption: buildCaption(props.font, props.relief, typography().caption, materials, props.caption),
        emblem: buildEmblem(props.emblemFont, props.relief, typography().emblem, materials, props.emblem),
        microText: buildMicroText(props.font, props.relief, materials, props.microTextA, props.microTextB),
        identityDiscs: buildIdentityDiscs(props.relief, materials),
      };
      Object.values(groups).forEach(group => scene.add(group));

      rebuildGrooves = () => {
        if (!groups) return;
        groups.grooves = replaceGroup(scene, groups.grooves, buildGrooves(props.relief, materials.groove));
      };

      rebuildStructuralGold = () => {
        if (!groups) return;
        groups.structuralGold = replaceGroup(scene, groups.structuralGold, buildStructuralGold(props.relief, materials));
        updatePresentation?.();
      };

      rebuildCaption = () => {
        if (!groups) return;
        groups.caption = replaceGroup(scene, groups.caption, buildCaption(props.font, props.relief, typography().caption, materials, props.caption));
        updatePresentation?.();
      };

      rebuildEmblem = () => {
        if (!groups) return;
        groups.emblem = replaceGroup(scene, groups.emblem, buildEmblem(props.emblemFont, props.relief, typography().emblem, materials, props.emblem));
        updatePresentation?.();
      };

      rebuildMicroText = () => {
        if (!groups) return;
        groups.microText = replaceGroup(scene, groups.microText, buildMicroText(props.font, props.relief, materials, props.microTextA, props.microTextB));
        updatePresentation?.();
      };

      rebuildIdentityDiscs = () => {
        if (!groups) return;
        groups.identityDiscs = replaceGroup(scene, groups.identityDiscs, buildIdentityDiscs(props.relief, materials));
        updatePresentation?.();
      };

      updateTypographyPositions = () => {
        if (!groups) return;
        groups.caption.position.x = typography().caption.x;
        groups.caption.position.y = CARD_HEIGHT / 2 - (202 + typography().caption.y);
        groups.emblem.position.x = typography().emblem.x;
        groups.emblem.position.y = CARD_HEIGHT / 2 - (785 + typography().emblem.y);
      };

      updatePresentation = () => {
        if (!groups || !textures) return;
        materials.substrate.map = textures[props.variant];
        materials.substrate.needsUpdate = true;
        groups.substrate.visible = props.layers.substrate;
        groups.grooves.visible = props.layers.grooves;
        groups.structuralGold.visible = props.layers.structuralGold;
        groups.caption.visible = props.layers.identity;
        groups.emblem.visible = props.layers.identity;
        groups.microText.visible = props.layers.identity;
        groups.identityDiscs.visible = props.layers.identity;

        const ivoryVariant = props.variant === 'ivory';
        materials.cardEdge.color.setHex(ivoryVariant ? 0xc9c4b9 : 0x161713);
        materials.groove.color.setHex(ivoryVariant ? 0x77736b : 0x090a09);
        materials.goldFace.roughness = props.layers.finish ? 0.28 : 0.68;
        materials.goldFace.metalness = props.layers.finish ? 0.82 : 0.42;
        materials.goldFace.clearcoat = props.layers.finish ? 0.2 : 0;
        materials.goldSide.roughness = props.layers.finish ? 0.48 : 0.76;

        key.color.set(props.light.color);
        ambient.intensity = props.light.ambient * (ivoryVariant ? 1.18 : 1.35);
        key.visible = props.layers.keyLight;
        const keyX = (props.light.x - 0.5) * 900;
        const keyY = (0.5 - props.light.y) * 1150;
        key.position.set(
          keyX,
          keyY,
          900 + props.light.height * 1800,
        );
        // Aim the cone at the light's card-plane projection so the visible
        // hotspot agrees with the temporary authoring crosshair.
        key.target.position.set(keyX, keyY, 0);
        key.intensity = props.light.intensity * (ivoryVariant ? 1.25 : 1.7);
        // SpotLight penumbra is genuine angular light attenuation. Mapping the
        // authoring range to 0..1 keeps the full 0.5–20 control useful without
        // conflating illumination falloff with the shadow filter radius.
        key.penumbra = THREE.MathUtils.mapLinear(
          THREE.MathUtils.clamp(props.light.falloff, 0.5, 20),
          0.5,
          20,
          0.02,
          0.96,
        );
        key.shadow.radius = 0.45 + Math.min(20, props.light.shadowSoftness) * 0.12;
      };

      render = () => {
        if (renderFrame !== undefined) cancelAnimationFrame(renderFrame);
        renderFrame = requestAnimationFrame(() => {
          renderFrame = undefined;
          const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
          const width = Math.max(1, Math.round(target.clientWidth));
          const height = Math.max(1, Math.round(target.clientHeight));
          renderer.setPixelRatio(pixelRatio);
          renderer.setSize(width, height, false);
          renderer.render(scene, camera);
        });
      };

      resizeObserver = new ResizeObserver(() => render?.());
      resizeObserver.observe(target);
      host?.setAttribute('data-three-ready', 'true');
      updatePresentation();
      render();
    }).catch(error => {
      console.error('Unable to initialize the card-back Three.js authoring scene.', error);
      host?.setAttribute('data-three-ready', 'false');
    });

    onCleanup(() => {
      disposed = true;
      render = undefined;
      updatePresentation = undefined;
      rebuildGrooves = undefined;
      rebuildStructuralGold = undefined;
      rebuildCaption = undefined;
      rebuildEmblem = undefined;
      rebuildMicroText = undefined;
      rebuildIdentityDiscs = undefined;
      updateTypographyPositions = undefined;
      if (geometryFrame !== undefined) cancelAnimationFrame(geometryFrame);
      pendingGeometryUpdates.clear();
      resizeObserver?.disconnect();
      if (renderFrame !== undefined) cancelAnimationFrame(renderFrame);
      if (groups) Object.values(groups).forEach(disposeObject);
      if (textures) Object.values(textures).forEach(texture => texture.dispose());
      Object.values(materials).forEach(material => material.dispose());
      renderer.dispose();
      host?.removeAttribute('data-three-ready');
    });
  });

  return (
    <canvas
      ref={element => { canvas = element; }}
      class={props.class}
      data-card-back-three="extruded-geometry-lighting"
    />
  );
};
