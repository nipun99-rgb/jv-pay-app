"""Application settings loaded from environment variables."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Service URLs
    api_gateway_url: str = "http://localhost:3001"

    # Azure OpenAI
    azure_openai_endpoint: str = ""
    azure_openai_api_key: str = ""
    azure_openai_api_version: str = "2024-02-15-preview"
    azure_openai_deployment_gpt4o: str = "gpt-4o"
    azure_openai_deployment_gpt4o_mini: str = "gpt-4o-mini"

    # Azure Document Intelligence
    doc_intel_endpoint: str = ""
    doc_intel_api_key: str = ""

    # Azure Storage
    azure_storage_connection_string: str = ""
    azure_storage_container_name: str = "jvpay-docs"

    # PostgreSQL checkpointer
    postgres_dsn: str = "postgresql://postgres:postgres@localhost:5432/jvpay"

    # LangSmith
    langchain_tracing_v2: bool = False
    langchain_api_key: str = ""
    langchain_project: str = "jv-pay-v2"

    # Token budget
    max_cost_per_package_usd: float = 5.0
    max_parallel_subs: int = 3


settings = Settings()
