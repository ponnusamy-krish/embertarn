import * as THREE from "three/webgpu";
import { pass, vec4, vec3, float, screenUV, renderOutput, vec2, mix, sin } from "three/tsl";
import { ao } from "three/addons/tsl/display/GTAONode.js";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { fxaa } from "three/addons/tsl/display/FXAANode.js";
import { godrays } from "three/addons/tsl/display/GodraysNode.js";
export function createPost(renderer, scene, camera, shaftSun, ultra, film=null) {
  const pipeline = new THREE.RenderPipeline(renderer),
    scenePass = pass(scene, camera, {samples: ultra ? 4 : 2});
  scenePass.setResolutionScale(1);
  const color = scenePass.getTextureNode("output"),
    depth = scenePass.getTextureNode("depth");
  const gtao = ao(depth, null, camera);
  gtao.resolutionScale = 0.5;
  gtao.radius.value = .7;
  gtao.thickness.value = .6;
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
      .mul(gtao.mul(0.2).add(0.8))
      .add(glow.rgb)
      .add(shafts.rgb.mul(0.12))
      .mul(vignette),
    1,
  );
  pipeline.outputColorTransform = false;
  if(film){
    const q=screenUV.sub(.5),r=q.dot(q),lens=q.mul(r.mul(.018).add(1)).add(.5),pixel=vec2(1/1920,1/1080);
    const z=scenePass.getViewZNode(),blur=z.abs().sub(film.focus).abs().div(film.focus).clamp(0,1).mul(film.dof).mul(2.8).add(.35);
    const c=color.sample(lens).rgb.mul(.5).add(color.sample(lens.add(pixel.mul(blur))).rgb.mul(.25)).add(color.sample(lens.sub(pixel.mul(blur))).rgb.mul(.25));
    const ca=q.mul(.00045),chromatic=vec3(color.sample(lens.add(ca)).r,c.g,color.sample(lens.sub(ca)).b);
    const soft=mix(c,chromatic,.35),luma=soft.dot(vec3(.2126,.7152,.0722));
    const graded=soft.mul(mix(vec3(.87,1.015,1.035),vec3(1.18,1.035,.85),luma.smoothstep(.08,.8))).add(vec3(.004,.006,.007));
    const glare=screenUV.sub(film.sunUV).length().mul(-9).exp().mul(film.glare);
    const grain=sin(screenUV.dot(vec2(12341.7,45321.3)).add(film.time.mul(173.19))).mul(43758.5453).fract().sub(.5).mul(.0017);
    const filmColor=graded.mul(gtao.mul(.16).add(.84)).add(glow.rgb.mul(.7)).add(vec3(1,.62,.27).mul(glare)).mul(float(1).sub(r.mul(.26)));
    pipeline.outputNode=fxaa(renderOutput(vec4(filmColor,1))).add(vec4(vec3(grain),0));
  }else pipeline.outputNode = fxaa(renderOutput(composite));
  return {
    pipeline,
    scenePass,
    gtao,
    render() {
      pipeline.render();
    },
  };
}
