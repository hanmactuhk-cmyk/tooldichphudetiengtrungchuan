import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'resources/backend'))
from smart_speech import allocate_groups,measured_speech

class FakeDubbing:
 def __init__(self):self.calls=[]
 def synthesize(self,text,*args):return {'audioUrl':'/cache/raw.wav','duration':float(text)}
 def fit_to_slot(self,clip,slot,max_speed=12):
  rate=max(1,clip['duration']/slot)
  if rate>max_speed+1e-8:raise ValueError('vượt tốc độ')
  self.calls.append(rate);return {**clip,'duration':clip['duration']/rate,'fitSpeed':rate}

def cues():return [dict(id=str(i),textVi=str(d),startTime=a,endTime=b,smartGroupId='g',smartSourceId='root',smartGroupCount=2,smartGroupStart=10,smartGroupEnd=19,smartMaxSpeed=1.2) for i,(d,a,b) in enumerate([(7,10,14.5),(3,14.5,19)])]
class Tests(unittest.TestCase):
 def test_measure_reallocate_and_cap(self):
  dub=FakeDubbing();result=measured_speech(cues(),dub,lambda *a:None,lambda:False)
  self.assertEqual(result[0][0]['startTime'],10);self.assertEqual(result[-1][0]['endTime'],19)
  self.assertEqual(result[0][0]['endTime'],result[1][0]['startTime']);self.assertTrue(all(r<=1.2 for r in dub.calls))
  self.assertTrue(result[0][0]['endTime']>14.5)
 def test_impossible_keeps_content(self):
  source=cues();source[0]['textVi']='20'
  with self.assertRaisesRegex(ValueError,'Cần xử lý thời lượng'):measured_speech(source,FakeDubbing(),lambda *a:None,lambda:False)
  self.assertEqual(source[0]['textVi'],'20');self.assertEqual(source[0]['endTime'],14.5)
 def test_single_cannot_take_sibling_slot(self):
  with self.assertRaisesRegex(ValueError,'Cần xử lý thời lượng'):measured_speech(cues()[:1],FakeDubbing(),lambda *a:None,lambda:False)
 def test_no_overlap_with_other_group(self):
  source=cues()+[dict(id='other',textVi='1',startTime=18,endTime=20)]
  with self.assertRaisesRegex(ValueError,'chồng'):allocate_groups(source,[{'duration':1}]*3)
if __name__=='__main__':unittest.main()
