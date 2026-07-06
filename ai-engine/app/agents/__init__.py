"""
Shared Azure clients and LLM factory used across all agents.
Single place for credentials — no hardcoding anywhere else.
"""
from __future__ import annotations
import os
from functools import lru_cache
from langchain_openai import AzureChatOpenAI


@lru_cache(maxsize=1)
def get_llm(temperature: float = 0.0) -> AzureChatOpenAI:
    """Return the shared AzureChatOpenAI model bound to gpt-5.4."""
    return AzureChatOpenAI(
        azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
        azure_deployment=os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-5.4"),
        api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-12-01-preview"),
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
        temperature=temperature,
        max_completion_tokens=4096,
    )


def get_blob_service():
    from azure.storage.blob import BlobServiceClient
    conn = os.environ["AZURE_STORAGE_CONNECTION_STRING"]
    return BlobServiceClient.from_connection_string(conn)


CONTAINER = os.environ.get("AZURE_STORAGE_CONTAINER_NAME", "jvpay-docs")
API_GW = os.environ.get("API_GATEWAY_URL", "http://localhost:3001")
