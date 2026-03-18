"""
Fully local voice assistant — no API keys required.
Uses Whisper (STT), pyttsx3 (TTS), and simple local logic.
No ffmpeg required — audio is loaded with the standard library.
"""

import os
import tempfile
import time
import sys
import wave

import numpy as np
import speech_recognition as sr
import pyttsx3

# Whisper expects mono float32 at 16 kHz
WHISPER_SAMPLE_RATE = 16000

# Optional: load .env only if you add future API keys
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

USER_NAME = "Sai"
SCHEDULE = "Daily stand-up meeting at 10:00; Gym at 16:00"

# Lazy-load Whisper (heavy) only when needed
_whisper_model = None

def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        try:
            import whisper
            print("Loading Whisper model (first run may download ~150MB)...")
            _whisper_model = whisper.load_model("base")
        except ImportError:
            print("Install Whisper: pip install openai-whisper")
            sys.exit(1)
    return _whisper_model

def listen(recognizer, source):
    """Listen to the microphone until the user stops speaking."""
    try:
        print("\nListening... (speak now)")
        audio = recognizer.listen(source, timeout=10, phrase_time_limit=15)
        return audio
    except sr.WaitTimeoutError:
        return None
    except sr.UnknownValueError:
        return None

def load_wav_to_whisper_format(path: str) -> np.ndarray:
    """Load a WAV file to mono float32 at 16 kHz (no ffmpeg)."""
    with wave.open(path, "rb") as wav:
        nch = wav.getnchannels()
        sampwidth = wav.getsampwidth()
        rate = wav.getframerate()
        frames = wav.readframes(wav.getnframes())
    # raw bytes -> int16
    if sampwidth == 2:  # 16-bit
        pcm = np.frombuffer(frames, dtype=np.int16)
    else:
        raise ValueError(f"Unsupported WAV sample width: {sampwidth}")
    if nch == 2:
        pcm = pcm[::2]  # take left channel
    elif nch != 1:
        pcm = pcm.reshape(-1, nch).mean(axis=1).astype(np.int16)
    # int16 -> float32 in [-1, 1]
    audio = pcm.astype(np.float32) / 32768.0
    # resample to 16 kHz if needed
    if rate != WHISPER_SAMPLE_RATE:
        duration = len(audio) / rate
        n_samples = int(duration * WHISPER_SAMPLE_RATE)
        indices = np.linspace(0, len(audio) - 1, num=n_samples)
        audio = np.interp(indices, np.arange(len(audio)), audio).astype(np.float32)
    return audio


def transcribe(audio):
    """Transcribe audio using Whisper (local). No ffmpeg required."""
    if audio is None:
        return ""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(audio.get_wav_data())
        path = f.name
    try:
        return _transcribe_wav_path(path)
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


def transcribe_wav_bytes(wav_bytes: bytes) -> str:
    """Transcribe WAV file bytes (e.g. from browser recording). Returns transcribed text or empty string."""
    if not wav_bytes:
        return ""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(wav_bytes)
        path = f.name
    try:
        return _transcribe_wav_path(path)
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


def _transcribe_wav_path(path: str) -> str:
    """Load WAV from path and run Whisper. Used by transcribe and transcribe_wav_bytes."""
    try:
        model = get_whisper_model()
        audio_array = load_wav_to_whisper_format(path)
        result = model.transcribe(audio_array, fp16=False)
        return (result.get("text") or "").strip()
    except Exception:
        return ""

def get_response(text):
    """Simple local brain: schedule, time, greeting, help."""
    if not text:
        return None
    t = text.lower().strip()
    if not t:
        return None

    if any(w in t for w in ("hello", "hi", "hey")):
        return f"Hello {USER_NAME}, how can I help you today?"
    if any(w in t for w in ("schedule", "today", "agenda", "meetings")):
        return f"Here's your schedule for today: {SCHEDULE}"
    if any(w in t for w in ("time", "clock", "what time")):
        return f"The time is {time.strftime('%I:%M %p', time.localtime())}"
    if any(w in t for w in ("help", "what can you do")):
        return (
            "I can tell you the time, your schedule for today, or just say hello. "
            "Try asking: What's my schedule? What time is it?"
        )
    if any(w in t for w in ("bye", "quit", "exit", "stop")):
        return "Goodbye! Have a great day."

    return f"I'm a simple local assistant. I can tell you the time, your schedule, or say hello. You said: {text}"

def speak(engine, text):
    """Speak text using pyttsx3 (local TTS)."""
    if not text:
        return
    print(f"Assistant: {text}")
    engine.say(text)
    engine.runAndWait()

def main():
    print("Local voice assistant — no API keys needed.")
    print("Say 'schedule', 'time', 'hello', or 'help'. Say 'bye' to exit.\n")

    recognizer = sr.Recognizer()
    engine = pyttsx3.init()
    engine.setProperty("rate", 160)

    with sr.Microphone() as source:
        recognizer.adjust_for_ambient_noise(source, duration=0.5)
        while True:
            audio = listen(recognizer, source)
            if audio is None:
                continue
            text = transcribe(audio)
            if not text:
                continue
            print(f"You: {text}")
            if any(w in text.lower() for w in ("bye", "quit", "exit", "stop")):
                speak(engine, get_response(text))
                break
            response = get_response(text)
            if response:
                speak(engine, response)

if __name__ == "__main__":
    main()
