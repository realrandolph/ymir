#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec3 in_pos;
layout(location=1) in vec3 in_normal;
layout(location=2) in vec2 in_uv;
uniform mat4 model, view_projection, light_matrix;
uniform vec4 articulation; // jaw, torsion, whisper ripple, saved cutoff aperture
uniform vec4 percussion; // snare shear, neuro tear, clap snap, detail strike
uniform vec4 voice; // envelope, progress, category, treatment
uniform vec4 extra; // sub, kick, glitch, note pitch
uniform float local_time;
uniform float deformability;
out vec3 world_pos;
out vec3 original_pos;
out vec3 world_normal;
out vec2 uv;
out vec4 shadow_pos;

vec3 deform(vec3 p) {
    vec3 original=p;
    float mask = clamp((p.y+1.5)*0.28,0.0,1.0);
    p.x *= 1.0 + articulation.x*0.19*mask + articulation.w*0.13;
    p.y += articulation.x*0.18*sin(p.x*2.4)*mask;
    float a=articulation.y*0.30*p.y;
    p.xz=mat2(cos(a),-sin(a),sin(a),cos(a))*p.xz;
    p.z += articulation.z*0.20*sin(p.y*5.0+p.x*3.0+local_time*3.0)*mask;
    p.x += percussion.x*0.22*tanh(p.y*3.0);
    p.z += percussion.y*0.16*sin(p.y*9.0+p.x*4.0);
    p.y *= 1.0-percussion.z*0.08;
    p.x += percussion.w*0.06*cos(p.y*8.0);
    p.y += extra.x*0.10*cos(p.x*1.8) - extra.y*0.13;
    p.x += extra.z*0.12*floor((p.y+3.0)*5.0)*0.08;
    float v=voice.x;
    if(voice.z < 1.5) { p.y += v*0.25*mask; p.x*=1.0+v*0.08; }
    else if(voice.z < 3.5) { p.x+=v*0.25*sin(p.y*3.0-voice.y*5.5); }
    else if(voice.z < 5.5) { p.x*=1.0+v*0.22*sin(p.y*2.0); p.z+=v*0.14; }
    else if(voice.z < 8.5) { p.y+=v*0.24*sin(p.x*2.0+voice.y*5.0); }
    else if(voice.z < 12.5) { p.z+=v*0.22*sin(p.y*2.4+p.x*3.0-voice.y*6.283); }
    else { p.x+=v*0.22*tanh(p.y*3.0-voice.y*4.0); }
    // Manufactured props are rigid. Cloth only receives a small displacement,
    // fading to zero at attachment roots so knots and seams cannot separate.
    float attach=smoothstep(0.0,0.14,in_uv.x)*(1.0-smoothstep(0.86,1.0,in_uv.x));
    return mix(original,p,deformability*attach);
}

void main(){
    vec3 p=deform(in_pos);
    vec3 n=normalize(in_normal);
    vec3 tangent=normalize(cross(n,abs(n.y)<0.8?vec3(0,1,0):vec3(1,0,0)));
    vec3 bitangent=cross(n,tangent);
    vec3 dt=deform(in_pos+tangent*0.005)-p;
    vec3 db=deform(in_pos+bitangent*0.005)-p;
    n=normalize(cross(dt,db));
    vec4 w=model*vec4(p,1.0);
    world_pos=w.xyz;
    original_pos=in_pos;
    world_normal=normalize(mat3(transpose(inverse(model)))*n);
    uv=in_uv;
    shadow_pos=light_matrix*w;
    gl_Position=view_projection*w;
}
