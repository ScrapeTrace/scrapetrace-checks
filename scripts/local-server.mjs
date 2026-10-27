import http from 'node:http';
import {Readable} from 'node:stream';
export async function serve(worker){
 const server=http.createServer(async(req,res)=>{
  try{
   const request=new Request('http://127.0.0.1:'+server.address().port+req.url,{method:req.method});
   const response=await worker.fetch(request,{}, {waitUntil:p=>p.catch(()=>{})});
   res.writeHead(response.status,Object.fromEntries(response.headers));
   if(response.body){const stream=Readable.fromWeb(response.body);res.on('close',()=>stream.destroy());stream.on('error',()=>{});stream.pipe(res);}else res.end();
  }catch(e){res.writeHead(500);res.end(String(e));}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {url:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);})};
}
