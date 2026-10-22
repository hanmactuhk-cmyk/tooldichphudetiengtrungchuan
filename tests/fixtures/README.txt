Test fixtures created for this repair:
- video-tieng-trung.mp4: synthetic Mandarin speech (Microsoft Xiaoxiao), generated from the sentence: 你好，欢迎来到我们的小镇。今天的天气很好，我们一起去公园散步吧。 It has audio and no burned-in text.
- video-phu-de-chu-trung.mp4: three synthetic frames with Chinese text rendered on the lower portion of the video: 今天天气很好。 / 我们一起去公园散步吧。 / 请记得带上雨伞。 It has no speech.
These fixtures are functional checks, not benchmarks on real film footage.

Run after starting worker:
python scripts/smoke_test.py --url http://127.0.0.1:8001 --fixtures tests/fixtures --out test-results

- clone-reference.wav: 6-second synthetic Vietnamese voice generated during the local TTS repair checks, looped only to exercise reference enrollment. It is not a recording of the user. Used by clone/popup UI checks.
