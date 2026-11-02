import argparse
import copy
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from unittest.mock import patch

KIT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('short', KIT/'short.py')
short = importlib.util.module_from_spec(spec)
spec.loader.exec_module(short)


class ContractTests(unittest.TestCase):
    def setUp(self):
        self.p = short.load(KIT/'examples/genghis/project.json')
        self.p['audio']['assets'] = str(KIT.parent/'assets/sfx/catalog.json')
        self.base = KIT/'examples/genghis'

    def errors(self):
        return short.validate(self.p, self.base)[0]

    def test_original_long_biography_is_preserved(self):
        self.assertEqual(self.errors(), [])
        self.assertEqual(self.p['durationInFrames'], 3499)

    def test_contacts_need_sound_or_deliberate_silence(self):
        event = next(event for event in self.p['events'] if event['id'] == 'drink')
        event['sound'] = None
        self.assertTrue(any('silenceReason' in error for error in self.errors()))
        event['silenceReason'] = 'Dramatic silence chosen in storyboard'
        self.assertFalse(any('silenceReason' in error for error in self.errors()))

    def test_timing_change_cannot_silently_leave_events_behind(self):
        self.p['shots'][1]['start'] += 10
        self.assertTrue(any('gap/overlap' in error for error in self.errors()))
        self.p['events'][0]['frame'] = 3499
        self.assertTrue(any('outside composition' in error for error in self.errors()))

    def test_unknown_assets_and_duplicate_events_fail(self):
        self.p['events'][0]['sound']['asset'] = 'imaginary'
        self.p['events'].append(copy.deepcopy(self.p['events'][0]))
        errors = self.errors()
        self.assertTrue(any('unknown sound' in error for error in errors))
        self.assertTrue(any('duplicate' in error for error in errors))

    def test_voice_requires_original_hash_and_duration(self):
        self.p['audio']['voice'] = {'path': 'absent.wav', 'sha256': '0'*64, 'durationSeconds': 12}
        errors = self.errors()
        self.assertTrue(any('ceil' in error for error in errors))
        self.assertTrue(any('missing original narration' in error for error in errors))

    def test_source_only_does_not_mark_reviews_passed(self):
        _, warnings = short.validate(self.p, self.base, False)
        self.assertIn('visual review: pending', warnings)
        self.assertIn('audio review: pending', warnings)

    def test_malformed_nested_values_report_errors_instead_of_crashing(self):
        mutations = [
            lambda p: p.update(audio=4), lambda p: p.update(shots=[None]),
            lambda p: p.update(events=[7]), lambda p: p.update(review=None),
            lambda p: p.update(script=[]), lambda p: p['shots'][0].update(id=[]),
            lambda p: p['events'][0].update(id={}),
            lambda p: p['events'][0].update(sound=[]),
            lambda p: p['audio'].update(voice=[]),
        ]
        baseline = copy.deepcopy(self.p)
        for mutate in mutations:
            with self.subTest(mutation=mutate):
                self.p = copy.deepcopy(baseline)
                mutate(self.p)
                self.assertTrue(self.errors())
        self.assertTrue(short.validate([], self.base)[0])

    def test_gain_types_unknown_fields_and_unity_voice_are_checked(self):
        baseline = copy.deepcopy(self.p)
        for value in [True, 'loud', float('nan'), float('inf'), 25]:
            self.p = copy.deepcopy(baseline)
            self.p['events'][0]['sound']['gainDb'] = value
            self.assertTrue(self.errors(), value)
        self.p = copy.deepcopy(baseline)
        self.p['mix']['voiceGainDb'] = -6
        self.assertTrue(any('unknown property' in error for error in self.errors()))
        self.p = copy.deepcopy(baseline)
        self.p['audio']['voice'] = {'path': 'voice.wav', 'sha256': '0'*64,
                                   'durationSeconds': 3499/30, 'gainDb': -6}
        self.assertTrue(any('unknown property' in error for error in self.errors()))

    def test_music_requires_frozen_hash_and_existing_file(self):
        self.p['audio']['music'] = {'path': 'missing.wav'}
        self.assertTrue(any('sha256' in error for error in self.errors()))
        self.p['audio']['music']['sha256'] = '0'*64
        self.assertTrue(any('missing music' in error for error in self.errors()))
        with tempfile.TemporaryDirectory() as directory:
            music = Path(directory)/'music.wav'; music.write_bytes(b'changed music bytes')
            self.p['audio']['music']['path'] = str(music)
            self.assertTrue(any('music hash changed' in error for error in self.errors()))

    def test_catalog_list_aliases_work_and_malformed_aliases_fail(self):
        with tempfile.TemporaryDirectory() as directory:
            catalog = Path(directory)/'catalog.json'
            short.save(catalog, {'version': 1, 'assets': {'tone': {}},
                                 'aliases': {'chosen': ['tone']}})
            self.p['audio']['assets'] = str(catalog)
            self.p['events'] = [self.p['events'][0]]
            self.p['events'][0]['sound']['asset'] = 'chosen'
            self.assertEqual(self.errors(), [])
            short.save(catalog, {'version': 1, 'assets': {'tone': {}},
                                 'aliases': {'chosen': [{'bad': 'shape'}]}})
            self.assertTrue(any('broken sound alias' in error for error in self.errors()))
            catalog.write_text('[]')
            self.assertTrue(any('invalid sound catalog' in error for error in self.errors()))

    def test_malformed_cli_input_is_actionable_without_traceback(self):
        with tempfile.TemporaryDirectory() as directory:
            project = Path(directory)/'project.json'
            project.write_text(json.dumps({'audio': 4}))
            result = subprocess.run([sys.executable, str(KIT/'short.py'), 'check', str(project)],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 1)
            self.assertIn('ERROR:', result.stderr)
            self.assertNotIn('Traceback', result.stderr)


    def test_audio_readiness_rejects_stale_cache_and_unsynced_tracks(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory); project = base/'project.json'
            report = base/'public/audio/mix-report.json'
            report.parent.mkdir(parents=True)
            short.save(report, {'outputs': {name+'.wav': '0'*64 for name in ['voice','music','foley','accents','reactions','ambience']}})
            short.save(base/'audio-tracks.json', [])
            with patch.object(short.subprocess, 'run', side_effect=subprocess.CalledProcessError(1, 'mix')):
                with self.assertRaises(subprocess.CalledProcessError):
                    short.check_audio_readiness(project)
            with patch.object(short.subprocess, 'run'):
                with self.assertRaisesRegex(ValueError, 'run sync'):
                    short.check_audio_readiness(project)
                tracks = [{'name': name, 'path': f'audio/{name}.wav', 'version': '0'*64} for name in
                          ['voice', 'music', 'foley', 'accents', 'reactions', 'ambience']]
                short.save(base/'audio-tracks.json', tracks)
                short.check_audio_readiness(project)
                tracks[0]['version']='1'*64
                short.save(base/'audio-tracks.json',tracks)
                with self.assertRaisesRegex(ValueError,'versions'):
                    short.check_audio_readiness(project)
                report.unlink()
                with self.assertRaisesRegex(ValueError, 'no mix report'):
                    short.check_audio_readiness(project)


class InitTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.target = self.base/'project'

    def args(self, **overrides):
        values = dict(target=str(self.target), name='TestShort', example='starter',
                      voice=None, fps=30, duration=12)
        values.update(overrides)
        return argparse.Namespace(**values)

    def test_bad_voice_or_incompatible_example_does_not_leave_partial_project(self):
        with self.assertRaisesRegex(ValueError, 'Missing original narration'):
            short.init(self.args(voice=str(self.base/'missing.wav')))
        self.assertFalse(self.target.exists())
        voice = self.base/'voice.wav'; voice.write_bytes(b'fixture bytes')
        with patch.object(short, 'probe', return_value=1):
            with self.assertRaisesRegex(ValueError, 'original recording length'):
                short.init(self.args(example='genghis', voice=str(voice)))
        self.assertFalse(self.target.exists())

    def test_failed_final_validation_leaves_existing_empty_target_untouched(self):
        self.target.mkdir()
        with patch.object(short, 'validate', return_value=(['Missing required asset'], [])):
            with self.assertRaisesRegex(ValueError, 'Missing required asset'):
                short.init(self.args())
        self.assertTrue(self.target.is_dir())
        self.assertEqual(list(self.target.iterdir()), [])
        self.assertEqual(list(self.base.glob('.cartoon-init-*')), [])

    def test_short_voice_has_ordered_in_range_action_marks_and_original_hash(self):
        voice = self.base/'voice.wav'; voice.write_bytes(b'fixture bytes')
        with patch.object(short, 'probe', return_value=.09), redirect_stdout(StringIO()):
            short.init(self.args(voice=str(voice)))
        project = short.load(self.target/'project.json')
        self.assertEqual(project['durationInFrames'], 3)
        self.assertEqual([event['frame'] for event in project['events']], [0, 1, 2])
        self.assertEqual(project['audio']['voice']['sha256'], short.sha(voice))
        self.assertTrue((self.target/'src/cast.ts').is_file())
        self.assertTrue((self.target/'src/look/shade.ts').is_file())

    def test_voice_too_short_for_three_distinct_marks_is_rejected_without_writes(self):
        voice = self.base/'voice.wav'; voice.write_bytes(b'fixture bytes')
        with patch.object(short, 'probe', return_value=.01):
            with self.assertRaisesRegex(ValueError, 'at least 3 frames'):
                short.init(self.args(voice=str(voice)))
        self.assertFalse(self.target.exists())

    def test_existing_project_is_never_overwritten(self):
        self.target.mkdir(); marker = self.target/'keep.txt'; marker.write_text('accepted work')
        with self.assertRaisesRegex(ValueError, 'never overwritten'):
            short.init(self.args())
        self.assertEqual(marker.read_text(), 'accepted work')


if __name__ == '__main__':
    unittest.main()
