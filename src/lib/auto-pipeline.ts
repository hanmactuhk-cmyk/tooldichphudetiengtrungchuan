export interface AutoSettings{file?:File;recognition:'speech'|'ocr'|'gemini';provider:'offline'|'gemini'|'chatgpt';inputMode:'text'|'srt-file';voiceId:string;volume:number;folder:{token:string;path:string};name:string;saveSrt:boolean;saveProject:boolean;}
export const AUTO_STEPS=['Nhập / chuẩn bị video','Nhận diện phụ đề','Dịch sang tiếng Việt','Tạo giọng và căn timeline','Xuất MP4'];
export async function continueAuto<T>(state:{next:number;value:T},operations:((value:T)=>Promise<T>)[],onStep:(step:number)=>void,cancelled:()=>boolean){
 for(let i=state.next;i<operations.length;i++){if(cancelled())throw Error('Đã dừng Auto. Kết quả hoàn tất được giữ lại.');onStep(i);const next=await operations[i](state.value);if(cancelled())throw Error('Đã dừng Auto. Kết quả hoàn tất được giữ lại.');state.value=next;state.next=i+1;}
 return state.value;
}
