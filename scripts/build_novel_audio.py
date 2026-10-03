"""Generate cached Japanese narration and align service word timings to source sentences.

Run node scripts/prepare_novel_audio.mjs first. Requires edge-tts and imageio-ffmpeg.
Only this build step uses the online speech service; the site serves ordinary MP3s.
"""
import asyncio
import hashlib
import html
import json
from pathlib import Path
import subprocess
import wave

import edge_tts
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / '.novel-audio-cache'
OUT = ROOT / 'public' / 'novel-audio'
VOICE = 'ja-JP-KeitaNeural'
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

def run(*args):
    subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', *map(str, args)], check=True)

def publish(source, destination):
    """Keep unchanged files intact; publish changed recordings atomically."""
    data = source.read_bytes()
    if destination.exists() and destination.read_bytes() == data:
        return
    staging = destination.with_suffix('.tmp')
    staging.write_bytes(data)
    staging.replace(destination)

async def build(chapter):
    text = '\n'.join(s['text'] for s in chapter['sentences'])
    digest = hashlib.sha256((VOICE + text).encode()).hexdigest()
    stem = f"chapter-{chapter['id']:02}"
    mp3, metadata = CACHE / f'{stem}.mp3', CACHE / f'{stem}.json'
    if not mp3.exists() or not metadata.exists() or json.loads(metadata.read_text(encoding='utf8'))['digest'] != digest:
        metadata.unlink(missing_ok=True)
        for attempt in range(3):
            try:
                words = []
                with mp3.open('wb') as audio:
                    async for chunk in edge_tts.Communicate(text, VOICE, boundary='WordBoundary').stream():
                        if chunk['type'] == 'audio':
                            audio.write(chunk['data'])
                        elif chunk['type'] == 'WordBoundary':
                            words.append({k: chunk[k] for k in ['text', 'offset', 'duration']})
                metadata.write_text(json.dumps({'digest': digest, 'words': words}, ensure_ascii=False), encoding='utf8')
                break
            except Exception:
                if attempt == 2:
                    raise
                await asyncio.sleep(2 * (attempt + 1))
    words = json.loads(metadata.read_text(encoding='utf8'))['words']
    # Decode the original service MP3 once, so measured duration is the exact PCM
    # duration used for both chapter encodings and the complete audiobook.
    wav = CACHE / f'{stem}.wav'
    run('-i', mp3, '-ar', '24000', '-ac', '1', wav)
    with wave.open(str(wav)) as pcm:
        duration = pcm.getnframes() / pcm.getframerate()
    cursor = 0
    aligned = []
    for word in words:
        spoken = html.unescape(word['text'])
        position = text.find(spoken, cursor)
        if position < 0:
            raise ValueError(f"Unmatched timing in {stem}: {spoken!r} after {cursor}")
        # Gaps should contain only unspoken punctuation/whitespace, never prose.
        gap = text[cursor:position]
        if any(c.isalnum() for c in gap):
            raise ValueError(f"Unspoken prose in {stem}: {gap!r}")
        aligned.append((position, position + len(spoken), word['offset'] / 1e7, (word['offset'] + word['duration']) / 1e7))
        cursor = position + len(spoken)
    if any(c.isalnum() for c in text[cursor:]):
        raise ValueError(f'Incomplete narration for {stem}')
    timings = []
    offset = 0
    for sentence in chapter['sentences']:
        end = offset + len(sentence['text'])
        matches = [word for word in aligned if word[0] < end and word[1] > offset]
        if not matches:
            raise ValueError(f"Missing sentence audio: {sentence['id']}")
        timings.append({**sentence, 'start': round(matches[0][2], 4), 'end': round(matches[-1][3], 4)})
        offset = end + 1  # newline separator
    if timings[-1]['end'] > duration + 0.15:
        raise ValueError(f'Timing exceeds audio length in {stem}')
    encoded = CACHE / f'{stem}-encoded.mp3'
    run('-i', wav, '-c:a', 'libmp3lame', '-b:a', '64k', encoded)
    publish(encoded, OUT / f'{stem}.mp3')
    print(f"Chapter {chapter['id']:02}: {len(timings)} sentences, {duration:.1f} seconds", flush=True)
    return {'id': chapter['id'], 'src': f'/novel-audio/{stem}.mp3', 'duration': round(duration, 4), 'sentences': timings}

async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    chapters = json.loads((CACHE / 'input.json').read_text(encoding='utf8'))
    # Bounded concurrency; gather preserves chapter order regardless of completion.
    semaphore = asyncio.Semaphore(4)
    async def bounded(chapter):
        async with semaphore:
            return await build(chapter)
    result = await asyncio.gather(*(bounded(chapter) for chapter in chapters))
    concat = CACHE / 'concat.txt'
    wav_paths = [CACHE / ('chapter-%02d.wav' % c['id']) for c in chapters]
    concat.write_text('\n'.join("file '%s'" % p.as_posix() for p in wav_paths), encoding='utf8')
    complete = CACHE / 'complete-encoded.mp3'
    run('-f', 'concat', '-safe', '0', '-i', concat, '-c:a', 'libmp3lame', '-b:a', '64k', complete)
    publish(complete, OUT / 'complete-novel.mp3')
    (ROOT / 'src/data/novel-audio.json').write_text(json.dumps({'voice': VOICE, 'fullSrc': '/novel-audio/complete-novel.mp3', 'chapters': result}, ensure_ascii=False, indent=2), encoding='utf8')
    print('All chapter MP3s, complete audiobook, and sentence timeline generated.', flush=True)

asyncio.run(main())
