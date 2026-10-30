#!/usr/bin/env python3
"""Read-only mesh audit; reports exclude names, materials and colors from hashes.

Local mesh reuse is distinct from assembly equivalence: transforms, joints and
deformation remain significant when deciding whether two props are interchangeable.
Triangle fingerprints tolerate vertex/triangle reordering but preserve winding,
multiplicity, exact float values, normals and UVs in the render-safe comparison.
"""
import argparse,collections,hashlib,json,struct
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def triangle_hash(vertices,indices):
    triangles=[]
    for i in range(0,len(indices),3):
        t=tuple(vertices[j] for j in indices[i:i+3])
        triangles.append(min(t,t[1:]+t[:1],t[2:]+t[:2]))
    return digest(sorted(triangles))
def analyze(root=ROOT):
    catalog=json.loads((root/'catalog.json').read_text());props=[];pieces=collections.defaultdict(list)
    for entry in catalog['assets']:
        if entry['type']!='prop':continue
        file=root/entry['manifest'];asset=json.loads(file.read_text())
        if asset['schemaVersion']>=2:
            model_file=root/asset['model'];model=json.loads(model_file.read_text());mesh_file=model_file.parent/model['mesh'];raw=mesh_file.read_bytes()
            pieces_by_id={p['id']:p for p in model['parts']}
            nodes=[{**pieces_by_id[p['partId']],**p} for p in asset['parts']]
        else:mesh_file=file.parent/asset['mesh'];raw=mesh_file.read_bytes();nodes=asset['nodes']
        render_parts=[];shape_parts=[];assemblies=[];byte_parts=[]
        for i,node in enumerate(nodes):
            vb=raw[node['vertex_offset']:node['vertex_offset']+node['vertex_count']*32]
            ib=raw[node['index_offset']:node['index_offset']+node['index_count']*4]
            vertices=list(struct.iter_unpack('<8f',vb));indices=struct.unpack('<'+str(node['index_count'])+'I',ib)
            exact=digest([hashlib.sha256(vb).hexdigest(),hashlib.sha256(ib).hexdigest()])
            render=triangle_hash(vertices,indices);shape=triangle_hash([v[:3] for v in vertices],indices)
            render_parts.append(render);shape_parts.append(shape);byte_parts.append(exact)
            assemblies.append(digest([render,{k:node.get(k) for k in ['pos','rot','scale','joint','deformability']}]))
            pieces[exact].append({'assetId':entry['id'],'name':entry['name'],'node':i,'label':node.get('label'),'bytes':len(vb)+len(ib),
              'mesh':str(mesh_file.relative_to(root)),'vertexOffset':node['vertex_offset'],'indexOffset':node['index_offset']})
        props.append({'id':entry['id'],'name':entry['name'],'manifest':entry['manifest'],
          'localBytes':digest(sorted(byte_parts)),'localRender':digest(sorted(render_parts)),
          'localShape':digest(sorted(shape_parts)),'assembly':digest(sorted(assemblies)),
          'transforms':[{k:n.get(k) for k in ['pos','rot','scale','joint','deformability']} for n in nodes]})
    def groups(key):
        buckets=collections.defaultdict(list)
        for prop in props:buckets[prop[key]].append({k:prop[k] for k in ['id','name','manifest','transforms']})
        return [v for v in buckets.values() if len(v)>1]
    repeated=[v for v in pieces.values() if len(v)>1]
    physical=[]
    for group in repeated:
        unique={(p['mesh'],p['vertexOffset'],p['indexOffset']):p for p in group}
        if len(unique)>1:physical.append(list(unique.values()))
    return {'method':'Exact local vertex/index hashes; reorder-invariant triangle hashes with winding and multiplicity; render hashes retain normals/UVs; no material or color data.',
      'propCount':len(props),'exactLocalMeshGroups':groups('localBytes'),'reorderedRenderMeshGroups':groups('localRender'),
      'positionTopologyGroups':groups('localShape'),'identicalAssemblyGroups':groups('assembly'),
      'sharedPieces':repeated,'physicallyRepeatedPieces':physical,
      'redundantPieceBytes':sum(sum(p['bytes'] for p in group[1:]) for group in physical),
      'caution':'Local mesh groups ignore placement, scale, joints and deformation; do not blindly merge those settings. Position-only groups may differ in shading or UVs. No approximate/normalized matches are asserted as exact.'}
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--out',type=Path);args=parser.parse_args();report=analyze()
    if args.out:args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(json.dumps(report,indent=2)+'\n')
    print(f"{report['propCount']} props; {len(report['exactLocalMeshGroups'])} exact local-mesh groups; {len(report['identicalAssemblyGroups'])} identical assembly groups.")
    for group in report['exactLocalMeshGroups']:print('Same meshes: '+', '.join(p['name'] for p in group))
    print(f"{len(report['sharedPieces'])} repeated individual mesh pieces; {report['redundantPieceBytes']:,} redundant bytes (excluding staged projects).")
