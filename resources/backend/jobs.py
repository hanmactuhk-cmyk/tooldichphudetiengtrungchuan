import hashlib
import json
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

class Jobs:
    def __init__(self):
        self.executor=ThreadPoolExecutor(max_workers=1,thread_name_prefix='hnvoice')
        self.lock=threading.RLock();self.items={}

    def submit(self,kind,payload,run):
        signature=hashlib.sha256(json.dumps([kind,payload],sort_keys=True,ensure_ascii=False).encode()).hexdigest()
        with self.lock:
            for item in self.items.values():
                if item['signature']==signature and item['state'] in ('queued','running') and not item['cancel'].is_set():
                    return {'jobId':item['id'],'reused':True}
            identifier=uuid.uuid4().hex
            self.items[identifier]={'id':identifier,'signature':signature,'state':'queued','percent':0,'message':'Đang chờ tác vụ trước...','cancel':threading.Event(),'created':time.time()}
        def execute():
            item=self.items[identifier]
            def progress(percent,message):
                with self.lock:item.update(state='running',percent=percent,message=message)
            try:
                if item['cancel'].is_set():raise RuntimeError('Đã dừng tác vụ.')
                progress(1,'Đang chuẩn bị model...')
                result=run(progress,item['cancel'].is_set)
                with self.lock:
                    if item['cancel'].is_set():item.update(state='cancelled',message='Đã dừng tác vụ.')
                    else:item.update(state='done',percent=100,message='Hoàn thành',result=result)
            except Exception as exc:
                import logging
                logging.exception('Background task failed')
                with self.lock:item.update(state='cancelled' if item['cancel'].is_set() else 'error',message=str(exc),error=str(exc))
        self.executor.submit(execute)
        return {'jobId':identifier,'reused':False}

    def get(self,identifier):
        with self.lock:
            if identifier not in self.items:raise KeyError(identifier)
            return {k:v for k,v in self.items[identifier].items() if k not in ('cancel','signature')}

    def cancel(self,identifier):
        with self.lock:
            if identifier not in self.items:raise KeyError(identifier)
            self.items[identifier]['cancel'].set()

JOBS=Jobs()
