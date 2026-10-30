// Procedural depth-tested light shafts and colored particle billboards.
// Shafts are soft cone ribbons, not a claim of physically ray-marched volumes.
export function createShowRenderer(gl){
 const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
 const link=(vs,fs)=>{const v=compile(gl.VERTEX_SHADER,vs),f=compile(gl.FRAGMENT_SHADER,fs),p=gl.createProgram();gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));gl.deleteShader(v);gl.deleteShader(f);return p;};
 const particles=link(`#version 300 es
 precision highp float;layout(location=0) in vec3 point;layout(location=1) in vec4 settings;layout(location=2) in vec3 tint;
 uniform mat4 vp;out vec4 shape;out vec3 lightColor;
 void main(){gl_Position=vp*vec4(point,1);gl_PointSize=settings.x;shape=settings;lightColor=tint;}`,`#version 300 es
 precision highp float;in vec4 shape;in vec3 lightColor;out vec4 frag;
 void main(){vec2 q=(gl_PointCoord-.5)*2.;float c=cos(shape.z),s=sin(shape.z);q=mat2(c,-s,s,c)*q;
 float core=exp(-dot(q,q)*8.);float rays=exp(-abs(q.x)*22.)*pow(max(0.,1.-abs(q.y)),2.)+exp(-abs(q.y)*22.)*pow(max(0.,1.-abs(q.x)),2.);
 float a=shape.y*(shape.w<.5?core*.65+rays*.70:core*.70);if(a<.003)discard;frag=vec4(lightColor*a,min(.8,a));}`);
 const shafts=link(`#version 300 es
 precision highp float;layout(location=0) in vec3 point;layout(location=1) in vec2 uv;uniform mat4 vp;out vec2 cone;
  out vec3 worldPoint;void main(){gl_Position=vp*vec4(point,1);cone=uv;worldPoint=point;}`,`#version 300 es
  precision highp float;in vec2 cone;in vec3 worldPoint;uniform vec3 tint;uniform float energy;out vec4 frag;
  uniform sampler2D beam_shadow_map;uniform mat4 beam_light_matrix;uniform float shadow_enabled;
  void main(){float visibility=1.;vec4 clip=beam_light_matrix*vec4(worldPoint,1);vec3 p=clip.xyz/clip.w*.5+.5;
  if(shadow_enabled>.5&&clip.w>0.&&all(greaterThanEqual(p,vec3(0)))&&all(lessThanEqual(p,vec3(1))))visibility=p.z-.00012<texture(beam_shadow_map,p.xy).r?1.:.06;
  float edge=pow(max(0.,1.-abs(cone.x)),2.);float fade=smoothstep(0.,.12,cone.y)*(1.-smoothstep(.82,1.,cone.y));float a=edge*fade*energy*.22*visibility;frag=vec4(tint*a,a);}`);
 const pv=gl.createVertexArray(),pb=gl.createBuffer();gl.bindVertexArray(pv);gl.bindBuffer(gl.ARRAY_BUFFER,pb);
 for(const [loc,size,offset] of [[0,3,0],[1,4,12],[2,3,28]]){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,40,offset);}
 const sv=gl.createVertexArray(),sb=gl.createBuffer();gl.bindVertexArray(sv);gl.bindBuffer(gl.ARRAY_BUFFER,sb);
 for(const [loc,size,offset] of [[0,3,0],[1,2,12]]){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,20,offset);}gl.bindVertexArray(null);
 const sub=(a,b)=>a.map((v,k)=>v-b[k]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>{const n=Math.hypot(...a)||1;return a.map(v=>v/n);};
  return {draw(vp,origin,eye,show,shadows=null){
  if(!show.showEnergy)return {particles:0,shafts:0};
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
  gl.useProgram(shafts);gl.uniformMatrix4fv(gl.getUniformLocation(shafts,'vp'),false,vp);gl.bindVertexArray(sv);gl.bindBuffer(gl.ARRAY_BUFFER,sb);
  for(const [index,beam] of show.beams.entries()){
   const start=beam.start.map((v,k)=>v+origin[k]),end=beam.end.map((v,k)=>v+origin[k]),axis=sub(end,start),right=unit(cross(axis,sub(eye,start)));
   const vertex=(p,width,sign,v)=>[...p.map((x,k)=>x+right[k]*width*sign),sign,v];
   const a=vertex(start,.04,-1,0),b=vertex(start,.04,1,0),c=vertex(end,beam.width,-1,1),d=vertex(end,beam.width,1,1);
   gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([...a,...b,...c,...c,...b,...d]),gl.DYNAMIC_DRAW);
   gl.uniform3fv(gl.getUniformLocation(shafts,'tint'),beam.color);gl.uniform1f(gl.getUniformLocation(shafts,'energy'),beam.energy);
   gl.uniform1f(gl.getUniformLocation(shafts,'shadow_enabled'),shadows?1:0);
   if(shadows){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,shadows.maps[index]);gl.uniform1i(gl.getUniformLocation(shafts,'beam_shadow_map'),0);gl.uniformMatrix4fv(gl.getUniformLocation(shafts,'beam_light_matrix'),false,shadows.matrices[index]);}
   gl.drawArrays(gl.TRIANGLES,0,6);
  }
   if(show.particles.length){
    // Emissive sparks add transmitted light: never darken the lit wall/props.
    // Energy*individual opacity is premultiplied once in the shader below.
    gl.blendFunc(gl.ONE,gl.ONE);
   gl.useProgram(particles);gl.uniformMatrix4fv(gl.getUniformLocation(particles,'vp'),false,vp);gl.bindVertexArray(pv);gl.bindBuffer(gl.ARRAY_BUFFER,pb);
    const values=show.particles.flatMap(p=>[...p.point.map((v,k)=>v+origin[k]),p.sizePx,p.energy*(p.opacity??1),p.rotation,p.kind,...p.color]);
   gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(values),gl.DYNAMIC_DRAW);gl.drawArrays(gl.POINTS,0,show.particles.length);
  }
  gl.depthMask(true);gl.disable(gl.BLEND);gl.bindVertexArray(null);return {particles:show.particles.length,shafts:show.beams.length};
 },dispose(){for(const p of [particles,shafts])gl.deleteProgram(p);for(const b of [pb,sb])gl.deleteBuffer(b);for(const v of [pv,sv])gl.deleteVertexArray(v);}};
}
