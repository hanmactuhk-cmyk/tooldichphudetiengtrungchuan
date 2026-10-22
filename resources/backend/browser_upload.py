"""Select a file in same-machine Chrome using its native CDP file path API.

Do not serialize the video into Playwright payloads: remote-CDP connections cap
those transfers at 50 MB even when Chrome and the worker run on this same PC.
"""
from pathlib import Path
import uuid

def attach_local_file(page,locator,source,allow_cleared=False):
    path=Path(source).resolve(strict=True)
    if not path.is_file():raise ValueError('Không tìm thấy tệp video để tải lên Chrome.')
    expected=path.stat().st_size
    handle=locator.element_handle()
    if handle is None:raise ValueError('Khung tải video trên Gemini đã thay đổi. Hãy thử lại.')
    token=uuid.uuid4().hex
    session=None
    try:
        handle.evaluate('(input, token) => input.setAttribute("data-hn-local-upload", token)',token)
        session=page.context.new_cdp_session(page)
        root=session.send('DOM.getDocument',{'depth':0})['root']['nodeId']
        node=session.send('DOM.querySelector',{'nodeId':root,'selector':f'input[data-hn-local-upload="{token}"]'})['nodeId']
        if not node:raise ValueError('Không tìm thấy ô chọn video của Gemini.')
        # Only a local path crosses CDP. Chrome reads every byte from disk itself.
        session.send('DOM.setFileInputFiles',{'nodeId':node,'files':[str(path)]})
        files=handle.evaluate('(input) => Array.from(input.files || []).map(f => ({name:f.name, size:f.size}))')
        if not files and allow_cleared:
            # ChatGPT clears input.value in its change handler. Its attachment card
            # must be verified by the caller before sending.
            return {'name':path.name,'size':expected,'inputCleared':True}
        if len(files)!=1 or files[0]['size']!=expected or files[0]['name']!=path.name:
            raise ValueError('Chrome chưa chọn đúng toàn bộ tệp video. Chưa gửi yêu cầu Gemini.')
        return files[0]
    finally:
        try:handle.evaluate('(input) => input.removeAttribute("data-hn-local-upload")')
        except Exception:pass
        if session is not None:
            try:session.detach()
            except Exception:pass

# Existing Gemini callers retain strict name/size verification.
attach_local_video=attach_local_file
