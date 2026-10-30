// Selective optical glow from the completed lit scene. Captions are composited
// separately afterwards. Linear-light extraction/blurring, no temporal history,
// noise, blanket haze, exposure pumping, or blur of the underlying scene.
export function createBloomRenderer(gl,width,height){
  const vertex=`#version 300 es
  precision highp float;out vec2 uv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=p;gl_Position=vec4(p*2.-1.,0,1);}`;
  const link=body=>{
    const shaders=[gl.VERTEX_SHADER,gl.FRAGMENT_SHADER].map((type,i)=>{const s=gl.createShader(type);gl.shaderSource(s,i===0?vertex:`#version 300 es\nprecision highp float;in vec2 uv;out vec4 frag;${body}`);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;});
    const p=gl.createProgram();for(const s of shaders)gl.attachShader(p,s);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));for(const s of shaders)gl.deleteShader(s);return p;
  };
  if(!gl.getExtension('EXT_color_buffer_float'))throw new Error('Linear-light bloom requires floating-point render targets');
  const targets=[];
  const target=(w,h,internal=gl.RGBA16F,type=gl.HALF_FLOAT)=>{
    const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,internal,w,h,0,gl.RGBA,type,null);
    for(const [key,value] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,key,value);
    const framebuffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Bloom target incomplete');
    const result={texture,framebuffer,width:w,height:h};targets.push(result);return result;
  };
  // Preserve the approved display shading and antialiasing exactly: resolve a
  // multisampled RGBA8 beauty image, then decode it for optical scattering only.
  const scene=target(width,height,gl.RGBA8,gl.UNSIGNED_BYTE),sceneFramebuffer=gl.createFramebuffer();
  const color=gl.createRenderbuffer(),depth=gl.createRenderbuffer();
  const sampleCounts=gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA8,gl.SAMPLES);
  const samples=Math.min(4,Math.max(...sampleCounts));
  gl.bindFramebuffer(gl.FRAMEBUFFER,sceneFramebuffer);gl.bindRenderbuffer(gl.RENDERBUFFER,color);gl.renderbufferStorageMultisample(gl.RENDERBUFFER,samples,gl.RGBA8,width,height);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,color);
  gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorageMultisample(gl.RENDERBUFFER,samples,gl.DEPTH_COMPONENT24,width,height);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);
  if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Beauty MSAA target incomplete');
  const levels=Array.from({length:5},(_,i)=>{const divisor=2**(i+1),w=Math.ceil(width/divisor),h=Math.ceil(height/divisor);return [target(w,h),target(w,h)];});
  const extract=link(`uniform sampler2D source;uniform vec2 texel;
  vec3 highlight(vec2 p){vec3 c=pow(max(texture(source,p).rgb,vec3(0)),vec3(2.2));
    float brightness=mix(dot(c,vec3(.2126,.7152,.0722)),max(c.r,max(c.g,c.b)),.35);
    float knee=clamp(brightness-.30+.10,0.,.20);knee=knee*knee/.40;
    return c*max(brightness-.30,knee)/max(brightness,.0001);}
  void main(){vec3 c=vec3(0);for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)c+=highlight(uv+vec2(x,y)*texel)*float((x==0?2:1)*(y==0?2:1))/16.;frag=vec4(c,1);}`);
  const downsample=link(`uniform sampler2D source;uniform vec2 texel;
  void main(){vec3 c=vec3(0);for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)c+=texture(source,uv+vec2(x,y)*texel).rgb*float((x==0?2:1)*(y==0?2:1))/16.;frag=vec4(c,1);}`);
  const blur=link(`uniform sampler2D source;uniform vec2 texel;
  void main(){vec3 c=texture(source,uv).rgb*.227027027;
    c+=(texture(source,uv+texel*1.384615385).rgb+texture(source,uv-texel*1.384615385).rgb)*.316216216;
    c+=(texture(source,uv+texel*3.230769231).rgb+texture(source,uv-texel*3.230769231).rgb)*.070270270;frag=vec4(c,1);}`);
  const composite=link(`uniform sampler2D source,halo0,halo1,halo2,halo3,halo4;uniform float strength;
  void main(){vec3 base=texture(source,uv).rgb;if(strength<=0.){frag=vec4(base,1);return;}
    vec3 halo=texture(halo0,uv).rgb*.40+texture(halo1,uv).rgb*.28+texture(halo2,uv).rgb*.18+texture(halo3,uv).rgb*.10+texture(halo4,uv).rgb*.04;
    vec3 linear=pow(base,vec3(2.2));
    // Bounded, hue-preserving linear screen blend leaves deep blacks untouched
    // outside the local halo and rolls highlights off instead of clipping.
    linear+=max(vec3(0),vec3(1)-linear)*(vec3(1)-exp(-halo*strength));
    frag=vec4(pow(max(linear,vec3(0)),vec3(1./2.2)),1);}`);
  const vao=gl.createVertexArray();
  const bind=(p,name,texture,unit)=>{gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(gl.getUniformLocation(p,name),unit);};
  const pass=(p,input,output,texel)=>{gl.bindFramebuffer(gl.FRAMEBUFFER,output.framebuffer);gl.viewport(0,0,output.width,output.height);gl.useProgram(p);bind(p,'source',input.texture,0);gl.uniform2fv(gl.getUniformLocation(p,'texel'),texel);gl.drawArrays(gl.TRIANGLES,0,3);};
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  return {begin(){gl.bindFramebuffer(gl.FRAMEBUFFER,sceneFramebuffer);gl.viewport(0,0,width,height);},
    finish(strength){
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER,sceneFramebuffer);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,scene.framebuffer);gl.blitFramebuffer(0,0,width,height,0,0,width,height,gl.COLOR_BUFFER_BIT,gl.NEAREST);
      gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.bindVertexArray(vao);
      let input=scene;
      for(let i=0;strength>0&&i<levels.length;i++){
        const [a,b]=levels[i];pass(i===0?extract:downsample,input,a,[1/input.width,1/input.height]);
        pass(blur,a,b,[1/a.width,0]);pass(blur,b,a,[0,1/a.height]);input=a;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,width,height);gl.useProgram(composite);bind(composite,'source',scene.texture,0);
      levels.forEach(([a],i)=>bind(composite,`halo${i}`,a.texture,i+1));gl.uniform1f(gl.getUniformLocation(composite,'strength'),strength);gl.drawArrays(gl.TRIANGLES,0,3);gl.bindVertexArray(null);gl.enable(gl.DEPTH_TEST);
    },settings:{threshold_linear:.30,soft_knee:.10,level_weights:[.40,.28,.18,.10,.04],samples,caption_bloom:false,temporal_history:false},
    dispose(){for(const t of targets){gl.deleteTexture(t.texture);gl.deleteFramebuffer(t.framebuffer);}gl.deleteFramebuffer(sceneFramebuffer);gl.deleteRenderbuffer(color);gl.deleteRenderbuffer(depth);gl.deleteVertexArray(vao);for(const p of [extract,downsample,blur,composite])gl.deleteProgram(p);}
  };
}
