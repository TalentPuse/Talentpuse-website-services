# Interview Agent - Voice Integration Roadmap

## Overview

This document outlines the plan for adding **voice input/output capabilities** to the interview agent, allowing users to practice interviews via voice conversation instead of text.

---

## Current State (Text-Only)

```
User ─────────► Interview Agent ─────────► AI (LLM)
 Text Input      (Text Processing)          Text Response
```

## Target State (Voice-Enabled)

```
User ────────► STT Service ────────► Interview Agent ────────► AI (LLM)
Voice           (Transcription)           (Text Processing)          Text Response
Input                                                                      │
                                                                          ▼
                                                                     TTS Service
                                                                        (Voice Synthesis)
                                                                          │
User ◄────────────────────────────────────────────────────────────┘
 Voice Output
```

---

## Phase 1: Voice Input (STT Integration)

### Frontend: Audio Recording

**Component:** `/d/TalentPulse/dashboard/frontend/components/interview/VoiceInput.tsx`

**Features:**
- Microphone button in chat input area
- Audio recording with Web Speech API
- Real-time recording indicator
- Playback before sending
- Auto-stop on silence detection (3 seconds)
- Audio duration display

**Technology:**
```typescript
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'vi-VN';  // Vietnamese
recognition.continuous = true;

recognition.onresult = (event) => {
  const transcript = event.results[event.resultIndex][0].transcript;
  setTranscript(transcript);
};
```

**UI States:**
- `idle` - Not recording
- `recording` - Recording in progress
- `processing` - Transcribing audio
- `ready` - Transcript ready, user can edit or send

### Backend: STT Processing

**New Endpoint:** `POST /api/interview/sessions/{session_id}/messages/audio`

**Request:** `multipart/form-data`
- `audio`: Audio file (WebM, WAV, MP3)
- `format`: Audio format hint (optional)

**Process:**
1. Receive audio file
2. Send to STT service (OpenAI Whisper, Google STT)
3. Get transcription text
4. Save transcript as user message
5. Optionally: Store audio URL in `original_audio_url`
6. Trigger AI response
7. (Future) Generate TTS audio and return `audio_url`

**Response:**
```json
{
  "transcript": "Transcribed text from audio",
  "audio_url": "s3://interview-audios/...",
  "message_id": "uuid",
  "assistant_response": {
    "id": "uuid",
    "role": "assistant",
    "content": "That's a great answer...",
    "timestamp": "2025-05-30T10:05:00Z"
  }
}
```

### STT Options

| Service | Pros | Cons | Cost (2025) |
|---------|------|------|------------|
| **OpenAI Whisper** | Excellent accuracy, cheap | Slower latency | ~$0.006/minute |
| **Google Speech-to-Text** | Fast, accurate | Requires Google Cloud setup | ~$0.024/minute |
| **Azure Speech** | Fast, good for audio | Requires Azure setup | ~$0.015/minute |
| **Web Speech API (Browser)** | Free, no backend needed | Lower accuracy, browser-dependent | Free |

**Recommendation:** Start with **OpenAI Whisper** for accuracy and simplicity.

---

## Phase 2: Voice Output (TTS Integration)

### Frontend: Audio Playback

**Component:** `/d/TalentPulse/dashboard/frontend/components/interview/VoicePlayer.tsx`

**Features:**
- Play/pause controls
- Playback speed adjustment (0.5x, 1.0x, 1.5x, 2.0x)
- Volume control
- Show audio transcript during playback
- Auto-play next message (optional)

**UI:**
```typescript
<audio controls>
  <source src={audioUrl} type="audio/mpeg" />
  Your browser does not support audio.
</audio controls>
```

### Backend: TTS Generation

**Process:**
1. AI returns text response
2. Send to TTS service (ElevenLabs, OpenAI TTS, Google Cloud TTS)
3. Store audio in S3/MinIO
4. Return `audio_url` in SSE event
5. Frontend auto-plays or shows play button

**TTS Options:**

| Service | Voice Quality | Latency | Cost (2025) | Pros |
|---------|---------------|--------|------------|-----|
| **ElevenLabs** | Very Natural | Low-Medium | ~$0.30/1K chars | Best voice quality |
| **OpenAI TTS** | Natural | Low | ~$0.015/1K chars | Simple integration |
| **Google Cloud TTS** | Natural | Low | ~$0.016/1K chars | Many voices |
| **Azure Speech** | Good | Low | ~$0.016/1K chars | Enterprise features |

**Recommendation:** Start with **OpenAI TTS** for simplicity, upgrade to **ElevenLabs** for premium voice.

### Audio Event in SSE

```typescript
// New SSE event type for audio-ready responses
type AudioEvent = {
  type: "audio_ready",
  message: ChatMessage,
  audio_url: string
};

// Alternative: Stream audio chunks as they're generated
type AudioChunkEvent = {
  type: "audio_chunk",
  chunk: string,  // Base64-encoded audio data
  is_final: boolean
};
```

---

## Phase 3: Full Voice Conversation Mode

### Voice-First Interface

**Mode Switch:** Text/Voice toggle button

**Voice Mode UI:**
- Microphone always on (push-to-talk)
- Real-time transcription displayed
- AI voice plays automatically
- Text transcript scrollable below

**Conversation Flow:**
```
User (Push mic) → STT → Transcript → Agent → Text → TTS → Audio → User hears
                    ↓                                              ↓
                Display transcript                            Display audio player
```

### Voice-Only Option

**Future Enhancement:** Pure voice mode (no text visible)

**Use Case:** Mimic real phone/screening interviews

---

## File: Storage and Cleanup

### Audio Storage Strategy

**S3/MinIO Bucket:** `interview-audios`

**Naming Convention:**
```
{user_id}/{session_id}/{message_id}/{type}.{ext}

Examples:
- "a1b2c3d4/5e6f7g8h/9i0j/1k2l/user.webm"         # User's voice input
- "a1b2c3d4/5e6f7g8h/9i0j/1k2l/assistant.mp3"  # AI voice output
```

### Audio Formats

**Input (User Voice):**
- **WebM** (default from MediaRecorder API)
- **WAV** (for better compatibility)
- **MP3** (compressed format)

**Output (AI Voice):**
- **MP3** (most compatible)
- **WebM** (alternative)

### Audio Duration Limits

| Context | Max Duration |
|---------|--------------|
| User message | 5 minutes |
| AI response | 2 minutes |
| Storage | 30 days (auto-delete) |

### Cleanup Job

```python
# Background task to delete old audio files
async def cleanup_old_audio():
    cutoff = datetime.now() - timedelta(days=30)
    
    # Mark for deletion in database
    await db.execute(
        update(InterviewMessage)
        .where(AudioUrl.isnot(None))
        .where(InterviewMessage.created_at < cutoff)
        .values(audio_url=None, original_audio_url=None)
    )
    
    # Delete from S3
    old_files = await s3_client.list_objects_v2(
        Bucket="interview-audios",
        Prefix=f"{user_id}/"
    )
    for obj in old_files['Contents']:
        if obj['LastModified'] < cutoff:
            await s3_client.delete_object(...)
```

---

## Database Schema Changes

### New Columns

**Table:** `interview_messages`

```sql
ALTER TABLE interview_messages
ADD COLUMN audio_url VARCHAR(512) NULL;           -- TTS output for assistant messages
ALTER TABLE interview_messages
ADD COLUMN original_audio_url VARCHAR(512) NULL;   -- STT input for user messages
```

### Migration

```python
# alembic/versions/013_add_interview_audio_columns.py

def upgrade():
    op.add_column('interview_messages', sa.Column('audio_url', sa.String(length=512), nullable=True))
    op.add_column('interview_messages', sa.Column('original_audio_url', sa.String(length=512), nullable=True))

def downgrade():
    op.drop_column('interview_messages', 'audio_url')
    op.drop_column('interview_messages', 'original_audio_url')
```

---

## Frontend Components

### New Files to Create

```
components/interview/
├── VoiceInput.tsx          # Audio recording UI
├── VoicePlayer.tsx         # Audio playback UI
└── VoiceControls.tsx      # Voice mode toggle
```

### Modified Files

```
components/interview/
├── InterviewChatWindow.tsx  # Add voice controls
└── InterviewSession.tsx     # Add voice status indicator
```

### TypeScript Types

```typescript
// lib/interview-api.ts

export interface VoiceMessageRequest {
  audio: Blob;
  format?: 'webm' | 'wav' | 'mp3';
}

export interface VoiceResponse {
  transcript: string;
  audio_url?: string;  // For TTS output
  message_id: string;
  assistant_response: ChatMessage;
}

export interface VoiceStatus {
  mode: 'text' | 'voice' | 'hybrid';
  recording: boolean;
  playing: boolean;
  transcript_available: boolean;
}
```

---

## Backend Implementation

### New Files

```
services/interview_agent/audio/
├── __init__.py
├── stt_service.py          # Speech-to-Text wrapper (Whisper)
├── tts_service.py          # Text-to-Speech wrapper (OpenAI TTS)
└── storage.py              # S3/MinIO audio storage
```

### STT Service (Whisper)

```python
# audio/stt_service.py

import openai

async def transcribe_audio(audio_file: bytes, language: str = "vi") -> str:
    """Transcribe audio using OpenAI Whisper."""
    client = openai.OpenAI()
    
    try:
        response = await client.audio.transcriptions.create(
            model="whisper-1",
            file=(audio_file, "audio.webm"),
            language=language
        )
        return response.text
    finally:
        await client.close()
```

### TTS Service (OpenAI)

```python
# audio/tts_service.py

import openai

async def text_to_speech(text: str, voice: str = "alloy") -> bytes:
    """Convert text to speech using OpenAI TTS."""
    client = openai.OpenAI()
    
    try:
        response = await client.audio.speech.create(
            model="tts-1",
            voice=voice,  # alloy, echo, fable, onyx, nova, shimmer
            input=text
        )
        return response.content
    finally:
        await client.close()
```

---

## Configuration

### Environment Variables

```bash
# Voice Configuration
VOICE_ENABLED=false                    # Enable voice features (default: false)
VOICE_INPUT_ENABLED=false              # Enable STT (default: false)
VOICE_OUTPUT_ENABLED=false             # Enable TTS (default: false)

# STT Configuration
VOICE_STT_SERVICE="openai"           # openai, google, azure, browser
VOICE_STT_MODEL="whisper-1"         # Whisper model
VOICE_STT_LANGUAGE="vi-VN"           # Vietnamese
VOICE_MAX_AUDIO_DURATION_SEC=300   # 5 minutes max

# TTS Configuration
VOICE_TTS_SERVICE="openai"           # openai, elevenlabs, google
VOICE_TTS_MODEL="tts-1"             # OpenAI TTS model
VOICE_TTS_VOICE="alloy"               # Voice (alloy, echo, fable, onyx, nova, shimmer)
VOICE_TTS_LANGUAGE="vi-VN"           # Vietnamese (auto)

# Storage Configuration
VOICE_AUDIO_BUCKET="interview-audios"
VOICE_AUDIO_RETENTION_DAYS=30
```

---

## Testing Voice Features

### Unit Tests

```python
# tests/test_audio/test_stt.py

@pytest.mark.asyncio
async def test_stt_service():
    audio_data = load_test_audio("sample_answer.webm")
    transcript = await transcribe_audio(audio_data)
    assert "computer science" in transcript.lower()

@pytest.mark.asyncio
async def test_tts_service():
    text = "Xin chào, tôi là phỏng vấn viên bạn."
    audio = await text_to_speech(text)
    assert len(audio) > 1000  # Verify audio generated
```

### Integration Tests

```python
# tests/test_audio/test_voice_flow.py

@pytest.mark.asyncio
async def test_voice_message_flow():
    # 1. Upload audio
    # 2. Receive transcript
    # 3. Get AI response
    # 4. Receive TTS audio
    pass
```

---

## Rollout Strategy

### Phase 1: MVP (Week 1-2)
- Frontend: Add microphone button, basic recording
- Backend: Add STT integration (OpenAI Whisper)
- Store transcripts as text messages
- **No TTS yet**

### Phase 2: Add TTS (Week 3)
- Backend: Add TTS integration (OpenAI TTS)
- Frontend: Add audio player component
- Auto-play AI responses

### Phase 3: Polish (Week 4)
- Add voice mode toggle
- Real-time transcription display
- Audio cleanup jobs
- Full voice mode option

---

## Cost Estimation

### Per 100 Sessions (assuming 30 min each)

| Component | Usage | Cost (2025) |
|----------|-------|------------|
| STT (Whisper) | 50 min audio | ~$0.30 |
| TTS (OpenAI) | 15 min audio (~15K chars) | ~$0.23 |
| S3 Storage | 65 min @ 128kbps | ~$0.10 |
| **Total** | | **~$0.63/100 sessions** |

### Scaling

- 1,000 sessions/month → **~$6.30/month**
- 10,000 sessions/month → **~$63/month**

---

## Technical Challenges

### Latency

| Operation | Target Latency | Challenge |
|-----------|--------------|----------|
| STT (Whisper) | <5 seconds | Large file upload + processing |
| TTS (OpenAI) | <2 seconds | API queuing time |
| E2E Voice | <10 seconds | Combined STT + AI + TTS |

### Solutions
- **Stream TTS**: Play chunks as they're generated
- **STT streaming**: Use streaming STT (Google)
- **Optimized Models**: Use smaller, faster models for conversational speech
- **Prefetching**: Pre-generate TTS for common phrases

### Bandwidth

- **Audio Quality**: 128kbps for good voice, low bandwidth usage
- **Streaming**: Progressive download for audio files
- **Caching**: Cache TTS audio for common responses

---

## Privacy & Security

### Audio Content

- **User voice input** contains PII (name, experience, possibly company mentions)
- Store encrypted at rest in S3 (SSE encryption)
- Retain for 30 days then auto-delete
- No training usage with audio data

### Compliance

- **GDPR**: Audio may contain personal data, obtain consent
- **Voice Recording**: Inform users that voice is being recorded
- **Data Export**: Provide audio download on user request

---

## User Experience

### Voice Mode UI

```
┌─────────────────────────────────────────────────────┐
│  🎤 Voice Mode ON                                      │
├─────────────────────────────────────────────────────┤
│                                                       │
│  [ Push to talk ]                                     │
│                                                       │
│  Transcript:                                         │
│  "I worked at FPT for 3 years..."                   │
│                                                       │
│  ┌─────────────────────────────────────────────────┐│
│  │ AI: That's great experience! What                ││
│  │ technologies did you use...                       ││
│  │                                   [ ▶️  Play 1.0x ]  ││
│  └─────────────────────────────────────────────────┘│
│                                                       │
│  [🎤 Mic Toggle]          [Finish Session]         │
└─────────────────────────────────────────────────────┘
```

### Hybrid Mode

**Option:** Allow text + voice flexibility
- User types some responses
- User speaks some responses
- UI shows both audio and transcript
- AI always responds in selected mode (text or voice)

---

## Troubleshooting

### Common Issues

**Issue:** Microphone permission denied
**Solution:** Show clear instructions for browser permissions

**Issue:** STT transcription inaccurate
**Solution:** Allow user to edit transcript before sending

**Issue:** TTS audio doesn't play
**Solution:** Provide fallback text option

**Issue:** Audio cuts off mid-sentence
**Solution:** Handle audio chunks gracefully

---

## Related Documentation

- [Architecture Overview](./interview-architecture.md) - System architecture
- [API Specification](./interview-api-spec.md) - API endpoints
- [Evaluation System](./interview-evaluation.md) - Scoring and feedback
- [Database Schema](./interview-database-schema.md) - Database design
