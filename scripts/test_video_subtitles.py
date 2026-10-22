import sys,unittest,threading,time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'resources/backend'))
from video_subtitles import source_cues,merge_cues
from jobs import Jobs
from subtitle_contract import parse_srt
class VideoSubtitleTests(unittest.TestCase):
 def test_web_code_widget_tail(self):
  raw='1\n00:00:00,000 --> 00:00:01,000\nXin chào.\n```<ElicitationsGroup>\n</ElicitationsGroup>'
  self.assertEqual(parse_srt(raw)[0]['textVi'],'Xin chào.')
  self.assertEqual(parse_srt('```srt\n'+raw)[0]['textVi'],'Xin chào.')
 def test_offsets_and_bounds(self):
  rows=source_cues('```srt\n1\n00:00:00,500 --> 00:00:01,800\n你好。\n```',2,239)
  self.assertEqual(rows[0]['startTime'],239.5);self.assertEqual(rows[0]['endTime'],240.8)
  for text in ['1\n00:00:02,000 --> 00:00:03,000\n你好','2\n00:00:00,000 --> 00:00:01,000\n你好','KHONG_CO_PHU_DE']:
   with self.assertRaises(ValueError):source_cues(text,2)
 def test_overlap_dedup(self):
  first=source_cues('1\n00:00:01,000 --> 00:00:02,000\n你好',3)
  other=source_cues('1\n00:00:00,000 --> 00:00:01,000\n你好',2,1.5)
  result=merge_cues(first,other);self.assertEqual(len(result),1);self.assertEqual(result[0]['endTime'],2.5)
 def test_cancelled_queued_upload_cleanup(self):
  jobs=Jobs();gate=threading.Event();started=threading.Event();cleaned=threading.Event()
  a=jobs.submit('block',{},lambda *_:(started.set(),gate.wait(5)))
  self.assertTrue(started.wait(2))
  b=jobs.submit('upload',{},lambda *_:self.fail('Cancelled upload must not run'),cleanup=cleaned.set)
  jobs.cancel(b['jobId']);gate.set();self.assertTrue(cleaned.wait(3));self.assertEqual(jobs.get(b['jobId'])['state'],'cancelled');jobs.executor.shutdown(wait=True)
if __name__=='__main__':unittest.main()
