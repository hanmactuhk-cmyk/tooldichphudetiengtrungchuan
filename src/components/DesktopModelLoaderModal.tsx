import React,{useEffect,useState} from 'react';
export function DesktopModelLoaderModal({isOpen,onClose,onModelsLoaded}:{isOpen:boolean;onClose:()=>void;onModelsLoaded:()=>void}){
 const [data,setData]=useState<any>(null);const [error,setError]=useState('');
 useEffect(()=>{if(isOpen){fetch('/api/health').then(r=>{if(!r.ok)throw Error('Không kết nối được bộ xử lý');return r.json()}).then(setData).catch(e=>setError(String(e)));}},[isOpen]);
 if(!isOpen)return null;
 return <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"><div className="bg-zinc-900 rounded-xl p-6 max-w-lg"><h2 className="font-bold mb-4">Model offline trên máy</h2><p className="text-red-300">{error}</p>{data&&<><p className="text-xs break-all mb-3">{data.modelDirectory}</p>{Object.entries(data.models).map(([name,ready])=><p key={name}>{name}: {ready?'Đã có thư mục model':'Chưa cài'}</p>)}<p className="text-xs mt-4 text-zinc-400">Bản đóng gói kèm model. Dùng VERIFY-MODELS.bat để xác minh SHA256 của toàn bộ tệp.</p></>}<button className="bg-rose-700 rounded p-2 mt-5" onClick={onClose}>Đóng</button></div></div>;
}
