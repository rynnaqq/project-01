// space-sim/world/earth/earth.ts
import {
  Constants, MeshBuilder, RawTexture, ShaderMaterial, StandardMaterial, Texture,
  TransformNode, Vector3, type Scene,
} from "@babylonjs/core";
import { fbm2, fbm3 } from "../../core/noise";

const EARTH_R = 6371000;
const CENTER_Y = -EARTH_R;

const SURFACE_VS = `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
uniform mat4 worldViewProjection;
uniform mat4 world;
varying vec3 vNormalW;
varying vec3 vPosW;
varying vec2 vUv;
void main() {
  vUv = uv;
  vNormalW = normalize((world * vec4(normal, 0.0)).xyz);
  vec4 wp = world * vec4(position, 1.0);
  vPosW = wp.xyz;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}`;

const SURFACE_FS = `
precision highp float;
varying vec3 vNormalW;
varying vec3 vPosW;
varying vec2 vUv;
uniform sampler2D uAlbedo;
uniform sampler2D uNight;
uniform sampler2D uClouds;
uniform vec3 uSunDir;
uniform vec3 uCamPos;
void main() {
  vec3 albedo = texture2D(uAlbedo, vUv).rgb;
  vec3 night = texture2D(uNight, vUv).rgb;
  float land = texture2D(uAlbedo, vUv).a;      // land mask packed in alpha
  vec4 cl = texture2D(uClouds, vUv + vec2(0.02, 0.0));
  float cloud = cl.a;
  vec3 N = normalize(vNormalW);
  vec3 L = normalize(uSunDir);
  vec3 V = normalize(uCamPos - vPosW);
  float ndl = dot(N, L);
  float day = smoothstep(-0.12, 0.25, ndl);
  // Cloud shadow: offset sample toward sun
  float shadow = texture2D(uClouds, vUv + vec2(0.002, 0.0)).a;
  vec3 col = albedo * (0.04 + 1.5 * max(ndl, 0.0) * (1.0 - shadow * 0.55));
  // Ocean specular
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 90.0) * (1.0 - land) * day;
  col += vec3(1.0, 0.95, 0.85) * spec * 0.7;
  // Clouds lit
  col = mix(col, vec3(1.0) * (0.08 + 1.35 * max(ndl, 0.0)), cloud * 0.92);
  // Night lights on dark land
  col += night * (1.0 - day) * (1.0 - cloud * 0.85) * 1.6;
  // Atmosphere rim (Fresnel)
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.2);
  col += vec3(0.25, 0.5, 1.0) * rim * (0.25 + 0.75 * day);
  gl_FragColor = vec4(col, 1.0);
}`;

const ATMO_VS = SURFACE_VS;

const ATMO_FS = `
precision highp float;
varying vec3 vNormalW;
varying vec3 vPosW;
uniform vec3 uSunDir;
uniform vec3 uCamPos;
void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(uCamPos - vPosW);
  vec3 L = normalize(uSunDir);
  float rim = pow(1.0 - abs(dot(N, V)), 3.5);
  float day = smoothstep(-0.35, 0.35, dot(N, L));
  vec3 col = mix(vec3(0.02, 0.05, 0.16), vec3(0.3, 0.55, 1.0), day);
  gl_FragColor = vec4(col, rim * (0.12 + 0.75 * day));
}`;

/** Paint Earth maps as raw RGBA textures using fbm3 for seamless sphere sampling. */
function paintEarthMaps(
  scene: Scene,
): { albedo: Texture; night: Texture; clouds: Texture } {
  const W = 2048, H = 1024;
  const mk = (name: string, draw: (d: Uint8ClampedArray) => void): RawTexture => {
    const data = new Uint8ClampedArray(W * H * 4);
    draw(data);
    const tex = new RawTexture(data, W, H, Constants.TEXTUREFORMAT_RGBA, scene, false, false, Texture.TRILINEAR_SAMPLINGMODE);
    tex.name = name;
    return tex;
  };
  const albedo = mk("earth_albedo", (d) => {
    for (let y = 0; y < H; y++) {
      const lat = (0.5 - y / H) * Math.PI;
      for (let x = 0; x < W; x++) {
        const lon = (x / W) * Math.PI * 2;
        const px = Math.cos(lat) * Math.cos(lon), py = Math.sin(lat), pz = Math.cos(lat) * Math.sin(lon);
        const n = fbm3(px * 3.1, py * 3.1, pz * 3.1, 6);
        const detail = fbm3(px * 9, py * 9, pz * 9, 4);
        const landMask = n + detail * 0.25;
        const k = (y * W + x) * 4;
        const isLand = landMask > 0.12;
        if (isLand) {
          const green = fbm3(px * 6 + 40, py * 6, pz * 6, 4) * 0.5 + 0.5;
          const desert = Math.max(0, Math.sin(lat * 2.4)) * (fbm3(px * 5, py * 5, pz * 5, 3) * 0.5 + 0.5);
          const ice = Math.abs(py) > 0.78 ? 1 : 0;
          d[k] = (30 + green * 60 + desert * 120) * (1 - ice) + ice * 235;
          d[k + 1] = (45 + green * 75 + desert * 90) * (1 - ice) + ice * 240;
          d[k + 2] = (28 + green * 40 + desert * 55) * (1 - ice) + ice * 245;
          d[k + 3] = 255;
        } else {
          const deep = Math.min(1, (0.12 - landMask) * 4);
          d[k] = 8 + (1 - deep) * 24; d[k + 1] = 24 + (1 - deep) * 40; d[k + 2] = 55 + (1 - deep) * 60;
          d[k + 3] = 0;
        }
      }
    }
  });
  const night = mk("earth_night", (d) => {
    for (let y = 0; y < H; y++) {
      const lat = (0.5 - y / H) * Math.PI;
      for (let x = 0; x < W; x++) {
        const lon = (x / W) * Math.PI * 2;
        const px = Math.cos(lat) * Math.cos(lon), py = Math.sin(lat), pz = Math.cos(lat) * Math.sin(lon);
        const n = fbm3(px * 3.1, py * 3.1, pz * 3.1, 6);
        const k = (y * W + x) * 4;
        if (n > 0.14 && Math.abs(py) < 0.7) {
          const cl = fbm3(px * 22, py * 22, pz * 22, 4);
          const v = cl > 0.28 ? 200 + cl * 55 : 0;
          d[k] = v; d[k + 1] = v * 0.85; d[k + 2] = v * 0.55;
        } else { d[k] = 0; d[k + 1] = 0; d[k + 2] = 0; }
        d[k + 3] = 255;
      }
    }
  });
  const clouds = mk("earth_clouds", (d) => {
    for (let y = 0; y < H; y++) {
      const lat = (0.5 - y / H) * Math.PI;
      for (let x = 0; x < W; x++) {
        const lon = (x / W) * Math.PI * 2;
        const px = Math.cos(lat) * Math.cos(lon), py = Math.sin(lat), pz = Math.cos(lat) * Math.sin(lon);
        const n = fbm3(px * 5 + 90, py * 5, pz * 5 + 90, 6);
        const swirl = fbm2((x / W) * 40, (y / H) * 20, 4) * 0.3;
        const a = Math.max(0, n + swirl - 0.08) * 1.6;
        const k = (y * W + x) * 4;
        d[k] = 255; d[k + 1] = 255; d[k + 2] = 255;
        d[k + 3] = Math.min(255, a * 255);
      }
    }
  });
  return { albedo, night, clouds };
}

export interface Earth {
  root: TransformNode;
  setSunDir(d: Vector3): void;
  update(dt: number): void;
}

export function createEarth(scene: Scene): Earth {
  const root = new TransformNode("earthRoot", scene);
  root.position.y = CENTER_Y;

  const surface = MeshBuilder.CreateSphere("earth", { diameter: EARTH_R * 2, segments: 96 }, scene);
  surface.parent = root;
  const maps = paintEarthMaps(scene);
  const mat = new ShaderMaterial("earthMat", scene,
    { vertexSource: SURFACE_VS, fragmentSource: SURFACE_FS },
    {
      attributes: ["position", "normal", "uv"],
      uniforms: ["worldViewProjection", "world", "uSunDir", "uCamPos"],
      samplers: ["uAlbedo", "uNight", "uClouds"],
    });
  mat.setVector3("uSunDir", new Vector3(0.45, 0.5, -0.35).normalize());
  mat.setTexture("uAlbedo", maps.albedo);
  mat.setTexture("uNight", maps.night);
  mat.setTexture("uClouds", maps.clouds);
  mat.backFaceCulling = true;
  surface.material = mat;

  // Cloud sphere (rotates slowly; shader samples uClouds with drift offset too)
  const clouds = MeshBuilder.CreateSphere("earthClouds", { diameter: EARTH_R * 2 * 1.004, segments: 64 }, scene);
  clouds.parent = root;
  const cloudMat = new StandardMaterial("earthCloudsMat", scene);
  cloudMat.diffuseTexture = null;
  cloudMat.alpha = 0.0; // clouds rendered in surface shader; sphere reserved for shadow layering
  cloudMat.disableLighting = true;
  clouds.material = cloudMat;
  clouds.isPickable = false;

  // Atmosphere shell (additive Fresnel)
  const atmo = MeshBuilder.CreateSphere("earthAtmo", { diameter: EARTH_R * 2 * 1.025, segments: 64 }, scene);
  atmo.parent = root;
  const atmoMat = new ShaderMaterial("atmoMat", scene,
    { vertexSource: ATMO_VS, fragmentSource: ATMO_FS },
    {
      attributes: ["position", "normal"],
      uniforms: ["worldViewProjection", "world", "uSunDir", "uCamPos"],
      needAlphaBlending: true,
    });
  atmoMat.setVector3("uSunDir", new Vector3(0.45, 0.5, -0.35).normalize());
  atmoMat.backFaceCulling = true;
  atmo.material = atmoMat;
  atmo.isPickable = false;

  const setSunDir = (d: Vector3): void => {
    mat.setVector3("uSunDir", d);
    atmoMat.setVector3("uSunDir", d);
  };
  const update = (dt: number): void => {
    surface.rotation.y += dt * 0.0015; // slow rotation
    const cam = scene.activeCamera;
    if (cam) {
      const camPos = cam.globalPosition.subtract(root.position);
      mat.setVector3("uCamPos", camPos);
      atmoMat.setVector3("uCamPos", camPos);
    }
  };
  return { root, setSunDir, update };
}
