"""Contextual offline translation, with no silent fallback to another model."""
import json
import os
from pathlib import Path
from model_pool import POOL
from subtitle_contract import validate_cues,json_translation,INSTRUCTION

class OfflineTranslator:
    def __init__(self,models):self.models=Path(models)

    def _load(self):
        from llama_cpp import Llama
        path=self.models/'qwen3/Qwen3-4B-Instruct-2507-Q4_K_M.gguf'
        if not path.is_file():raise ValueError('Thiếu model Qwen3-4B. Hãy kiểm tra bộ model.')
        return Llama(model_path=str(path),n_ctx=6144,n_threads=min(6,os.cpu_count() or 2),n_batch=256,n_gpu_layers=0,verbose=False)

    def translate(self,cues,characters=None,progress=lambda *_:None,cancelled=lambda:False):
        validate_cues(cues)
        schema={'type':'object','properties':{'translations':{'type':'array','items':{'type':'object','properties':{'id':{'type':'string'},'textVi':{'type':'string'}},'required':['id','textVi'],'additionalProperties':False}}},'required':['translations'],'additionalProperties':False}
        result=[];context=[]
        with POOL.use('qwen3',self._load) as model:
            for start in range(0,len(cues),8):
                if cancelled():raise RuntimeError('Đã dừng dịch.')
                batch=cues[start:start+8]
                progress(round(start/len(cues)*95),f'Qwen3: dịch câu {start+1}–{start+len(batch)}/{len(cues)}')
                system=(INSTRUCTION+'\nLần này trả JSON theo schema thay vì SRT: {"translations":[{"id":"ID gốc","textVi":"bản dịch"}]}. '
                    'Không giải thích, không suy nghĩ thành văn bản. Dịch đủ từng ý, không thêm nội dung. '
                    'Giữ quan hệ nhân xưng xuyên suốt các câu. Không tự coi mọi người đều là tôi/bạn. '
                    'Thông tin pronounSelf và pronounCall của nhân vật là bắt buộc. '
                    'Người chồng xưng anh, gọi vợ là em: 老婆 dịch là Em à hoặc Vợ à, tuyệt đối không gọi vợ là chị. '
                    'Người vợ xưng em, gọi chồng là anh: 老公 dịch là Anh à hoặc Chồng à.')
                user=json.dumps({'characters':characters or [],'previousTranslations':context[-8:],
                    'subtitles':[{'id':s['id'],'speaker':s.get('characterId'),'speakerContext':next((c for c in characters or [] if c.get('id')==s.get('characterId')),{}),'seconds':round(s['endTime']-s['startTime'],2),'textZh':s['textZh']} for s in batch]},ensure_ascii=False)
                if len(model.tokenize((system+user).encode()))>4800:raise ValueError('Ngữ cảnh quá dài. Hãy chia nhỏ câu hoặc thông tin nhân vật.')
                response=model.create_chat_completion(messages=[{'role':'system','content':system},{'role':'user','content':user}],
                    temperature=.15,max_tokens=1200,response_format={'type':'json_object','schema':schema})
                if response['choices'][0].get('finish_reason')=='length':raise ValueError('Model dừng do quá dài. Chưa áp dụng bản dịch thiếu.')
                translated=json_translation(response['choices'][0]['message']['content'],batch)
                result.extend(translated)
                context.extend({'zh':s['textZh'],'vi':t['viFull']} for s,t in zip(batch,translated))
        return {'translations':result,'modelUsed':'Qwen3-4B-Instruct-2507 Q4_K_M offline'}
