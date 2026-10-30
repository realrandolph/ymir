// Albedo only: named solids and pigment patterns. No grain, weave, fibres,
// surface relief, roughness, metalness, occlusion or material-dependent inputs.
float pigmentHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
vec3 ymirColor(vec3 primary,vec3 secondary,float kind,vec2 uv,vec3 pos){
    if(kind<-.5)return primary;
    if(kind>4.5&&kind<5.5){
        float m=sin(pos.x*3.+sin(pos.z*4.+pos.y*2.)*2.);
        return mix(primary,secondary,pow(.5+.5*m,4.)*.72);
    }
    if(kind>12.5&&kind<13.5){ // pigment speckles, not surface pores/relief
        float cloud=sin(pos.x*13.+sin(pos.y*17.))*sin(pos.z*19.+pos.y*8.);
        float aa=1.-smoothstep(.35,1.4,length(fwidth(pos)*120.));
        float speck=pigmentHash(floor(pos*120.));
        return primary*(1.+.025*cloud-.12*smoothstep(.83,.99,speck)*aa);
    }
    if(kind>15.5&&kind<16.5){ // wood-colored pigment bands; relief stays in Material
        vec2 p=pos.xz;float drift=.55*sin(p.y*.75)+.16*sin(p.y*2.1);
        float slow=sin(p.x*9.+drift*1.3),aa=exp(-abs(fwidth(p.x))*74.);
        float line=sin(p.x*74.+drift*2.4+sin(p.x*13.)*.55)*aa;
        float fine=sin(p.x*137.+drift*3.+p.y*.35)*exp(-abs(fwidth(p.x))*137.);
        return primary*(1.+.060*slow+.085*line+.045*fine)+vec3(.018,.010,.004)*slow;
    }
    if(kind>22.5&&kind<25.5){
        vec2 cell=floor(uv);float mask;
        if(kind<23.5)mask=mod(cell.x+cell.y,2.);
        else if(kind<24.5){vec2 q=mod(cell,4.);float diagonal=step(1.,mod(floor((uv.x-uv.y)*2.),4.));mask=(q.x<2.&&q.y<2.)?0.:(q.x>=2.&&q.y>=2.)?1.:diagonal;}
        else mask=.5+.5*sin(uv.x*6.2831853);
        float aa=clamp(length(fwidth(uv)),0.,1.);
        return mix(mix(primary,secondary,mask),mix(primary,secondary,.5),aa);
    }
    return primary;
}
