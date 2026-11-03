import * as THREE from "three";
// Images baked from the original CC0 fir scan retain all needles without runtime geometry cost.
export async function scannedForest(scene, manager, placements, time) {
  const dimensions = await (await fetch("/assets/fir-impostors.json")).json();
  const textures = await Promise.all(
    dimensions.map((_, i) =>
      new THREE.TextureLoader(manager).loadAsync(
        `/assets/fir-impostor-${i}.png`,
      ),
    ),
  );
  textures.forEach((t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
  });
  for (let variant = 0; variant < textures.length; variant++) {
    const group = placements.filter((v, i) => i % textures.length === variant);
    const material = new THREE.MeshBasicMaterial({
      map: textures[variant],
      alphaTest: 0.22,
      side: THREE.DoubleSide,
      depthWrite: true,
      fog: true,
    });
    material.onBeforeCompile = (s) => {
      s.uniforms.uTime = time;
      s.vertexShader = "uniform float uTime;\n" + s.vertexShader;
      s.vertexShader = s.vertexShader.replace(
        "#include <project_vertex>",
        `
   vec3 base=instanceMatrix[3].xyz;float sc=length(instanceMatrix[0].xyz);
   vec3 right=normalize(vec3(viewMatrix[0][0],0.,viewMatrix[2][0]));
   float wind=sin(uTime*.65+base.x*.08+base.z*.07)*pow(max(transformed.y,0.)/21.,2.)*.13;
   vec3 billboard=base+right*(transformed.x+wind)*sc+vec3(0.,transformed.y*sc,0.);
   vec4 mvPosition=modelViewMatrix*vec4(billboard,1.);gl_Position=projectionMatrix*mvPosition;
  `,
      );
    };
    const geometry = new THREE.PlaneGeometry(dimensions[variant].width, 21);
    geometry.translate(0, 10, 0);
    const instance = new THREE.InstancedMesh(geometry, material, group.length),
      dummy = new THREE.Object3D();
    group.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      instance.setMatrixAt(i, dummy.matrix);
      instance.setColorAt(
        i,
        new THREE.Color().setScalar(0.82 + (i % 7) * 0.045),
      );
    });
    instance.computeBoundingSphere();
    scene.add(instance);
  }
}
