import http from 'node:http';
import {readFile,realpath,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createEditor} from './editor.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const mounts={'/ymir/':path.resolve(root),'/trinity/':path.resolve(root,'node_modules/trinity')};
const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.bin':'application/octet-stream','.vert':'text/plain','.frag':'text/plain','.glsl':'text/plain'};
export function createAssetServer({libraryRoot=root}={}){
  const editor=createEditor(libraryRoot);
  const publicMounts={...mounts,'/ymir/':path.resolve(libraryRoot)};
  return http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      if(await editor(req,res,url))return;
      if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
      let pathname=decodeURIComponent(url.pathname);
      if(pathname==='/'){res.writeHead(302,{location:'/ymir/browser/'});res.end();return;}
      const prefix=Object.keys(publicMounts).find(p=>pathname.startsWith(p));
      if(!prefix){res.writeHead(404);res.end('Not found');return;}
      const base=await realpath(publicMounts[prefix]);
      let file=path.resolve(base,pathname.slice(prefix.length));
      if(file!==base&&!file.startsWith(base+path.sep))throw new Error('Outside asset root');
      // Never expose git internals, hidden files, or symlink escapes.
      if(path.relative(base,file).split(path.sep).some(s=>s.startsWith('.')))throw new Error('Hidden file');
      if((await stat(file)).isDirectory())file=path.join(file,'index.html');
      file=await realpath(file);if(!file.startsWith(base+path.sep))throw new Error('Symlink escape');
      res.writeHead(200,{'content-type':types[path.extname(file)]??'application/octet-stream','cache-control':'no-store'});
      res.end(await readFile(file));
    }catch{res.writeHead(404);res.end('Not found');}
  });
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT??4174);const server=createAssetServer();
  server.listen(port,'127.0.0.1',()=>console.log(`Ymir browser: http://127.0.0.1:${server.address().port}/`));
}
