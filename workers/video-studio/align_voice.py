"""Local PT-BR word timestamps; no additional TTS request or external audio upload."""
import json
import os
import re
import sys
import unicodedata
from difflib import SequenceMatcher
from num2words import num2words


def tokens(text):
    text = re.sub(r'\d+', lambda m: num2words(int(m.group()), lang='pt_BR'), text.lower())
    words = re.findall(r'[a-z]+', ''.join(c for c in unicodedata.normalize('NFD', text) if not unicodedata.combining(c)))
    # Scripts may stretch a name to guide TTS pronunciation ("Rodriiigueeess").
    # Collapse repeated letters only in those deliberately elongated words.
    return [re.sub(r'(.)\1+', r'\1', word) if re.search(r'(.)\1{2,}', word) else word for word in words]


def scene_boundaries(scripts, words, duration):
    expected, offsets = [], []
    for script in scripts:
        offsets.append(len(expected))
        expected.extend(tokens(script['text']))
    actual, starts, ends = [], [], []
    for word in words:
        for token in tokens(word['word']):
            actual.append(token)
            starts.append(float(word['start']))
            ends.append(float(word['end']))
    matching = SequenceMatcher(None, expected, actual, autojunk=False)
    mapping = {}
    for block in matching.get_matching_blocks():
        for i in range(block.size):
            mapping[block.a + i] = block.b + i
    if not expected or len(mapping) / len(expected) < .65:
        raise ValueError('A fala não corresponde suficientemente ao roteiro para sincronização automática.')
    boundaries = [0.0]
    for i, offset in enumerate(offsets[1:], 1):
        stop = offsets[i + 1] if i + 1 < len(offsets) else len(expected)
        first = [j for j in range(offset, min(stop, offset + 3)) if j in mapping]
        if not first or first[0] - offset > 1:
            raise ValueError('Não foi possível localizar o início de uma oferta na locução.')
        j = mapping[first[0]]
        # A short visual lead is safe only after the previous spoken word ends.
        previous_end = ends[j - 1] if j else 0
        boundary = max(previous_end, starts[j] - .08)
        if not boundaries[-1] + .15 < boundary < duration - .15:
            raise ValueError('A locução não tem tempos válidos para todas as cenas.')
        boundaries.append(round(boundary, 4))
    return boundaries + [duration]


def main():
    from faster_whisper import WhisperModel
    data = json.load(sys.stdin)
    model = WhisperModel(os.getenv('VIDEO_ALIGNMENT_MODEL', 'small'), device='cpu', compute_type='int8', cpu_threads=4)
    segments, _ = model.transcribe(data['file'], language='pt', word_timestamps=True, beam_size=5,
                                  initial_prompt=' '.join(s['text'] for s in data['scripts']),
                                  condition_on_previous_text=False, vad_filter=True)
    words = [{'word': w.word, 'start': w.start, 'end': w.end} for s in segments for w in (s.words or [])]
    result = {'boundaries': scene_boundaries(data['scripts'], words, data['duration']),
              'version': 'words-v1', 'words': words}
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
