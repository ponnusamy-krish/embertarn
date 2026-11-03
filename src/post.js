import * as THREE from "three/webgpu";
import { pass, vec4, vec3, float, screenUV, renderOutput } from "three/tsl";
import { ao } from "three/addons/tsl/display/GTAONode.js";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { fxaa } from "three/addons/tsl/display/FXAANode.js";
import { godrays } from "three/addons/tsl/display/GodraysNode.js";
export function createPost(renderer, scene, camera, shaftSun, ultra) {
  const pipeline = new THREE.RenderPipeline(renderer),
    scenePass = pass(scene, camera);
  scenePass.setResolutionScale(1);
  const color = scenePass.getTextureNode("output"),
    depth = scenePass.getTextureNode("depth");
  const gtao = ao(depth, null, camera);
  gtao.resolutionScale = 0.5;
  gtao.radius.value = 3;
  gtao.thickness.value = 2.5;
  gtao.samples.value = ultra ? 16 : 8;
  gtao.useTemporalFiltering = false;
  const glow = bloom(color, 0.14, 0.5, 1.2);
  const shafts = godrays(depth, camera, shaftSun);
  shafts.resolutionScale = 0.25;
  shafts.raymarchSteps.value = 20;
  shafts.density.value = 0.035;
  shafts.maxDensity.value = 0.06;
  const vignette = float(1).sub(screenUV.sub(0.5).length().pow(2).mul(0.22));
  const composite = vec4(
    color.rgb
      .mul(gtao.mul(0.45).add(0.55))
      .add(glow.rgb)
      .add(shafts.rgb.mul(0.12))
      .mul(vignette),
    1,
  );
  pipeline.outputColorTransform = false;
  pipeline.outputNode = fxaa(renderOutput(composite));
  return {
    pipeline,
    scenePass,
    gtao,
    render() {
      pipeline.render();
    },
  };
}
