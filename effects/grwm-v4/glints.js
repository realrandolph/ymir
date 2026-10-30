export function createGlintRenderer(gl){
 const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
 const vertex=compile(gl.VERTEX_SHADER,`#version 300 es
 precision highp float;
 layout(location=0) in vec3 center;layout(location=1) in vec3 settings;
 uniform mat4 vp;out vec2 sparkle;
 void main(){gl_Position=vp*vec4(center,1);gl_Position.z-=.00018*gl_Position.w;gl_PointSize=settings.x;sparkle=settings.yz;}`);
 const fragment=compile(gl.FRAGMENT_SHADER,`#version 300 es
 precision highp float;in vec2 sparkle;out vec4 color;
 void main(){vec2 p=(gl_PointCoord-.5)*2.;float c=cos(sparkle.y),s=sin(sparkle.y);p=mat2(c,-s,s,c)*p;
 float core=exp(-dot(p,p)*38.);float rays=exp(-abs(p.x)*45.)*pow(max(0.,1.-abs(p.y)),2.)+exp(-abs(p.y)*45.)*pow(max(0.,1.-abs(p.x)),2.);
 float a=min(.50,(core*.55+rays*.45)*sparkle.x);if(a<.002)discard;color=vec4(vec3(1.,.93,.79)*a,a);}`);
 const program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.deleteShader(vertex);gl.deleteShader(fragment);
 const vao=gl.createVertexArray(),buffer=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 for(const [location,offset] of [[0,0],[1,12]]){gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,3,gl.FLOAT,false,24,offset);}gl.bindVertexArray(null);
 return {draw(vp,points){if(!points.length)return;gl.useProgram(program);gl.uniformMatrix4fv(gl.getUniformLocation(program,'vp'),false,vp);gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points.flat()),gl.DYNAMIC_DRAW);
    gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.depthMask(false);gl.drawArrays(gl.POINTS,0,points.length);gl.depthMask(true);gl.disable(gl.BLEND);gl.bindVertexArray(null);
  },dispose(){gl.deleteBuffer(buffer);gl.deleteVertexArray(vao);gl.deleteProgram(program);}};
}
