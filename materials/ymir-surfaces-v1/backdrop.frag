#version 300 es
precision highp float;in vec2 uv;uniform vec3 base;uniform vec3 tint;uniform vec3 show_a,show_b;uniform float energy,scan;
uniform vec3 wall_camera,wall_target;uniform float wall_depth;out vec4 frag;
float wallHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float wallNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(wallHash(i),wallHash(i+vec2(1,0)),f.x),mix(wallHash(i+vec2(0,1)),wallHash(i+vec2(1,1)),f.x),f.y);}
void main(){float glow=exp(-length((uv-vec2(.32,.62))*vec2(1.25,.65))*2.8);vec3 c=base*(.55+.45*glow)+tint*.09*glow;
float a=exp(-length((uv-vec2(.30+.18*sin(scan),.70))*vec2(2.5,1.2))*2.);float b=exp(-length((uv-vec2(.70+.18*cos(scan),.50))*vec2(2.5,1.2))*2.);
c*=1.-energy*.45;c+=energy*(show_a*a+show_b*b)*.045;
// Analytic plaster wall: camera rays intersect a fixed per-set rear plane.
// The procedural grain stays on the wall, rather than swimming on the screen.
vec3 forward=normalize(wall_target-wall_camera),right=normalize(cross(forward,vec3(0,1,0))),up=cross(right,forward);
vec3 ray=normalize(forward+right*(uv.x*2.-1.)*.5625*.46630766+up*(uv.y*2.-1.)*.46630766);
vec2 p=wall_camera.xy+ray.xy*((wall_depth-wall_camera.z)/min(-.0001,ray.z));
float trowel=wallNoise(p*1.6)-.5;float stipple=wallNoise(p*9.0)-.5;
float aa=1.-smoothstep(.3,1.4,length(fwidth(p)*43.0));float mineral=(wallNoise(p*43.0)-.5)*aa;
c*=1.+.075*trowel+.12*stipple+.12*mineral;
c=pow(c/(c+vec3(.8)),vec3(1.0/2.2));frag=vec4(c,1.0);}