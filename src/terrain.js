import * as THREE from "three";
import { height } from "./math.js";
export async function loadSurfaces(manager) {
  const loader = new THREE.TextureLoader(manager);
  const result = {};
  await Promise.all(
    [
      "grass_ground",
      "forest_ground_04",
      "rock_face",
      "snow_02",
      "dry_river_pebbles",
    ].map(async (id) => {
      const maps = await Promise.all(
        ["diff", "nor_gl", "rough"].map(async (k) => {
          const t = await loader.loadAsync(`/assets/${id}/${k}.jpg`);
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.anisotropy = 8;
          if (k === "diff") t.colorSpace = THREE.SRGBColorSpace;
          return t;
        }),
      );
      // Pack roughness into the normal texture alpha to stay within sampler limits.
      const canvas = document.createElement("canvas");
      canvas.width = maps[1].image.width;
      canvas.height = maps[1].image.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(maps[1].image, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      ctx.drawImage(maps[2].image, 0, 0, canvas.width, canvas.height);
      const rough = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 3; i < pixels.data.length; i += 4)
        pixels.data[i] = rough[i - 2];
      const packed = new THREE.DataTexture(
        pixels.data,
        canvas.width,
        canvas.height,
        THREE.RGBAFormat,
      );
      packed.flipY = true;
      packed.wrapS = packed.wrapT = THREE.RepeatWrapping;
      packed.anisotropy = 8;
      packed.generateMipmaps = true;
      packed.minFilter = THREE.LinearMipmapLinearFilter;
      packed.magFilter = THREE.LinearFilter;
      packed.needsUpdate = true;
      result[id] = { map: maps[0], normalMap: packed };
      maps[1].dispose();
      maps[2].dispose();
    }),
  );
  return result;
}
export function createTerrain(scene, surfaces) {
  const geo = new THREE.PlaneGeometry(4600, 4600, 640, 640);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.94,
    envMapIntensity: 0.48,
  });
  mat.onBeforeCompile = (s) => {
    const ids = [
      "grass_ground",
      "forest_ground_04",
      "rock_face",
      "snow_02",
      "dry_river_pebbles",
    ];
    ids.forEach(
      (id, i) => (s.uniforms["tex" + i] = { value: surfaces[id].map }),
    );
    s.uniforms.rockNormal = { value: surfaces.rock_face.normalMap };
    s.uniforms.grassNormal = { value: surfaces.grass_ground.normalMap };
    s.uniforms.pebbleNormal = { value: surfaces.dry_river_pebbles.normalMap };
    s.uniforms.forestNormal = { value: surfaces.forest_ground_04.normalMap };
    s.uniforms.snowNormal = { value: surfaces.snow_02.normalMap };
    s.vertexShader =
      "varying vec3 vWorld; varying vec3 vTerrainNormal;\n" + s.vertexShader;
    s.vertexShader = s.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvWorld=(modelMatrix*vec4(position,1.)).xyz;vTerrainNormal=normal;",
    );
    s.fragmentShader =
      `varying vec3 vWorld;varying vec3 vTerrainNormal;
 uniform sampler2D tex0,tex1,tex2,tex3,tex4,rockNormal,grassNormal,pebbleNormal,forestNormal,snowNormal;
 vec3 tri(sampler2D tex,vec3 p,vec3 w){return texture2D(tex,p.yz).rgb*w.x+texture2D(tex,p.xz).rgb*w.y+texture2D(tex,p.xy).rgb*w.z;}
 vec3 tile(sampler2D tex,vec2 uv,float d){return mix(texture2D(tex,uv).rgb,texture2D(tex,uv*.13).rgb,d);}
 ` + s.fragmentShader;
    s.fragmentShader = s.fragmentShader.replace(
      "#include <map_fragment>",
      `
 vec3 wn=normalize(vTerrainNormal);vec3 w=pow(abs(wn),vec3(5.));w/=dot(w,vec3(1.));
 float distBlend=smoothstep(80.,700.,distance(cameraPosition,vWorld));
 float macro=sin(vWorld.x*.012+sin(vWorld.z*.007)*3.)*sin(vWorld.z*.009)*.5+.5;
 float rock=smoothstep(.24,.63,1.-wn.y);
 rock=max(rock,smoothstep(230.,490.,vWorld.y)*.72);
 float snow=smoothstep(380.+macro*90.,610.+macro*100.,vWorld.y)*smoothstep(.18,.68,wn.y);
 float shore=1.-smoothstep(23.,26.,vWorld.y);
 float forest=smoothstep(32.,65.,vWorld.y)*(1.-smoothstep(150.,260.,vWorld.y))*.8;
 vec3 grass=tile(tex0,vWorld.xz*.13,distBlend)*vec3(.48,.79,.38);
 vec3 earth=tile(tex1,vWorld.xz*.16,distBlend)*vec3(.45,.58,.33);
 vec3 stone=mix(tri(tex2,vWorld*.085,w),tri(tex2,vWorld*.018,w),distBlend*.7)*vec3(.66,.71,.76);
 vec3 snowColor=tile(tex3,vWorld.xz*.1,distBlend);
 vec3 beach=tile(tex4,vWorld.xz*.22,distBlend);
 diffuseColor.rgb*=mix(mix(mix(mix(grass,earth,forest),stone,rock),snowColor,snow),beach,shore);
 diffuseColor.rgb*=.88+macro*.20;
 `,
    );
    s.fragmentShader = s.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `
 vec3 rn=tri(rockNormal,vWorld*.085,w)*2.-1.;
 vec3 gn=texture2D(grassNormal,vWorld.xz*.13).xyz*2.-1.;
 vec3 pn=texture2D(pebbleNormal,vWorld.xz*.22).xyz*2.-1.;
 vec3 fn=texture2D(forestNormal,vWorld.xz*.16).xyz*2.-1.;
 vec3 sn=texture2D(snowNormal,vWorld.xz*.1).xyz*2.-1.;
 vec3 detail=mix(mix(mix(mix(gn,fn,forest),rn,rock),sn,snow),pn,shore);
 vec3 nw=normalize(wn+vec3(detail.x,0.,detail.y)*.22*(1.-snow*.6));
 normal=normalize(mat3(viewMatrix)*nw);
 `,
    );
    s.fragmentShader = s.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      "float roughnessFactor = clamp(mix(mix(mix(mix(texture2D(grassNormal,vWorld.xz*.13).a,texture2D(forestNormal,vWorld.xz*.16).a,forest),texture2D(rockNormal,vWorld.xz*.085).a,rock),texture2D(snowNormal,vWorld.xz*.1).a,snow),texture2D(pebbleNormal,vWorld.xz*.22).a,shore),.48,1.);",
    );
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}
// Height map shared with the lake shader so the shoreline matches the terrain.
export function terrainHeightTexture() {
  const n = 512,
    data = new Float32Array(n * n);
  for (let z = 0; z < n; z++)
    for (let x = 0; x < n; x++)
      data[z * n + x] = height(
        (x / (n - 1) - 0.5) * 2400,
        (z / (n - 1) - 0.5) * 2400,
      );
  const t = new THREE.DataTexture(data, n, n, THREE.RedFormat, THREE.FloatType);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}
