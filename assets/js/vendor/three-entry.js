// Only what the tree/forest code uses — keeps the bundle small.
export {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, LineSegments,
  Color, Vector2, Vector3, MathUtils,
  BufferGeometry, BufferAttribute, Float32BufferAttribute,
  IcosahedronGeometry, CylinderGeometry, LatheGeometry, CircleGeometry, RingGeometry,
  MeshStandardMaterial, MeshBasicMaterial, LineBasicMaterial,
  CanvasTexture, SRGBColorSpace, RepeatWrapping, DoubleSide,
  AmbientLight, HemisphereLight, DirectionalLight,
  CubicBezierCurve3, CatmullRomCurve3, Curve, REVISION
} from 'three';
export { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
