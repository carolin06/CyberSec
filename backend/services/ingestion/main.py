from contextlib import asynccontextmanager

from confluent_kafka import Producer
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

KAFKA_BOOTSTRAP = "localhost:9092"
KAFKA_TOPIC = "behavioral.events.raw"

producer: Producer | None = None


def _on_delivery(err, msg):
    if err:
        print(f"[kafka] delivery failed: {err}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global producer
    producer = Producer({"bootstrap.servers": KAFKA_BOOTSTRAP})
    yield
    producer.flush(timeout=5)


app = FastAPI(title="SentinelFlow Ingestion Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Event(BaseModel):
    type: str   # kd | ku | mm | cl
    t: int      # epoch ms from Date.now()
    k: str = "" # e.code (e.g. KeyA) — never the actual character
    x: float = 0.0
    y: float = 0.0


class IngestPayload(BaseModel):
    user_id: str
    session_id: str
    channel: str
    screen: str
    events: list[Event]


@app.post("/api/ingest", status_code=202)
async def ingest(payload: IngestPayload):
    if not payload.events:
        return {"status": "ok", "events_received": 0}
    try:
        producer.produce(
            topic=KAFKA_TOPIC,
            key=payload.user_id.encode(),   # partition by user
            value=payload.model_dump_json().encode(),
            callback=_on_delivery,
        )
        producer.poll(0)  # trigger delivery callbacks without blocking
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {"status": "ok", "events_received": len(payload.events)}


@app.get("/health")
async def health():
    return {"status": "ok"}
