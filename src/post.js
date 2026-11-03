import * as THREE from "three";
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  NormalPass,
  SSAOEffect,
  BloomEffect,
  SMAAEffect,
  VignetteEffect,
  ToneMappingEffect,
  ToneMappingMode,
  GodRaysEffect,
  Effect,
  EffectAttribute,
  BlendFunction,
} from "postprocessing";
class AerialPerspective extends Effect {
  constructor(camera) {
    super(
      "AerialPerspective",
      `uniform mat4 invProjection;uniform mat4 cameraWorld;uniform vec3 eye;
 void mainImage(const in vec4 inputColor,const in vec2 uv,out vec4 outputColor){
 float depth=readDepth(uv);if(depth>=.999999){outputColor=inputColor;return;}
 vec4 view=invProjection*vec4(uv*2.-1.,depth*2.-1.,1.);view/=view.w;
 vec3 world=(cameraWorld*view).xyz;float distanceToEye=length(world-eye);
 float dh=(world.y-eye.y)/95.;float integral=exp(-max(eye.y-22.,0.)/95.)*(1.-exp(-dh))/((abs(dh)<.001)? .001:dh);
 if(abs(dh)<.001)integral=exp(-max(eye.y-22.,0.)/95.);
 float fog=1.-exp(-distanceToEye*(.000055+.00016*max(integral,0.)));
 vec3 fogColor=mix(vec3(.39,.48,.50),vec3(.69,.61,.46),.28);
 outputColor=vec4(mix(inputColor.rgb,fogColor,clamp(fog,0.,.78)),inputColor.a);
 }`,
      {
        attributes: EffectAttribute.DEPTH,
        uniforms: new Map([
          ["invProjection", new THREE.Uniform(camera.projectionMatrixInverse)],
          ["cameraWorld", new THREE.Uniform(camera.matrixWorld)],
          ["eye", new THREE.Uniform(camera.position)],
        ]),
      },
    );
  }
}
export function createPost(renderer, scene, camera, disk, capture) {
  const composer = new EffectComposer(renderer, {
    frameBufferType: THREE.HalfFloatType,
    multisampling: 0,
  });
  composer.addPass(new RenderPass(scene, camera));
  const normal = new NormalPass(scene, camera, { resolutionScale: 0.5 });
  composer.addPass(normal);
  const ao = new SSAOEffect(camera, normal.texture, {
    blendFunction: BlendFunction.MULTIPLY,
    samples: 9,
    rings: 3,
    distanceThreshold: 0.08,
    distanceFalloff: 0.03,
    rangeThreshold: 0.001,
    rangeFalloff: 0.004,
    radius: 0.018,
    intensity: 0.55,
    bias: 0.025,
    resolutionScale: 0.5,
  });
  const aoPass = new EffectPass(camera, ao);
  aoPass.enabled = true;
  composer.addPass(aoPass);
  const fog = new AerialPerspective(camera);
  const bloom = new BloomEffect({
    intensity: 0.15,
    luminanceThreshold: 1.1,
    mipmapBlur: true,
  });
  const rays = new GodRaysEffect(camera, disk, {
    resolutionScale: 0.4,
    density: 0.94,
    decay: 0.94,
    weight: 0.22,
    exposure: 0.12,
    samples: 32,
    clampMax: 0.35,
  });
  composer.addPass(new EffectPass(camera, fog, bloom, rays));
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
  const vignette = new VignetteEffect({ offset: 0.22, darkness: 0.27 });
  composer.addPass(new EffectPass(camera, tone, vignette, new SMAAEffect()));
  return composer;
}
