"""Provider-agnostic LLM client.

Reads .env-driven config from app/backend/config.py and speaks the
OpenAI-compatible Chat Completions API. Ollama, OpenRouter, NVIDIA NIM,
vLLM, and Azure OpenAI all speak this shape — Azure with a thin URL
adapter handled below.

All Act 9 LLM calls go through this one module. Act code never speaks
to a provider directly. Swapping providers is a `.env` change.
"""
from __future__ import annotations

from typing import Any

import httpx

from .. import config


class LLMError(Exception):
    pass


def health() -> dict:
    """Cheap liveness check — used by the UI to detect missing Ollama.

    Hits the OpenAI-compatible /models endpoint where available.
    Falls back to a simple GET on the base URL otherwise.
    """
    try:
        with httpx.Client(timeout=3.0) as client:
            url = f"{config.LLM_BASE_URL.rstrip('/')}/models"
            r = client.get(url, headers=_auth_headers())
            return {
                "ok": r.status_code < 500,
                "provider": config.LLM_PROVIDER,
                "model": config.LLM_MODEL,
                "base_url": config.LLM_BASE_URL,
                "status_code": r.status_code,
            }
    except Exception as e:
        return {
            "ok": False,
            "provider": config.LLM_PROVIDER,
            "model": config.LLM_MODEL,
            "base_url": config.LLM_BASE_URL,
            "error": str(e),
        }


def _auth_headers() -> dict[str, str]:
    if config.LLM_PROVIDER == "azure":
        return {"api-key": config.LLM_API_KEY, "Content-Type": "application/json"}
    return {
        "Authorization": f"Bearer {config.LLM_API_KEY}",
        "Content-Type": "application/json",
    }


def _chat_url() -> str:
    if config.LLM_PROVIDER == "azure":
        # Azure routes per-deployment with an API version query param.
        if not config.LLM_AZURE_DEPLOYMENT or not config.LLM_AZURE_API_VERSION:
            raise LLMError(
                "azure provider requires LLM_AZURE_DEPLOYMENT and LLM_AZURE_API_VERSION"
            )
        base = config.LLM_BASE_URL.rstrip("/")
        return (
            f"{base}/openai/deployments/{config.LLM_AZURE_DEPLOYMENT}"
            f"/chat/completions?api-version={config.LLM_AZURE_API_VERSION}"
        )
    return f"{config.LLM_BASE_URL.rstrip('/')}/chat/completions"


def chat(
    messages: list[dict[str, str]],
    *,
    temperature: float | None = None,
    max_tokens: int = 600,
) -> str:
    """Send a chat completion. Returns the assistant text or raises LLMError.

    Same shape regardless of provider.
    """
    payload: dict[str, Any] = {
        "messages": messages,
        "temperature": (
            config.LLM_TEMPERATURE if temperature is None else float(temperature)
        ),
        "max_tokens": max_tokens,
        "stream": False,
    }
    # Azure ignores top-level model when deployment is in the URL,
    # but harmless to send.
    if config.LLM_PROVIDER != "azure":
        payload["model"] = config.LLM_MODEL

    try:
        with httpx.Client(timeout=config.LLM_TIMEOUT_SECONDS) as client:
            r = client.post(_chat_url(), json=payload, headers=_auth_headers())
    except httpx.TimeoutException as e:
        raise LLMError(
            "model timed out — for Ollama, the first call after boot can be slow "
            "while the model warms up. Try again."
        ) from e
    except httpx.HTTPError as e:
        raise LLMError(f"HTTP error talking to {config.LLM_PROVIDER}: {e}") from e

    if r.status_code >= 400:
        raise LLMError(
            f"{config.LLM_PROVIDER} returned {r.status_code}: {r.text[:400]}"
        )

    body = r.json()
    try:
        return body["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as e:
        raise LLMError(f"unexpected response shape: {body}") from e


def warmup() -> dict:
    """Throwaway prompt to warm the model. Called by the Act 9 mount so
    the first audience question doesn't pay the cold-start lag.
    """
    try:
        chat(
            [{"role": "user", "content": "Reply with the single word: ready."}],
            max_tokens=8,
            temperature=0.0,
        )
        return {"warmed": True, "provider": config.LLM_PROVIDER, "model": config.LLM_MODEL}
    except LLMError as e:
        return {
            "warmed": False,
            "provider": config.LLM_PROVIDER,
            "model": config.LLM_MODEL,
            "error": str(e),
        }
