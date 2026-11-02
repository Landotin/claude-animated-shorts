#!/usr/bin/env python3
"""Portable project setup and preflight. Never renders a movie or a still."""
import argparse
import hashlib
import json
import math
import shutil
import re
import tempfile
import subprocess
import sys
from pathlib import Path

KIT = Path(__file__).resolve().parent
STATUSES = {'pending', 'passed', 'failed', 'unavailable'}
BUSES = {'foley', 'accents', 'reactions', 'ambience'}

def load(path):
    return json.loads(Path(path).read_text(encoding='utf-8'), parse_constant=lambda value: (_ for _ in ()).throw(ValueError(f'Non-finite JSON number: {value}')))

def save(path, data):
    Path(path).write_text(json.dumps(data, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def probe(path):
    data = json.loads(subprocess.check_output(
        ['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries',
         'stream=codec_type:format=duration', '-of', 'json', str(path)], text=True,
        stderr=subprocess.PIPE))
    if not data.get('streams'):
        raise ValueError(f'No audio stream: {path}')
    duration = float(data.get('format', {}).get('duration', 0))
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError(f'Cannot determine a positive audio duration: {path}')
    return duration


def schema_errors(value, schema, label='project'):
    """Validate the JSON Schema keywords used by this kit, without a dependency."""
    errors = []
    if 'oneOf' in schema:
        variants = [schema_errors(value, option, label) for option in schema['oneOf']]
        if sum(not messages for messages in variants) != 1:
            # The non-null branch gives more useful property errors for an object.
            messages = next((messages for option, messages in zip(schema['oneOf'], variants)
                             if option.get('type') == 'object' and isinstance(value, dict)), [])
            return messages or [f'{label}: does not match an allowed value/type']
        return []
    kind = schema.get('type')
    number = isinstance(value, (int, float)) and not isinstance(value, bool) and (isinstance(value, int) or math.isfinite(value))
    matches = {'object': isinstance(value, dict), 'array': isinstance(value, list),
               'string': isinstance(value, str), 'boolean': isinstance(value, bool),
               'integer': isinstance(value, int) and not isinstance(value, bool),
               'number': number, 'null': value is None}
    if kind and not matches.get(kind, False):
        return [f'{label}: must be {kind}']
    if 'const' in schema and value != schema['const']:
        errors.append(f'{label}: must be {schema["const"]!r}')
    if 'enum' in schema and value not in schema['enum']:
        errors.append(f'{label}: must be one of {schema["enum"]}')
    if isinstance(value, dict):
        for key in schema.get('required', []):
            if key not in value:
                errors.append(f'{label}.{key}: required')
        properties = schema.get('properties', {})
        for key, item in value.items():
            if key in properties:
                errors.extend(schema_errors(item, properties[key], f'{label}.{key}'))
            elif schema.get('additionalProperties') is False:
                errors.append(f'{label}.{key}: unknown property')
    if isinstance(value, list):
        if len(value) < schema.get('minItems', 0):
            errors.append(f'{label}: needs at least {schema["minItems"]} item(s)')
        if len(value) > schema.get('maxItems', len(value)):
            errors.append(f'{label}: allows at most {schema["maxItems"]} item(s)')
        for index, item in enumerate(value):
            errors.extend(schema_errors(item, schema.get('items', {}), f'{label}[{index}]'))
    if isinstance(value, str):
        if len(value) < schema.get('minLength', 0):
            errors.append(f'{label}: must not be empty')
        if 'pattern' in schema and not re.search(schema['pattern'], value):
            errors.append(f'{label}: invalid format')
    if number:
        for key, valid in [('minimum', lambda bound: value >= bound),
                           ('maximum', lambda bound: value <= bound),
                           ('exclusiveMinimum', lambda bound: value > bound)]:
            if key in schema and not valid(schema[key]):
                errors.append(f'{label}: violates {key} {schema[key]}')
    return errors

def validate(project, base, media=True):
    errors = schema_errors(project, load(KIT/'project.schema.json'))
    warnings = []
    if errors:
        return errors, warnings
    base = Path(base)
    def need(ok, msg):
        if not ok: errors.append(msg)
    total, fps = project['durationInFrames'], project['fps']
    shots = project['shots']; ids = set(); by_id = {}; cursor = 0
    for shot in shots:
        sid = shot['id']
        need(sid not in ids, f'duplicate shot id: {sid}')
        ids.add(sid); by_id[sid] = shot
        a, b = shot['start'], shot['end']
        need(a == cursor, f'{sid}: shot gap/overlap at frame {cursor}')
        need(a < b <= total, f'{sid}: invalid shot range')
        cursor = b
    need(cursor == total, 'shots must cover the exact composition duration')
    events = project['events']; event_ids = set()
    for event in events:
        eid, frame = event['id'], event['frame']
        need(eid not in event_ids, f'duplicate event id: {eid}')
        event_ids.add(eid)
        need(0 <= frame < total, f'{eid}: event outside composition')
        shot = by_id.get(event['shot'])
        need(shot is not None, f'{eid}: missing shot')
        if shot:
            need(shot['start'] <= frame < shot['end'], f'{eid}: event outside its shot')
        if event['type'] in ['contact', 'reaction', 'transform']:
            need(bool(event.get('visual')), f'{eid}: describe visible evidence')
            if event.get('sound') is None:
                need(bool(event.get('silenceReason')), f'{eid}: supply sound or a deliberate silenceReason')
        sound = event.get('sound')
        if sound is not None:
            need(0 <= sound.get('peakFrame', frame) < total, f'{eid}: peakFrame outside composition')
            if 'durationSeconds' in sound:
                need(sound['durationSeconds'] <= total/fps, f'{eid}: sound duration exceeds composition')
    if 'endFadeSeconds' in project['mix']:
        need(project['mix']['endFadeSeconds'] <= total/fps, 'mix.endFadeSeconds exceeds composition')
    audio = project['audio']
    voice = audio.get('voice')
    if voice:
        duration = voice['durationSeconds']
        voice_frames = duration*fps
        if isinstance(voice_frames, float) and not math.isfinite(voice_frames):
            errors.append('voice duration is too large to convert to frames')
        else:
            need(total == math.ceil(voice_frames), 'durationInFrames must be ceil(original voice duration × fps)')
    else:
        warnings.append('No narration supplied; this is an action study, not a completed narrated film.')
    for kind in ['voice', 'music']:
        item = audio.get(kind)
        if item is None:
            continue
        path = base/item['path']
        if media:
            need(path.is_file(), f'missing original narration: {path}' if kind == 'voice' else f'missing music: {path}')
            if path.is_file():
                need(sha(path) == item['sha256'], f'original {kind} hash changed')
                if 'durationSeconds' in item and shutil.which('ffprobe'):
                    try:
                        need(abs(probe(path)-item['durationSeconds']) < 1/fps, f'recorded {kind} duration differs from contract')
                    except (subprocess.CalledProcessError, ValueError, TypeError, OSError):
                        errors.append(f'cannot read {kind} duration')
    script = project.get('script', {})
    if script.get('path'):
        path = base/script['path']
        need(path.is_file(), f'missing script: {path}')
        if path.is_file() and script.get('sha256'):
            need(sha(path) == script['sha256'], 'script changed: realign words and events')
    for kind in ['technical', 'visual', 'audio']:
        value = project['review'][kind]
        if value != 'passed': warnings.append(f'{kind} review: {value}')
    catalog_path = audio.get('assets')
    if catalog_path:
        path = base/catalog_path
        need(path.is_file(), f'missing sound catalog: {path}')
        if path.is_file():
            try:
                catalog = load(path)
                if not isinstance(catalog, dict) or catalog.get('version') != 1:
                    raise ValueError('catalog must be an object with version: 1')
                assets, aliases = catalog.get('assets'), catalog.get('aliases', {})
                if not isinstance(assets, dict) or not isinstance(aliases, dict):
                    raise ValueError('catalog assets and aliases must be objects')
                for alias, choices in aliases.items():
                    if not isinstance(choices, list) or not choices or not all(isinstance(choice, str) and choice in assets for choice in choices):
                        errors.append(f'broken sound alias: {alias}')
                for event in events:
                    sound = event.get('sound')
                    if sound is not None:
                        aid = sound['asset']
                        need(aid in assets or aid in aliases, f'{event["id"]}: unknown sound asset {aid}')
            except (OSError, ValueError, TypeError) as error:
                errors.append(f'invalid sound catalog: {error}')
    elif any(event.get('sound') is not None for event in events):
        errors.append('audio.assets is required when events have sound')
    return errors, warnings


def init(args):
    dest = Path(args.target).resolve()
    if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_-]*', args.name):
        raise ValueError('Use a composition name beginning with a letter and containing only letters, digits, underscores or hyphens')
    if not isinstance(args.fps, int) or isinstance(args.fps, bool) or not 1 <= args.fps <= 240:
        raise ValueError('Use an integer fps between 1 and 240')
    if not math.isfinite(args.duration) or args.duration < 2:
        raise ValueError('Use a finite study duration of at least 2 seconds')
    if dest.exists() and (not dest.is_dir() or any(dest.iterdir())):
        raise ValueError('Target must be empty; existing projects are never overwritten')
    source_voice = None
    if args.voice:
        source_voice = Path(args.voice).resolve()
        if not source_voice.is_file():
            raise ValueError(f'Missing original narration: {source_voice}')
        voice_duration = probe(source_voice)
    if args.example == 'genghis':
        project = load(KIT/'examples/genghis/project.json')
        if source_voice and math.ceil(voice_duration*project['fps']) != project['durationInFrames']:
            raise ValueError('Genghis example requires its original recording length; use starter for a new voice')
    else:
        frames = math.ceil((voice_duration if source_voice else args.duration)*args.fps)
        if frames < 3:
            raise ValueError('The action study needs at least 3 frames for sip, reaction and drop; choose a longer voice or higher fps')
        project = dict(schemaVersion=1, id=args.name, title=args.name,
                       subject='Action study — replace with approved subject', storyMode='event',
                       fps=args.fps, width=1080, height=1920, durationInFrames=frames,
                       entry='src/index.ts', outputMode='preview', captions=False, language='en',
                       script={'path': 'SCRIPT.md'},
                       audio={'voice': None, 'music': None, 'assets': 'assets/sfx/catalog.json'},
                       mix={'sfxGainDb': -6, 'musicGainDb': 3},
                       style={'preset': 'painted-3d-bean-cards', 'blinkSounds': 'principal-only'},
                       shots=[{'id': 'drink-study', 'name': 'Drink, react, drop — action study', 'start': 0, 'end': frames}],
                       events=[], review={'technical': 'pending', 'visual': 'pending', 'audio': 'pending'}, revisions=[])
    project['id'] = args.name
    project['audio']['assets'] = 'assets/sfx/catalog.json'
    if source_voice:
        project['audio']['voice'] = {'path': 'public/audio/narration'+source_voice.suffix,
                                     'sha256': sha(source_voice), 'durationSeconds': voice_duration}
    if args.example == 'starter':
        n = project['durationInFrames']; sid = project['shots'][0]['id']
        sip = max(0, min(n-3, round(n*.28)))
        react = min(n-2, max(sip+1, round(n*.48)))
        drop = min(n-1, max(react+1, round(n*.64)))
        for eid, frame, kind, visual, asset, bus in [
            ('drink', sip, 'contact', 'Cup meets mouth and father swallows', 'gulp', 'foley'),
            ('sick', react, 'reaction', 'Father turns sick; child reacts', 'effort', 'reactions'),
            ('cup-drop', drop, 'contact', 'Cup lands on ground', 'impact', 'foley')]:
            sound = dict(asset=asset, bus=bus, gainDb=-12)
            if kind == 'contact':
                sound['peakFrame'] = frame
            project['events'].append(dict(id=eid, shot=sid, frame=frame, type=kind, visual=visual, sound=sound))
        for frame in range(59, n, 59):
            project['events'].append(dict(id=f'principal-blink-{frame}', shot=sid, frame=frame, type='blink',
                                         visual='Visible principal eyelids close on the shared 59-frame clock',
                                         sound=dict(asset='blink', bus='accents', gainDb=-18, durationSeconds=.12)))
    # Build beside the destination, then commit only after every copy and contract check passes.
    # A failed voice probe, incompatible example, or missing asset leaves the target untouched.
    dest.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.cartoon-init-', dir=dest.parent) as temp:
        staged = Path(temp)/'project'
        shutil.copytree(KIT/'starter', staged,
                        ignore=shutil.ignore_patterns('node_modules', 'out', '.remotion-tmp', '__pycache__'))
        shutil.copytree(KIT/'runtime', staged/'runtime', ignore=shutil.ignore_patterns('__pycache__'))
        shutil.copytree(KIT.parent/'assets/sfx', staged/'assets/sfx')
        shutil.copytree(KIT/'audio', staged/'.cartoon-kit/audio', ignore=shutil.ignore_patterns('__pycache__'))
        shutil.copy2(__file__, staged/'.cartoon-kit/short.py')
        shutil.copy2(KIT/'project.schema.json', staged/'.cartoon-kit/project.schema.json')
        if args.example == 'genghis':
            shutil.rmtree(staged/'src')
            shutil.copytree(KIT/'examples/genghis/src', staged/'src')
            for file in ['SCRIPT.md', 'BRIEF.md']:
                shutil.copy2(KIT/'examples/genghis'/file, staged/file)
            shutil.copy2(KIT/'starter/src/index.ts', staged/'src/index.ts')
            (staged/'src/Root.tsx').write_text(
                "import React from 'react';\nimport {Composition} from 'remotion';\nimport p from '../project.json';\n"
                "import {GenghisKhanLife} from './film/Film';\n"
                "export const Root=()=> <Composition id={p.id} component={GenghisKhanLife} fps={p.fps} width={p.width} height={p.height} durationInFrames={p.durationInFrames}/>;\n", encoding='utf-8')
        else:
            shutil.copy2(KIT/'examples/genghis/src/film/cast.ts', staged/'src/cast.ts')
            (staged/'src/events.ts').write_text("export * from '../runtime/events';\n", encoding='utf-8')
            shutil.copytree(KIT/'examples/genghis/src/film/look', staged/'src/look')
            (staged/'SCRIPT.md').write_text('# Action study\n\nReplace this with the approved narration before story production.\n', encoding='utf-8')
        if source_voice:
            voice_dest = staged/project['audio']['voice']['path']
            voice_dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source_voice, voice_dest)
        project['script']['sha256'] = sha(staged/project['script']['path'])
        errors, _ = validate(project, staged)
        if errors:
            raise ValueError('Cannot initialize invalid project: '+'; '.join(errors))
        save(staged/'project.json', project)
        save(staged/'audio-tracks.json', [])
        (staged/'.gitignore').write_text('node_modules/\nout/\n.remotion-tmp/\n__pycache__/\npublic/audio/\n*.log\n', encoding='utf-8')
        if dest.exists():
            dest.rmdir()  # Fails safely if another process put files into the target.
        staged.replace(dest)
    print(f'Created {dest}\nInstall in project: npm ci\nBuild audio: python3 .cartoon-kit/audio/mix.py project.json --out public/audio\nSync tracks: python3 .cartoon-kit/short.py sync project.json\nPreview: python3 .cartoon-kit/short.py preview project.json')


def sync(path):
    p=load(path);base=path.parent
    # Audio report/cache is the source of truth; gains are baked into these stems.
    report=base/'public/audio/mix-report.json'
    if not report.is_file():raise ValueError('Build audio first; missing public/audio/mix-report.json')
    mixer=KIT/'audio/mix.py'
    subprocess.run([sys.executable,str(mixer),str(path),'--out',str(base/'public/audio'),'--check-cache'],check=True)
    names=['voice','music','foley','accents','reactions','ambience']
    hashes=load(report)['outputs']
    save(base/'audio-tracks.json',[{'name':n.title()+' · final gain','path':f'audio/{n}.wav','version':hashes[n+'.wav']} for n in names if (base/f'public/audio/{n}.wav').is_file()])
    print('Updated named Remotion tracks at unity gain.')

def check_audio_readiness(path):
    base = path.parent
    report = base/'public/audio/mix-report.json'
    tracks_path = base/'audio-tracks.json'
    tracks = load(tracks_path) if tracks_path.is_file() else []
    if not isinstance(tracks, list) or any(not isinstance(track, dict) or not isinstance(track.get('path'), str) for track in tracks):
        raise ValueError('audio-tracks.json must be a list of named audio tracks; rebuild audio and run sync')
    if not report.is_file():
        if tracks:
            raise ValueError('Audio tracks have no mix report; rebuild audio and run sync before preview')
        print('NOTE: No mixed audio attached. Build audio and sync before reviewing sound.')
        return
    subprocess.run([sys.executable, str(KIT/'audio/mix.py'), str(path), '--out', str(report.parent), '--check-cache'], check=True)
    expected = {f'audio/{name}.wav' for name in ['voice', 'music', 'foley', 'accents', 'reactions', 'ambience']}
    if len(tracks) != len(expected) or {track['path'] for track in tracks} != expected:
        raise ValueError('Audio tracks do not match current stems; run sync before preview')
    hashes=load(report).get('outputs',{})
    if any(track.get('version')!=hashes.get(Path(track['path']).name) or not track.get('version') for track in tracks):
        raise ValueError('Audio track versions do not match current stems; run sync before preview')


def main():
    parser=argparse.ArgumentParser(description=__doc__);sub=parser.add_subparsers(dest='command',required=True)
    a=sub.add_parser('init');a.add_argument('target');a.add_argument('--name',default='CartoonShort');a.add_argument('--example',choices=['starter','genghis'],default='starter');a.add_argument('--voice');a.add_argument('--fps',type=int,default=30);a.add_argument('--duration',type=float,default=12)
    for command in ['check','doctor','preview','sync']:
        a=sub.add_parser(command);a.add_argument('project',type=Path)
        if command=='check':a.add_argument('--structure-only',action='store_true',help='Skip private narration media checks; does not prove media readiness')
        if command=='preview':a.add_argument('--port',type=int,default=3000)
    args=parser.parse_args()
    if args.command=='init':
        init(args);return
    path=args.project.resolve();p=load(path);base=path.parent
    errors,warnings=validate(p,base,not getattr(args,'structure_only',False))
    for w in warnings:print('NOTE:',w)
    for e in errors:print('ERROR:',e,file=sys.stderr)
    if errors:raise ValueError(f'{len(errors)} project check(s) failed')
    if args.command in ['check','preview'] and not getattr(args,'structure_only',False):check_audio_readiness(path)
    if args.command=='check':print('Project structure passed. Watching/listening are separate review steps.');return
    if args.command=='sync':sync(path);return
    if args.command=='doctor':
        missing=[]
        for name in ['node','npm','ffmpeg','ffprobe']:
            found=shutil.which(name);print(f'{name}: {found or "MISSING"}')
            if not found:missing.append(name)
        deps=base/'node_modules/.bin/remotion';print(f'Remotion dependencies: {"installed" if deps.exists() else "run npm ci"}')
        if not deps.exists():missing.append('npm dependencies')
        print('Browser: Remotion-managed Chromium; no fixed OS path. Preview requires working WebGL.')
        if missing:raise ValueError('Missing dependencies: '+', '.join(missing))
        return
    if not 1 <= args.port <= 65535:raise ValueError('Preview port must be 1..65535')
    exe=base/'node_modules/.bin/remotion'
    if not exe.exists():raise ValueError('Run npm ci in the project first')
    print(f'Preview only: http://localhost:{args.port}/{p["id"]}',flush=True)
    subprocess.run([str(exe),'studio',p['entry'],'--port',str(args.port)],cwd=base,check=True)

if __name__=='__main__':
    try:main()
    except (ValueError,KeyError,TypeError,OSError,subprocess.CalledProcessError,json.JSONDecodeError) as e:
        print(f'ERROR: {e}',file=sys.stderr);sys.exit(1)
