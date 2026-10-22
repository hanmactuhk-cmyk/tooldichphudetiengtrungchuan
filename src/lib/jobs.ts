export async function apiJson(url:string,init?:RequestInit):Promise<any>{
 let response:Response;
 try { response=await fetch(url,init); }
 catch {
  let alive=false;
  try { alive=(await fetch('/api/health',{signal:AbortSignal.timeout(3000)})).ok; } catch {}
  throw new Error(alive?'Không gửi được tệp tới bộ xử lý. Hãy kiểm tra tệp video còn tồn tại và dung lượng ổ chứa tệp tạm, rồi chọn lại video.':'Mất kết nối bộ xử lý. Hãy lưu dự án rồi mở lại ứng dụng.');
 }
 let data:any;
 try{data=await response.json();}catch{throw new Error('Bộ xử lý không trả dữ liệu hợp lệ.');}
 if(!response.ok)throw new Error(typeof data.detail==='string'?data.detail:JSON.stringify(data.detail||'Xử lý thất bại'));
 return data;
}
export async function runJob(url:string,payload:any,onProgress:(p:number,t:string)=>void):Promise<any>{
 const {jobId}=await apiJson(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 window.dispatchEvent(new CustomEvent('hn-job',{detail:jobId}));
 try{
  for(;;){
   const job=await apiJson('/api/jobs/'+jobId);onProgress(job.percent,job.message);
   if(job.state==='done')return job.result;
   if(job.state==='error'||job.state==='cancelled')throw new Error(job.error||job.message);
   await new Promise(r=>setTimeout(r,750));
  }
 }finally{window.dispatchEvent(new CustomEvent('hn-job',{detail:null}));}
}
